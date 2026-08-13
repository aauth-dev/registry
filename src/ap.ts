// Agent-provider role: the registry mints short-lived browser "web-agent"
// tokens so a person's browser can make signed AAuth calls. Modeled on
// playground.aauth.dev's bootstrap. No PS involvement here — the agent
// token carries a `ps` claim so the browser can later complete the
// auth-token flow against that Person Server (Hellō) to prove identity.

import type { Context } from 'hono'
import { verify as httpSigVerify } from '@hellocoop/httpsig'
import { getPublicJWK, importSigningKey, generateJTI, sanitizeCnfJwk, signJWT } from './crypto'
import type { Env } from './types'

type HonoEnv = { Bindings: Env }

// Default Person Server for the human login flow.
export const DEFAULT_PS = 'https://person.hello.coop'

// Stable (jkt ↔ local-part) mapping so the same browser key resolves to
// the same agent id across bootstraps/refreshes. TTL ~ 30 days.
const AGENT_NAME_TTL = 60 * 60 * 24 * 30
const AGENT_KEY_PREFIX = 'agent:name:'

// Web-agent token lifetime.
const AGENT_TOKEN_TTL = 3600

export interface SigHwkResult {
  rawBody: string
  publicJwk: JsonWebKey
  jkt: string
}

// Verify an RFC 9421 request whose Signature-Key uses sig=hwk — the agent
// presents its public key inline (it has no token yet at bootstrap).
export async function verifySigHwk(c: Context<HonoEnv>): Promise<SigHwkResult | Response> {
  const rawBody = await c.req.text()
  const url = new URL(c.req.url)
  const sigResult = await httpSigVerify({
    method: c.req.method,
    authority: url.host,
    path: url.pathname,
    query: url.search.replace(/^\?/, ''),
    headers: c.req.raw.headers,
    body: rawBody,
  })
  if (!sigResult.verified) {
    return c.json({ error: `signature verification failed: ${sigResult.error || 'unknown'}` }, 401) as unknown as Response
  }
  if (sigResult.keyType !== 'hwk') {
    return c.json({ error: 'Signature-Key must use sig=hwk' }, 401) as unknown as Response
  }
  return { rawBody, publicJwk: sigResult.publicKey, jkt: sigResult.thumbprint }
}

const ADJECTIVES = ['amber', 'brisk', 'cobalt', 'dapper', 'eager', 'fleet', 'gilded', 'hazel']
const NOUNS = ['otter', 'finch', 'maple', 'quartz', 'cedar', 'heron', 'willow', 'ember']

function pick<T>(arr: T[], bytes: Uint8Array, i: number): T {
  return arr[bytes[i] % arr.length]
}

// Generate a random, human-readable local-part for a fresh agent id.
export function generateAgentLocal(): string {
  const b = crypto.getRandomValues(new Uint8Array(3))
  return `${pick(ADJECTIVES, b, 0)}-${pick(NOUNS, b, 1)}-${(b[2] % 100).toString().padStart(2, '0')}`
}

// Resolve a stable agent local-part for this key thumbprint, minting a
// fresh one (and persisting both directions) on first sight.
export async function resolveAgentLocal(env: Env, jkt: string): Promise<{ local: string; fresh: boolean }> {
  const existing = await env.REGISTRY_KV.get(`${AGENT_KEY_PREFIX}${jkt}`)
  if (existing) return { local: existing, fresh: false }
  const local = generateAgentLocal()
  await env.REGISTRY_KV.put(`${AGENT_KEY_PREFIX}${jkt}`, local, { expirationTtl: AGENT_NAME_TTL })
  return { local, fresh: true }
}

export interface MintedAgentToken {
  agent_token: string
  agent_id: string
  expires_in: number
  ps?: string
}

// Mint an aa-agent+jwt bound to the browser's public key (cnf.jwk),
// issued by the registry (iss) with a `ps` claim for the human login.
export async function mintAgentToken(
  env: Env,
  args: { aauthSub: string; psUrl?: string; jwk: JsonWebKey },
): Promise<MintedAgentToken> {
  const origin = env.ORIGIN
  const privateKey = await importSigningKey(env.SIGNING_KEY)
  const publicJwk = await getPublicJWK(env.SIGNING_KEY)
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'Ed25519', typ: 'aa-agent+jwt', kid: publicJwk.kid }
  const payload: Record<string, unknown> = {
    iss: origin,
    dwk: 'aauth-agent.json',
    sub: args.aauthSub,
    jti: generateJTI(),
    cnf: { jwk: sanitizeCnfJwk(args.jwk) },
    iat: now,
    exp: now + AGENT_TOKEN_TTL,
  }
  if (args.psUrl) payload.ps = args.psUrl

  const agent_token = await signJWT(header, payload, privateKey)
  return {
    agent_token,
    agent_id: args.aauthSub,
    expires_in: AGENT_TOKEN_TTL,
    ...(args.psUrl ? { ps: args.psUrl } : {}),
  }
}
