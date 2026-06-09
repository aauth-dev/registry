// "Login with Hellō" — the registry's identity resource. A browser
// web-agent calls this endpoint signed with its agent token; the registry
// returns a resource_token (401 + AAuth-Requirement). The browser takes
// that to the Person Server (Hellō), the human approves there, and the PS
// returns an auth_token. The browser retries here signed with the
// auth_token; the registry verifies it, extracts the human's identity, and
// sets a session cookie. Mirrors whoami.aauth.dev's flow.

import type { Context } from 'hono'
import {
  verify as httpSigVerify,
  generateAcceptSignatureHeader,
  generateSignatureErrorHeader,
} from '@hellocoop/httpsig'
import {
  computeJwkThumbprint,
  generateJTI,
  getPublicJWK,
  importSigningKey,
  signJWT,
  verifyJWT,
} from './crypto'
import { mintSessionCookie } from './session'
import { emit, emitVerifyFailed } from './events'
import type { Env } from './types'

type HonoEnv = { Bindings: Env }

// Identity scopes the registry asks the PS to release.
const LOGIN_SCOPE = 'openid email name'

export async function handleIdentity(c: Context<HonoEnv>): Promise<Response> {
  const url = new URL(c.req.url)
  const sigResult = await httpSigVerify({
    method: c.req.method,
    authority: url.host,
    path: url.pathname,
    query: url.search.replace(/^\?/, ''),
    headers: c.req.raw.headers,
  })

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
              components: ['@method', '@authority', '@path', 'signature-key'],
              sigkey: 'jkt',
            }),
          },
        },
      ) as unknown as Response
    }
    const headers: Record<string, string> = {}
    if (sigResult.signatureError) {
      headers['Signature-Error'] = generateSignatureErrorHeader(sigResult.signatureError)
    }
    emitVerifyFailed(c, 'signature_invalid', { detail: sigResult.error })
    return c.json(
      { error: 'signature_verification_failed', detail: sigResult.error },
      { status: 401, headers },
    ) as unknown as Response
  }

  if (sigResult.keyType !== 'jwt' || !sigResult.jwt) {
    emitVerifyFailed(c, 'wrong_key_scheme', { actual_key_type: sigResult.keyType })
    return c.json({ error: 'Signature-Key must use sig=jwt scheme' }, 401) as unknown as Response
  }

  const header = sigResult.jwt.header as Record<string, unknown>
  const payload = sigResult.jwt.payload as Record<string, unknown>
  const raw = sigResult.jwt.raw

  if (header.typ === 'aa-auth+jwt') {
    return handleAuthToken(c, raw, payload)
  }
  if (header.typ === 'aa-agent+jwt') {
    return handleAgentToken(c, raw, payload)
  }

  emitVerifyFailed(c, 'unsupported_jwt_type', { jwt_typ: header.typ })
  return c.json({ error: `unsupported JWT type: ${header.typ}` }, 400)
}

// auth_token → verify against PS JWKS, extract identity, set session.
async function handleAuthToken(
  c: Context<HonoEnv>,
  raw: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const iss = payload.iss as string | undefined
  const dwk = (payload.dwk as string) || 'aauth-person.json'
  if (!iss) return c.json({ error: 'auth_token missing iss' }, 401)

  let jwks: { keys: JsonWebKey[] }
  try {
    const metaRes = await fetch(`${iss}/.well-known/${dwk}`)
    if (!metaRes.ok) return c.json({ error: `PS metadata: ${metaRes.status}` }, 502)
    const meta = (await metaRes.json()) as Record<string, unknown>
    if (!meta.jwks_uri) return c.json({ error: 'PS metadata missing jwks_uri' }, 502)
    const jwksRes = await fetch(meta.jwks_uri as string)
    if (!jwksRes.ok) return c.json({ error: `PS JWKS: ${jwksRes.status}` }, 502)
    jwks = (await jwksRes.json()) as { keys: JsonWebKey[] }
  } catch (err) {
    return c.json({ error: `cannot reach PS: ${(err as Error).message}` }, 502)
  }

  try {
    await verifyJWT(raw, jwks)
  } catch (err) {
    emitVerifyFailed(c, 'auth_token_jwt_verify_failed', { iss, detail: (err as Error).message })
    return c.json({ error: `auth_token verification failed: ${(err as Error).message}` }, 401)
  }

  if (payload.aud !== c.env.ORIGIN) {
    emitVerifyFailed(c, 'auth_token_aud_mismatch', { aud: payload.aud, expected: c.env.ORIGIN })
    return c.json({ error: 'auth_token aud mismatch' }, 401)
  }

  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || (payload.exp as number) < now) {
    emitVerifyFailed(c, 'auth_token_expired', { iss, exp: payload.exp })
    return c.json({ error: 'auth_token expired' }, 401)
  }

  const sub = payload.sub as string | undefined
  if (!sub) return c.json({ error: 'auth_token missing sub' }, 401)

  const identity = {
    sub,
    ps: iss,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
  }
  const cookie = await mintSessionCookie(c.env, identity)

  emit(c, {
    event: 'aauth.registry.login',
    msg: `human logged in: ${sub}`,
    user: sub,
    ps: iss,
    email: identity.email,
  })

  return c.json(
    { status: 'logged_in', sub, email: identity.email, name: identity.name, ps: iss },
    200,
    { 'Set-Cookie': cookie },
  )
}

// agent_token → mint a resource_token and challenge for an auth_token.
async function handleAgentToken(
  c: Context<HonoEnv>,
  raw: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const agentIss = payload.iss as string | undefined
  const agentDwk = (payload.dwk as string) || 'aauth-agent.json'
  if (!agentIss) return c.json({ error: 'agent_token missing iss' }, 401)

  // Verify the agent token against its provider's JWKS.
  try {
    const metaRes = await fetch(`${agentIss}/.well-known/${agentDwk}`)
    if (!metaRes.ok) return c.json({ error: `AP metadata: ${metaRes.status}` }, 502)
    const meta = (await metaRes.json()) as Record<string, unknown>
    const jwksRes = await fetch(meta.jwks_uri as string)
    if (!jwksRes.ok) return c.json({ error: `AP JWKS: ${jwksRes.status}` }, 502)
    const jwks = (await jwksRes.json()) as { keys: JsonWebKey[] }
    await verifyJWT(raw, jwks)
  } catch (err) {
    emitVerifyFailed(c, 'agent_token_jwt_verify_failed', { iss: agentIss, detail: (err as Error).message })
    return c.json({ error: `agent_token verification failed: ${(err as Error).message}` }, 401)
  }

  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || (payload.exp as number) < now) {
    return c.json({ error: 'agent_token expired' }, 401)
  }

  const psUrl = payload.ps as string | undefined
  if (!psUrl) return c.json({ error: 'agent_token missing ps claim — cannot log in' }, 400)

  // PS issuer becomes the resource_token audience.
  let psIssuer: string
  try {
    const psRes = await fetch(`${psUrl}/.well-known/aauth-person.json`)
    if (!psRes.ok) return c.json({ error: `PS metadata: ${psRes.status}` }, 502)
    const psMeta = (await psRes.json()) as Record<string, unknown>
    if (!psMeta.issuer) return c.json({ error: 'PS metadata missing issuer' }, 502)
    psIssuer = psMeta.issuer as string
  } catch (err) {
    return c.json({ error: `cannot reach PS: ${(err as Error).message}` }, 502)
  }

  const cnf = payload.cnf as { jwk: JsonWebKey } | undefined
  if (!cnf?.jwk) return c.json({ error: 'agent_token missing cnf.jwk' }, 400)
  const agentJkt = await computeJwkThumbprint(cnf.jwk)

  const origin = c.env.ORIGIN
  const privateKey = await importSigningKey(c.env.SIGNING_KEY)
  const publicJwk = await getPublicJWK(c.env.SIGNING_KEY)

  const resourceToken = await signJWT(
    { alg: 'EdDSA', typ: 'aa-resource+jwt', kid: publicJwk.kid },
    {
      iss: origin,
      dwk: 'aauth-resource.json',
      aud: psIssuer,
      jti: generateJTI(),
      agent: payload.sub as string,
      agent_jkt: agentJkt,
      scope: LOGIN_SCOPE,
      iat: now,
      exp: now + 300,
    },
    privateKey,
  )

  emit(c, {
    event: 'aauth.registry.login_challenge',
    msg: 'resource_token minted for login',
    agent: payload.sub,
    ps: psUrl,
  })

  return c.json(
    { error: 'auth_token_required' },
    {
      status: 401,
      headers: {
        'AAuth-Requirement': `requirement=auth-token; resource-token="${resourceToken}"`,
      },
    },
  ) as unknown as Response
}
