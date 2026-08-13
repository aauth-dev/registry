// "Login with Hellō" and submitter identity — both built on the AAuth
// auth-token flow (no OIDC). A browser web-agent or an agent calls signed
// with its agent token; the registry returns a resource_token (401 +
// AAuth-Requirement). The caller takes it to the Person Server (Hellō),
// the human approves there — the interaction — and the PS returns an
// auth_token. Retried with the auth_token, the registry verifies it
// against the PS JWKS and reads the verified person (sub/email/name).
//
//   handleIdentity   — GET /auth/identity: on auth_token, set a session.
//   resolveSubmitter — POST /resources: require a verified person to add.

import type { Context } from 'hono'
import {
  verify as httpSigVerify,
  generateAcceptSignatureHeader,
  generateAcceptSignatureSchemeHeader,
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
import { mintSessionCookie, readSession } from './session'
import { issuerJwks } from './agent-token'
import { emit, emitVerifyFailed } from './events'
import type { Env, SubmitterIdentity } from './types'

type HonoEnv = { Bindings: Env }

// Identity scopes the registry asks the PS to release (verified email + name).
const LOGIN_SCOPE = 'openid email name'

// 401 returned when no signature is present, telling the caller what to sign.
function signatureRequired(c: Context<HonoEnv>): Response {
  emitVerifyFailed(c, 'no_signature')
  return c.json(
    { error: 'signature_required' },
    {
      status: 401,
      headers: {
        'Accept-Signature': generateAcceptSignatureHeader({
          label: 'sig',
          components: ['@method', '@authority', '@path', 'signature-key'],
        }),
        'Accept-Signature-Scheme': generateAcceptSignatureSchemeHeader(['jwt']),
      },
    },
  ) as unknown as Response
}

// Verify an auth_token against its Person Server's JWKS and return the
// verified person, or a Response on failure.
async function verifyAuthTokenIdentity(
  c: Context<HonoEnv>,
  raw: string,
  payload: Record<string, unknown>,
): Promise<SubmitterIdentity | Response> {
  const iss = payload.iss as string | undefined
  const dwk = (payload.dwk as string) || 'aauth-person.json'
  if (!iss) return c.json({ error: 'auth_token missing iss' }, 401) as unknown as Response

  let jwks: { keys: JsonWebKey[] }
  try {
    const metaRes = await fetch(`${iss}/.well-known/${dwk}`)
    if (!metaRes.ok) return c.json({ error: `PS metadata: ${metaRes.status}` }, 502) as unknown as Response
    const meta = (await metaRes.json()) as Record<string, unknown>
    // signature-key -08: metadata must name the identity it is served under
    // (byte-equal) before its jwks_uri is trusted.
    if (meta.issuer !== iss) return c.json({ error: 'PS metadata issuer mismatch' }, 502) as unknown as Response
    if (!meta.jwks_uri) return c.json({ error: 'PS metadata missing jwks_uri' }, 502) as unknown as Response
    const jwksRes = await fetch(meta.jwks_uri as string)
    if (!jwksRes.ok) return c.json({ error: `PS JWKS: ${jwksRes.status}` }, 502) as unknown as Response
    jwks = (await jwksRes.json()) as { keys: JsonWebKey[] }
  } catch (err) {
    return c.json({ error: `cannot reach PS: ${(err as Error).message}` }, 502) as unknown as Response
  }

  try {
    await verifyJWT(raw, jwks)
  } catch (err) {
    emitVerifyFailed(c, 'auth_token_jwt_verify_failed', { iss, detail: (err as Error).message })
    return c.json({ error: `auth_token verification failed: ${(err as Error).message}` }, 401) as unknown as Response
  }

  if (payload.aud !== c.env.ORIGIN) {
    emitVerifyFailed(c, 'auth_token_aud_mismatch', { aud: payload.aud, expected: c.env.ORIGIN })
    return c.json({ error: 'auth_token aud mismatch' }, 401) as unknown as Response
  }
  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || (payload.exp as number) < now) {
    emitVerifyFailed(c, 'auth_token_expired', { iss, exp: payload.exp })
    return c.json({ error: 'auth_token expired' }, 401) as unknown as Response
  }
  const sub = payload.sub as string | undefined
  if (!sub) return c.json({ error: 'auth_token missing sub' }, 401) as unknown as Response

  return {
    sub,
    ps: iss,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
  }
}

// Verify an agent_token against its provider's JWKS, then mint a
// resource_token and return a 401 auth-token challenge (the consent step).
async function challengeForAuthToken(
  c: Context<HonoEnv>,
  raw: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const agentIss = payload.iss as string | undefined
  const agentDwk = (payload.dwk as string) || 'aauth-agent.json'
  if (!agentIss) return c.json({ error: 'agent_token missing iss' }, 401)

  try {
    const jwks = await issuerJwks(c.env, agentIss, agentDwk)
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
  if (!psUrl) return c.json({ error: 'agent_token missing ps claim — cannot establish identity' }, 400)

  let psIssuer: string
  try {
    const psRes = await fetch(`${psUrl}/.well-known/aauth-person.json`)
    if (!psRes.ok) return c.json({ error: `PS metadata: ${psRes.status}` }, 502)
    const psMeta = (await psRes.json()) as Record<string, unknown>
    if (!psMeta.issuer) return c.json({ error: 'PS metadata missing issuer' }, 502)
    // Byte-equal issuer check (signature-key -08 / RFC 8414 §3.3): don't
    // mint a resource_token aud'd to an issuer the ps host didn't prove.
    if (psMeta.issuer !== psUrl) return c.json({ error: 'PS metadata issuer mismatch' }, 502)
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
    { alg: 'Ed25519', typ: 'aa-resource+jwt', kid: publicJwk.kid },
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
    event: 'aauth.registry.auth_token_challenge',
    msg: 'resource_token minted; auth-token (consent) required',
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

// Run httpSigVerify and return the inner JWT (header/payload/raw), or a
// Response on any signature failure.
async function verifiedJwt(
  c: Context<HonoEnv>,
  rawBody?: string,
): Promise<{ header: Record<string, unknown>; payload: Record<string, unknown>; raw: string } | Response> {
  const url = new URL(c.req.url)
  const sigResult = await httpSigVerify({
    method: c.req.method,
    authority: url.host,
    path: url.pathname,
    query: url.search.replace(/^\?/, ''),
    headers: c.req.raw.headers,
    ...(rawBody !== undefined ? { body: rawBody } : {}),
  })

  if (!sigResult.verified) {
    const noSig = !c.req.header('signature') && !c.req.header('signature-input')
    if (noSig) return signatureRequired(c)
    const headers: Record<string, string> = {}
    if (sigResult.signatureError) headers['Signature-Error'] = generateSignatureErrorHeader(sigResult.signatureError)
    emitVerifyFailed(c, 'signature_invalid', { detail: sigResult.error })
    return c.json({ error: 'signature_verification_failed', detail: sigResult.error }, { status: 401, headers }) as unknown as Response
  }
  if (sigResult.keyType !== 'jwt' || !sigResult.jwt) {
    emitVerifyFailed(c, 'wrong_key_scheme', { actual_key_type: sigResult.keyType })
    return c.json({ error: 'Signature-Key must use sig=jwt scheme' }, 401) as unknown as Response
  }
  return {
    header: sigResult.jwt.header as Record<string, unknown>,
    payload: sigResult.jwt.payload as Record<string, unknown>,
    raw: sigResult.jwt.raw,
  }
}

// GET /auth/identity — the human login endpoint. agent_token → challenge;
// auth_token → verify, set session cookie, return claims.
export async function handleIdentity(c: Context<HonoEnv>): Promise<Response> {
  const v = await verifiedJwt(c)
  if (v instanceof Response) return v

  if (v.header.typ === 'aa-auth+jwt') {
    const id = await verifyAuthTokenIdentity(c, v.raw, v.payload)
    if (id instanceof Response) return id
    const cookie = await mintSessionCookie(c.env, id)
    emit(c, { event: 'aauth.registry.login', msg: `human logged in: ${id.sub}`, user: id.sub, ps: id.ps, email: id.email })
    return c.json({ status: 'logged_in', ...id }, 200, { 'Set-Cookie': cookie })
  }
  if (v.header.typ === 'aa-agent+jwt') {
    return challengeForAuthToken(c, v.raw, v.payload)
  }
  emitVerifyFailed(c, 'unsupported_jwt_type', { jwt_typ: v.header.typ })
  return c.json({ error: `unsupported JWT type: ${v.header.typ}` }, 400)
}

export interface ResolvedSubmitter {
  user: SubmitterIdentity
  agent?: string
}

// Resolve the verified person behind a POST /resources call:
//   - auth_token signature        → identity from the token
//   - agent_token + valid session → identity from the web session
//   - agent_token, no session     → 401 auth-token challenge (consent)
// Returns the submitter, or a Response (challenge / error) to return as-is.
export async function resolveSubmitter(
  c: Context<HonoEnv>,
  rawBody: string,
): Promise<ResolvedSubmitter | Response> {
  const v = await verifiedJwt(c, rawBody)
  if (v instanceof Response) return v

  if (v.header.typ === 'aa-auth+jwt') {
    const id = await verifyAuthTokenIdentity(c, v.raw, v.payload)
    if (id instanceof Response) return id
    const act = v.payload.act as { sub?: string } | undefined
    return { user: id, agent: act?.sub }
  }

  if (v.header.typ === 'aa-agent+jwt') {
    // A logged-in human (web UI): the web-agent signs and the session
    // cookie carries the verified person established at login.
    const session = await readSession(c)
    if (session) return { user: session, agent: v.payload.sub as string }
    // Otherwise the agent must obtain an auth_token → trigger consent.
    return challengeForAuthToken(c, v.raw, v.payload)
  }

  emitVerifyFailed(c, 'unsupported_jwt_type', { jwt_typ: v.header.typ })
  return c.json({ error: `unsupported JWT type: ${v.header.typ}` }, 400) as unknown as Response
}
