// "Login with Hellō" and submitter identity — both built on the AAuth
// auth-token flow (no OIDC). Three signed calls, each a step up the ladder:
//
//   1. agent token  → 401 `requirement=person-token`. The registry will not
//      issue a resource token to an agent that cannot name a person.
//   2. person token → verified against the PS's JWKS, then 401
//      `requirement=auth-token` carrying a resource token that copies the
//      person token's `ps`, `sub`, and `jti`.
//   3. auth token   → verified against the PS's JWKS; the registry reads the
//      verified person (sub/email/name) and, at /auth/identity, sets a session.
//
// Step 1 is what -11 added here (§Resource Access and Resource Tokens): "A
// resource MUST have verified a person token before it issues a resource
// token, and MUST challenge with `requirement=person-token` when it has not."
// Only a person server can redeem a resource token — it is the `aud` in
// three-party and the only party that may call an AS token endpoint — so a
// resource token naming no person is one nobody can act on. Before this step
// existed the registry minted resource tokens straight off an agent token and
// had nothing to put in `ps`/`sub`/`person_token_jti`.
//
// This does not change the registry's own `access_mode`: listing resources
// still needs only an agent token. It is the login flow that climbs.
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
  SIGNING_ALG,
} from './crypto'
import { mintSessionCookie, readSession } from './session'
import { emit, emitVerifyFailed } from './events'
import type { Env, SubmitterIdentity } from './types'

type HonoEnv = { Bindings: Env }

// Identity scopes the registry asks the PS to release (verified email + name).
const LOGIN_SCOPE = 'openid email name'

// The verified person behind a person token, plus the token's own jti so the
// resource token can bind to it.
interface VerifiedPersonToken {
  ps: string // the person token's iss — the PS that issued it
  sub: string // directed identifier in that PS's namespace
  jti: string // person_token_jti — binds the resource token to this token
}

// Resolve a person/auth-token issuer's JWKS. Per signature-key -08 the
// metadata document must name the identity it is served under, byte-equal,
// before its jwks_uri is trusted.
async function psJwks(iss: string, dwk: string): Promise<{ keys: JsonWebKey[] }> {
  const metaRes = await fetch(`${iss}/.well-known/${dwk}`)
  if (!metaRes.ok) throw new Error(`PS metadata: ${metaRes.status}`)
  const meta = (await metaRes.json()) as Record<string, unknown>
  if (meta.issuer !== iss) throw new Error('PS metadata issuer mismatch')
  if (!meta.jwks_uri) throw new Error('PS metadata missing jwks_uri')
  const jwksRes = await fetch(meta.jwks_uri as string)
  if (!jwksRes.ok) throw new Error(`PS JWKS: ${jwksRes.status}`)
  return (await jwksRes.json()) as { keys: JsonWebKey[] }
}

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
    jwks = await psJwks(iss, dwk)
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

// 401 telling an agent to come back with a person token. The header carries
// no parameters (-11 §Person Token Required) — the agent gets one for this
// resource from its PS's person token endpoint and retries. An agent with no
// person server cannot satisfy this and surfaces it as an error.
function personTokenRequired(c: Context<HonoEnv>, reason: string): Response {
  emit(c, {
    event: 'aauth.registry.person_token_challenge',
    msg: `person token required: ${reason}`,
    reason,
  })
  return c.json(
    { error: 'person_token_required' },
    { status: 401, headers: { 'AAuth-Requirement': 'requirement=person-token' } },
  ) as unknown as Response
}

// Verify a person token per -11 §Person Token Verification. `jkt` is the
// thumbprint of the key that signed the HTTP request. Returns the facts the
// resource token must copy, or a 400 `invalid_person_token` Response.
async function verifyPersonToken(
  c: Context<HonoEnv>,
  raw: string,
  payload: Record<string, unknown>,
  jkt: string,
): Promise<VerifiedPersonToken | Response> {
  const bad = (detail: string, extra: Record<string, unknown> = {}) => {
    emitVerifyFailed(c, 'invalid_person_token', { detail, ...extra })
    return c.json({ error: 'invalid_person_token', detail }, 400) as unknown as Response
  }

  // Every check that reads only the payload runs first, so a structurally
  // wrong token is refused without the registry making an outbound request
  // on its say-so. Signature verification, the one step that costs two
  // fetches to a host named inside the token, goes last.

  // 2. dwk is fixed for this token type; key discovery hangs off it.
  const dwk = payload.dwk as string | undefined
  if (dwk !== 'aauth-person.json') return bad(`dwk must be aauth-person.json, got ${dwk ?? 'none'}`)

  // 4. iss must be an https URL with no query or fragment (§Server Identifiers).
  const iss = payload.iss as string | undefined
  if (!iss) return bad('missing iss')
  try {
    const u = new URL(iss)
    if (u.protocol !== 'https:' || u.search || u.hash) return bad(`iss is not a server identifier: ${iss}`)
  } catch {
    return bad(`iss is not a URL: ${iss}`)
  }

  // 3. exp in the future, iat not in the future.
  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || (payload.exp as number) < now) return bad('expired', { iss })
  if (payload.iat && (payload.iat as number) > now + 60) return bad('iat in the future', { iss })

  // 5. aud is this resource.
  if (payload.aud !== c.env.ORIGIN) {
    return bad(`aud mismatch: expected ${c.env.ORIGIN}, got ${String(payload.aud)}`, { iss })
  }

  // 6. cnf.jwk is REQUIRED and must be the key that signed the request.
  const cnf = payload.cnf as { jwk?: JsonWebKey } | undefined
  if (!cnf?.jwk) return bad('missing cnf.jwk', { iss })
  if ((await computeJwkThumbprint(cnf.jwk)) !== jkt) {
    return bad('cnf.jwk is not the key that signed the request', { iss })
  }

  const sub = payload.sub as string | undefined
  if (!sub) return bad('missing sub', { iss })
  const jti = payload.jti as string | undefined
  if (!jti) return bad('missing jti', { iss })

  // A person token MUST NOT carry scope or account.
  if (payload.scope !== undefined || payload.account !== undefined) {
    return bad('person token carries scope or account', { iss })
  }

  // 2 (cont.). Discover the PS JWKS and verify the signature.
  try {
    await verifyJWT(raw, await psJwks(iss, dwk))
  } catch (err) {
    return bad(`signature: ${(err as Error).message}`, { iss })
  }

  return { ps: iss, sub, jti }
}

// Mint a resource token for a verified person and return the 401 auth-token
// challenge (the consent step). `aud` is the PS that issued the person token:
// it is the party that can redeem this, and its identity was proved by the
// byte-equal issuer check in psJwks() during verification.
async function challengeForAuthToken(
  c: Context<HonoEnv>,
  person: VerifiedPersonToken,
  agentJkt: string,
): Promise<Response> {
  const now = Math.floor(Date.now() / 1000)
  const origin = c.env.ORIGIN
  const privateKey = await importSigningKey(c.env.SIGNING_KEY)
  const publicJwk = await getPublicJWK(c.env.SIGNING_KEY)

  // AAuth -11 §Resource Token Structure.
  //
  //  - No `agent` claim. A resource token carries no agent identifier;
  //    `agent_jkt` binds it to the agent's key, and the PS learns which agent
  //    is asking from the agent token that signs the token request.
  //  - `ps`, `sub`, `person_token_jti` are copied unchanged from the person
  //    token this registry verified. The PS looks the person token up by
  //    `person_token_jti` among those it issued and rejects the resource
  //    token on any mismatch, so these are not free-form assertions.
  const resourceToken = await signJWT(
    { alg: SIGNING_ALG, typ: 'aa-resource+jwt', kid: publicJwk.kid },
    {
      iss: origin,
      dwk: 'aauth-resource.json',
      aud: person.ps,
      jti: generateJTI(),
      ps: person.ps,
      sub: person.sub,
      person_token_jti: person.jti,
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
    ps: person.ps,
    user: person.sub,
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

// Run httpSigVerify and return the inner JWT (header/payload/raw) plus the
// thumbprint of the key that signed the request, or a Response on any
// signature failure. Under sig=jwt that key comes from the token's own
// `cnf.jwk`, so the thumbprint is what a `cnf` must match and what goes in a
// resource token's `agent_jkt`.
async function verifiedJwt(
  c: Context<HonoEnv>,
  rawBody?: string,
): Promise<
  | { header: Record<string, unknown>; payload: Record<string, unknown>; raw: string; jkt: string }
  | Response
> {
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
    jkt: sigResult.thumbprint,
  }
}

// GET /auth/identity — the human login endpoint, one rung per call:
// agent_token → person-token challenge; person_token → resource-token
// challenge; auth_token → verify, set session cookie, return claims.
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
  if (v.header.typ === 'aa-person+jwt') {
    const person = await verifyPersonToken(c, v.raw, v.payload, v.jkt)
    if (person instanceof Response) return person
    return challengeForAuthToken(c, person, v.jkt)
  }
  if (v.header.typ === 'aa-agent+jwt') {
    return personTokenRequired(c, 'agent token presented at /auth/identity')
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
//   - agent_token, no session     → 401 person-token challenge
//   - person_token                → 401 auth-token challenge (consent)
// Returns the submitter, or a Response (challenge / error) to return as-is.
//
// A person token alone is not enough to attribute an entry: it names the
// person as a directed `(iss, sub)` pair and deliberately carries no scope,
// so it cannot release the verified email and name an entry is credited
// with. It is the rung that earns the resource token; the auth token that
// comes back carries the claims.
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

  if (v.header.typ === 'aa-person+jwt') {
    const person = await verifyPersonToken(c, v.raw, v.payload, v.jkt)
    if (person instanceof Response) return person
    return challengeForAuthToken(c, person, v.jkt)
  }

  if (v.header.typ === 'aa-agent+jwt') {
    // A logged-in human (web UI): the web-agent signs and the session
    // cookie carries the verified person established at login.
    const session = await readSession(c)
    if (session) return { user: session, agent: v.payload.sub as string }
    // Otherwise start the climb: person token first.
    return personTokenRequired(c, 'agent token presented at POST /resources')
  }

  emitVerifyFailed(c, 'unsupported_jwt_type', { jwt_typ: v.header.typ })
  return c.json({ error: `unsupported JWT type: ${v.header.typ}` }, 400) as unknown as Response
}
