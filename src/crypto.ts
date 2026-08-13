// Ed25519 JWT signing & verification — shared with other AAuth servers

const textEncoder = new TextEncoder()

function base64urlEncode(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function importSigningKey(jwkJson: string): Promise<CryptoKey> {
  // Strip alg/key_ops/ext: a JWK exported by newer runtimes carries
  // alg:"Ed25519", which WebCrypto rejects on import as an Ed25519 key
  // (it expects alg absent or "EdDSA"). Usages come from the import call.
  const { alg: _alg, key_ops: _ops, ext: _ext, ...jwk } = JSON.parse(jwkJson)
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign'])
}

import { calculateThumbprint } from '@hellocoop/httpsig'
export { calculateThumbprint as computeJwkThumbprint }

// Fully-specified JOSE algorithm identifier (RFC 9864) for a JWK.
// httpsig 2.x (signature-key -08) takes the algorithm from the key's `alg`
// member — never derived from kty/crv — and rejects keys without one, as
// well as the polymorphic "EdDSA". Every JWK we publish or put in a cnf
// claim must carry it.
function fullySpecifiedAlg(jwk: JsonWebKey): string | undefined {
  if (jwk.alg && jwk.alg !== 'EdDSA') return jwk.alg
  if (jwk.kty === 'OKP') return jwk.crv // 'Ed25519' | 'Ed448'
  if (jwk.kty === 'EC')
    return ({ 'P-256': 'ES256', 'P-384': 'ES384', 'P-521': 'ES512' } as Record<string, string>)[
      jwk.crv as string
    ]
  return undefined // RSA without alg: padding/hash cannot be derived
}

// Strip a public JWK down to the fields that belong in a cnf claim —
// drops any private material (d), key_ops, ext — and stamp the
// fully-specified alg the verifier requires.
export function sanitizeCnfJwk(jwk: JsonWebKey): JsonWebKey {
  const alg = fullySpecifiedAlg(jwk)
  const stamp = alg ? { alg } : {}
  if (jwk.kty === 'OKP') return { kty: 'OKP', crv: jwk.crv, x: jwk.x, ...stamp }
  if (jwk.kty === 'EC') return { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y, ...stamp }
  if (jwk.kty === 'RSA') return { kty: 'RSA', n: jwk.n, e: jwk.e, ...stamp }
  const { d: _d, key_ops: _ops, ext: _ext, ...rest } = jwk as unknown as Record<string, unknown>
  return rest as unknown as JsonWebKey
}

export async function getPublicJWK(jwkJson: string): Promise<JsonWebKey & { kid: string }> {
  const jwk = JSON.parse(jwkJson)
  // Drop private/usage fields and any stored alg hint, then stamp a
  // fully-specified alg (RFC 9864): the served JWKS must carry it under
  // httpsig 2.x. The kid is a thumbprint over kty/crv/x only, so alg does
  // not change it. verifyJWT/importSigningKey strip alg again before
  // WebCrypto import, which rejects alg:"Ed25519".
  const { d: _d, key_ops: _ops, ext: _ext, alg: _alg, ...rest } = jwk
  const alg = fullySpecifiedAlg(rest)
  const publicJwk = { ...rest, ...(alg ? { alg } : {}), key_ops: ['verify'] }
  const kid = await calculateThumbprint(publicJwk)
  return { ...publicJwk, kid }
}

export async function signJWT(
  header: Record<string, string>,
  payload: Record<string, unknown>,
  privateKey: CryptoKey
): Promise<string> {
  const headerB64 = base64urlEncode(textEncoder.encode(JSON.stringify(header)))
  const payloadB64 = base64urlEncode(textEncoder.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`
  const signature = await crypto.subtle.sign('Ed25519', privateKey, textEncoder.encode(signingInput))
  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`
}

export function generateJTI(): string {
  return base64urlEncode(crypto.getRandomValues(new Uint8Array(16)))
}

export function decodeJWTPayload(jwt: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(jwt.split('.')[1])))
}

// JWT alg → WebCrypto parameters
const JWT_ALG_PARAMS: Record<string, { importAlgo: any; verifyAlgo: any }> = {
  EdDSA: { importAlgo: { name: 'Ed25519' }, verifyAlgo: 'Ed25519' },
  // RFC 9864 fully-specified identifier; what we mint, and what peers on
  // signature-key -08 conventions mint instead of the polymorphic EdDSA.
  Ed25519: { importAlgo: { name: 'Ed25519' }, verifyAlgo: 'Ed25519' },
  RS256: {
    importAlgo: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    verifyAlgo: 'RSASSA-PKCS1-v1_5',
  },
  ES256: {
    importAlgo: { name: 'ECDSA', namedCurve: 'P-256' },
    verifyAlgo: { name: 'ECDSA', hash: 'SHA-256' },
  },
}

export async function verifyJWT(
  jwt: string,
  jwks: { keys: JsonWebKey[] }
): Promise<{ header: Record<string, unknown>; payload: Record<string, unknown> }> {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('invalid JWT format')
  const [headerB64, payloadB64, signatureB64] = parts

  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)))
  const algParams = JWT_ALG_PARAMS[header.alg]
  if (!algParams) throw new Error(`unsupported alg: ${header.alg}`)

  const candidates = jwks.keys.filter((k) =>
    header.kid ? (k as { kid?: string }).kid === header.kid : true
  )
  if (candidates.length === 0) throw new Error('no matching key in JWKS')

  const signingInput = textEncoder.encode(`${headerB64}.${payloadB64}`)
  const signature = base64urlDecode(signatureB64)

  for (const jwk of candidates) {
    try {
      // Drop alg/key_ops/ext: an Ed25519 JWK with alg:"Ed25519" is rejected
      // on import (the curve is set by importAlgo). Usages come from the call.
      const { alg: _a, key_ops: _k, ext: _e, ...pub } = jwk
      const key = await crypto.subtle.importKey(
        'jwk',
        { ...pub, key_ops: ['verify'] },
        algParams.importAlgo,
        false,
        ['verify']
      )
      const ok = await crypto.subtle.verify(
        algParams.verifyAlgo,
        key,
        signature as unknown as ArrayBuffer,
        signingInput as unknown as ArrayBuffer
      )
      if (ok) {
        const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)))
        return { header, payload }
      }
    } catch {
      // try next key
    }
  }
  throw new Error('signature verification failed')
}

export { base64urlEncode, base64urlDecode }
