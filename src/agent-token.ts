import type { Context } from 'hono'
import {
  verify as httpSigVerify,
  generateSignatureErrorHeader,
  generateAcceptSignatureHeader,
} from '@hellocoop/httpsig'
import { getPublicJWK, verifyJWT } from './crypto'
import { emitVerifyFailed } from './events'
import type { Env } from './types'

type HonoEnv = { Bindings: Env }

// Resolve the JWKS for a token issuer. For tokens the registry issued
// itself (iss === ORIGIN) — e.g. browser web-agent tokens — verify against
// the local public key instead of fetching our own well-known: a Worker
// fetching its own custom domain fails (522) on Cloudflare.
export async function issuerJwks(env: Env, iss: string, dwk: string): Promise<{ keys: JsonWebKey[] }> {
  if (iss === env.ORIGIN) {
    return { keys: [await getPublicJWK(env.SIGNING_KEY)] }
  }
  const metaRes = await fetch(`${iss}/.well-known/${dwk}`)
  if (!metaRes.ok) throw new Error(`issuer metadata ${metaRes.status}`)
  const meta = (await metaRes.json()) as Record<string, unknown>
  if (!meta.jwks_uri) throw new Error('issuer metadata missing jwks_uri')
  const jwksRes = await fetch(meta.jwks_uri as string)
  if (!jwksRes.ok) throw new Error(`issuer JWKS ${jwksRes.status}`)
  return (await jwksRes.json()) as { keys: JsonWebKey[] }
}

export interface AgentIdentity {
  sub: string // agent token sub — the agent's stable identifier
  ap: string // agent token iss — the agent provider
}

// Verify the request carries a valid AAuth agent token (access_mode:
// agent-token). Returns the agent identity on success, or a Response
// (401/502) to return to the caller on failure.
//
// Pass rawBody for requests with a body (POST) so the signature covers
// it; omit for GET. Mirrors the agent-token verification in
// notes.aauth.dev's /authorize handler.
export async function verifyAgentToken(
  c: Context<HonoEnv>,
  rawBody?: string,
): Promise<AgentIdentity | Response> {
  const url = new URL(c.req.url)

  const sigResult = await httpSigVerify({
    method: c.req.method,
    authority: url.host,
    path: url.pathname,
    query: url.search.replace(/^\?/, ''),
    headers: c.req.raw.headers,
    ...(rawBody !== undefined ? { body: rawBody } : {}),
  })

  const components =
    rawBody !== undefined
      ? ['@method', '@authority', '@path', 'content-type', 'signature-key']
      : ['@method', '@authority', '@path', 'signature-key']

  if (!sigResult.verified) {
    const noSig = !c.req.header('signature') && !c.req.header('signature-input')
    if (noSig) {
      emitVerifyFailed(c, 'no_signature')
      return c.json(
        { error: 'signature_required' },
        {
          status: 401,
          headers: {
            'Accept-Signature': generateAcceptSignatureHeader({
              label: 'sig',
              components,
              sigkey: 'jkt',
            }),
          },
        },
      ) as unknown as Response
    }
    emitVerifyFailed(c, 'signature_invalid', { detail: sigResult.error })
    const headers: Record<string, string> = {}
    if (sigResult.signatureError) {
      headers['Signature-Error'] = generateSignatureErrorHeader(sigResult.signatureError)
    }
    return c.json(
      { error: 'signature_verification_failed', detail: sigResult.error },
      { status: 401, headers },
    ) as unknown as Response
  }

  if (sigResult.keyType !== 'jwt' || !sigResult.jwt) {
    emitVerifyFailed(c, 'wrong_key_scheme', { actual_key_type: sigResult.keyType })
    return c.json(
      { error: 'Signature-Key must use sig=jwt scheme (agent token)' },
      401,
    ) as unknown as Response
  }

  const header = sigResult.jwt.header as Record<string, unknown>
  const payload = sigResult.jwt.payload as Record<string, unknown>

  if (header.typ !== 'aa-agent+jwt') {
    emitVerifyFailed(c, 'agent_token_typ_mismatch', { jwt_typ: header.typ })
    return c.json({ error: 'Expected agent_token (aa-agent+jwt)' }, 401) as unknown as Response
  }

  // Verify the agent token against its agent provider's JWKS (local for
  // tokens we issued ourselves).
  const iss = payload.iss as string
  const dwk = (payload.dwk as string) || 'aauth-agent.json'
  try {
    const jwks = await issuerJwks(c.env, iss, dwk)
    await verifyJWT(sigResult.jwt.raw, jwks)
  } catch (err) {
    emitVerifyFailed(c, 'agent_token_jwt_verify_failed', { iss, detail: (err as Error).message })
    return c.json(
      { error: `agent_token verification failed: ${(err as Error).message}` },
      401,
    ) as unknown as Response
  }

  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || (payload.exp as number) < now) {
    emitVerifyFailed(c, 'agent_token_expired', { iss, exp: payload.exp })
    return c.json({ error: 'agent_token expired' }, 401) as unknown as Response
  }

  const sub = payload.sub as string | undefined
  if (!sub) {
    emitVerifyFailed(c, 'missing_sub', { iss })
    return c.json({ error: 'agent_token missing sub claim' }, 401) as unknown as Response
  }

  return { sub, ap: iss }
}
