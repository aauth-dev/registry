import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getPublicJWK } from './crypto'
import { verifyAgentToken } from './agent-token'
import { getEntry, getIndex, putEntry, reconcile } from './store'
import { buildEntry, fetchResourceMetadata, normalizeHost } from './validate'
import { llmsTxt, robotsTxt, sitemapXml } from './discoverability'
import { emit, emitBackground } from './events'
import { ADMIN_PROVIDERS_KEY, type Env } from './types'

type HonoEnv = { Bindings: Env }

const app = new Hono<HonoEnv>()

// Catch every unhandled exception, emit a structured error event with a
// stack trace, and return a clean 500. Without this, unprotected crypto,
// KV, and R2 calls bubble to Hono's default 500 with no context.
app.onError((err, c) => {
  const error = err instanceof Error ? err : new Error(String(err))
  emit(c, {
    event: 'aauth.registry.unhandled_error',
    level: 50,
    msg: error.message,
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack,
  })
  return c.json({ error: 'internal error' }, 500)
})

app.use('*', cors())

// ── Well-known ──

app.get('/.well-known/aauth-resource.json', (c) => {
  const origin = c.env.ORIGIN
  return c.json({
    issuer: origin,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    access_mode: 'agent-token',
    client_name: 'AAuth Registry',
    description:
      'A directory of AAuth resources. Listing requires an agent token; submit a resource by issuer to have its metadata fetched, validated, and added.',
  })
})

app.get('/.well-known/jwks.json', async (c) => {
  const publicJwk = await getPublicJWK(c.env.SIGNING_KEY)
  return c.json({ keys: [publicJwk] })
})

// ── Agent-discoverability ──

app.get('/robots.txt', (c) => c.text(robotsTxt(c.env.ORIGIN)))
app.get('/sitemap.xml', (c) =>
  c.body(sitemapXml(c.env.ORIGIN), 200, { 'content-type': 'application/xml' }),
)
app.get('/llms.txt', (c) => c.text(llmsTxt(c.env.ORIGIN)))

app.get('/', (c) =>
  c.text(
    'registry.aauth.dev — AAuth resource registry. See /.well-known/aauth-resource.json and /llms.txt',
  ),
)

// ── Resources API (agent-token gated) ──

// GET /resources — full list, served from the R2 index (one read).
app.get('/resources', async (c) => {
  const auth = await verifyAgentToken(c)
  if (auth instanceof Response) return auth

  const index = await getIndex(c.env)

  emit(c, {
    event: 'aauth.registry.list_served',
    msg: `listed ${index.resources.length} resource(s)`,
    agent: auth.sub,
    ap: auth.ap,
    count: index.resources.length,
  })

  const etag = `"${index.updated || 'empty'}"`
  if (c.req.header('if-none-match') === etag) return c.body(null, 304)
  return c.json(index, 200, { etag })
})

// GET /resources/:host — single entry, direct KV read (immediately consistent).
app.get('/resources/:host', async (c) => {
  const auth = await verifyAgentToken(c)
  if (auth instanceof Response) return auth

  const host = c.req.param('host').toLowerCase()
  const entry = await getEntry(c.env, host)
  if (!entry) return c.json({ error: 'not_found', host }, 404)

  emit(c, {
    event: 'aauth.registry.resource_get',
    msg: `served ${host}`,
    agent: auth.sub,
    ap: auth.ap,
    host,
  })

  return c.json(entry)
})

// POST /resources — submit a resource by issuer.
app.post('/resources', async (c) => {
  const rawBody = await c.req.text()
  const auth = await verifyAgentToken(c, rawBody)
  if (auth instanceof Response) return auth

  let body: { issuer?: string }
  try {
    body = JSON.parse(rawBody || '{}')
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }
  if (!body.issuer || typeof body.issuer !== 'string') {
    return c.json({ error: 'missing_issuer' }, 400)
  }

  const norm = normalizeHost(body.issuer)
  if (!norm) {
    emit(c, {
      event: 'aauth.registry.metadata_invalid',
      level: 40,
      msg: `disallowed host: ${body.issuer}`,
      agent: auth.sub,
      ap: auth.ap,
      errors: ['invalid_or_disallowed_host'],
    })
    return c.json({ status: 'metadata_invalid', errors: ['invalid_or_disallowed_host'] }, 422)
  }

  // Dedup against the authoritative per-host key (immediately consistent).
  const existing = await getEntry(c.env, norm.host)
  if (existing) {
    emit(c, {
      event: 'aauth.registry.resource_duplicate',
      msg: `duplicate ${norm.host}`,
      agent: auth.sub,
      ap: auth.ap,
      host: norm.host,
    })
    return c.json({ status: 'already_present', resource: existing }, 200)
  }

  const result = await fetchResourceMetadata(norm.origin, norm.host)
  if (!result.ok) {
    emit(c, {
      event: 'aauth.registry.metadata_invalid',
      level: 40,
      msg: `invalid metadata for ${norm.host}`,
      agent: auth.sub,
      ap: auth.ap,
      host: norm.host,
      errors: result.errors,
    })
    return c.json({ status: 'metadata_invalid', errors: result.errors }, 422)
  }

  const entry = buildEntry(result.metadata, { agent: auth.sub, ap: auth.ap })
  await putEntry(c.env, entry)

  emit(c, {
    event: 'aauth.registry.resource_added',
    msg: `added ${norm.host}`,
    agent: auth.sub,
    ap: auth.ap,
    host: norm.host,
    access_mode: entry.access_mode,
  })

  // Refresh the R2 index promptly; the daily cron is the backstop.
  c.executionCtx.waitUntil(
    reconcile(c.env).catch((e) => console.error('reconcile_failed', String(e))),
  )

  return c.json({ status: 'added', resource: entry }, 201)
})

// ── Admin: manual reconcile (also runs daily via cron) ──
//
// Authorized via AAuth, not a shared secret: the caller must present a valid
// agent token issued by an agent provider in the KV allowlist
// (ADMIN_PROVIDERS_KEY) — any agent from a listed AP is authorized.
app.post('/admin/reconcile', async (c) => {
  const auth = await verifyAgentToken(c)
  if (auth instanceof Response) return auth

  const allowed = (await c.env.REGISTRY_KV.get<string[]>(ADMIN_PROVIDERS_KEY, 'json')) ?? []
  if (!allowed.includes(auth.ap)) {
    emit(c, {
      event: 'aauth.registry.admin_denied',
      level: 40,
      msg: `reconcile denied for ${auth.sub} (ap ${auth.ap})`,
      agent: auth.sub,
      ap: auth.ap,
    })
    return c.json({ error: 'forbidden', ap: auth.ap }, 403)
  }

  const result = await reconcile(c.env)
  emit(c, {
    event: 'aauth.registry.reconciled_manual',
    msg: `manual reconcile by ${auth.sub}`,
    agent: auth.sub,
    ap: auth.ap,
    ...result,
  })
  return c.json({ status: 'reconciled', ...result })
})

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      reconcile(env)
        .then((r) =>
          emitBackground(env, {
            event: 'aauth.registry.reconciled',
            msg: `reconcile: ${r.count} resource(s), ${r.refreshed} refreshed, ${r.pruned} pruned`,
            ...r,
          }),
        )
        .catch((e) => console.error('scheduled_reconcile_failed', String(e))),
    )
  },
}
