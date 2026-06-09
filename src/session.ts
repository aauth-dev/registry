// Human session for the web UI. After a person completes the AAuth
// auth-token flow against their Person Server (Hellō), the registry mints
// a signed session cookie carrying their identity. The cookie is a JWT
// signed with the registry's own SIGNING_KEY (verified against our public
// JWK), so no extra secret is needed.

import type { Context } from 'hono'
import { getPublicJWK, importSigningKey, signJWT, verifyJWT } from './crypto'
import type { Env } from './types'

type HonoEnv = { Bindings: Env }

const COOKIE = 'registry_session'
const SESSION_TTL = 60 * 60 * 24 // 1 day

export interface HumanIdentity {
  sub: string // stable identifier asserted by the PS
  ps: string // the Person Server that asserted it
  email?: string
  name?: string
}

export async function mintSessionCookie(env: Env, id: HumanIdentity): Promise<string> {
  const privateKey = await importSigningKey(env.SIGNING_KEY)
  const publicJwk = await getPublicJWK(env.SIGNING_KEY)
  const now = Math.floor(Date.now() / 1000)
  const jwt = await signJWT(
    { alg: 'EdDSA', typ: 'registry-session+jwt', kid: publicJwk.kid },
    { ...id, iat: now, exp: now + SESSION_TTL },
    privateKey,
  )
  return `${COOKIE}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

// Read and verify the session cookie. Returns the identity or null.
export async function readSession(c: Context<HonoEnv>): Promise<HumanIdentity | null> {
  const cookie = c.req.header('cookie')
  if (!cookie) return null
  const match = cookie.split(/;\s*/).find((p) => p.startsWith(`${COOKIE}=`))
  if (!match) return null
  const jwt = match.slice(COOKIE.length + 1)
  if (!jwt) return null
  try {
    const publicJwk = await getPublicJWK(c.env.SIGNING_KEY)
    const { payload } = await verifyJWT(jwt, { keys: [publicJwk] })
    const now = Math.floor(Date.now() / 1000)
    if (!payload.exp || (payload.exp as number) < now) return null
    if (!payload.sub || !payload.ps) return null
    return {
      sub: payload.sub as string,
      ps: payload.ps as string,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    }
  } catch {
    return null
  }
}
