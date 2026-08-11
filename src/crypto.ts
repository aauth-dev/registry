// Ed25519 JWT signing & verification — shared with other AAuth servers.
//
// AAuth -11 §Signature Algorithms: every `alg` — in a JWT header and in the
// `alg` member of every JWK — MUST be a fully-specified identifier. The
// polymorphic `EdDSA` MUST NOT be used; RFC 9864 replaced it with `Ed25519`
// (and `Ed448`). This module is where that is enforced, on both sides:
// SIGNING_ALG is what we put in JWT headers, fullySpecifiedAlg() stamps every
// JWK we publish or put in a cnf, and JWT_ALG_PARAMS is the set of `alg`
// values we will verify — `EdDSA` is deliberately absent from it.

// The `alg` for every JWT this service signs. Its signing key is Ed25519.
export const SIGNING_ALG = 'Ed25519'

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
  // Strip alg/key_ops/ext before WebCrypto import. This is a WebCrypto quirk,
  // not a JOSE one: importKey with {name:'Ed25519'} rejects a JWK carrying
  // alg:"Ed25519" (it only tolerates the alg being absent, or the legacy
  // "EdDSA"). The curve comes from the import algorithm and the usages from
  // the call, so nothing is lost. Everything we *emit* carries "Ed25519".
  const { alg: _alg, key_ops: _ops, ext: _ext, ...jwk } = JSON.parse(jwkJson)
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign'])
}

import { calculateThumbprint } from '@hellocoop/httpsig'
export { calculateThumbprint as computeJwkThumbprint }

// Fully-specified JOSE algorithm identifier (RFC 9864) for a JWK.
// httpsig 2.x (signature-key -08) and AAuth -11 §Signature Algorithms both
// take the algorithm from the key's `alg` member — never derived from
// kty/crv — and reject keys without one, as well as the polymorphic
// "EdDSA". Every JWK we publish or put in a cnf claim must carry it, so an
// incoming "EdDSA" is discarded and re-derived from the curve.
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

// Fully-specified JWT alg → WebCrypto parameters. AAuth §Signature
// Algorithms: implementations MUST NOT accept `none`, the polymorphic
// `EdDSA`, or any symmetric algorithm. `EdDSA` is therefore not a key here —
// a JWT signed with it fails with `unsupported alg: EdDSA` rather than being
// verified as Ed25519. `Ed25519` and `ES256` are already fully specified;
// `RS256` names its hash and padding, so it qualifies too.
//
// Flag-day blocker: the live person server still signs every AAuth token with
// `EdDSA` — `HelloCoop/Wallet/svr/issuer/sign.js:32`, `const alg = useEdDSA ?
// 'EdDSA' : 'RS256'` with `useEdDSA = isAAuthType(typ)`. That line must ship
// `Ed25519` in the same window as this, or auth tokens stop verifying here.
const JWT_ALG_PARAMS: Record<string, { importAlgo: any; verifyAlgo: any }> = {
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

  const candidates = jwks.keys.filter((k) => {
    if (header.kid && (k as { kid?: string }).kid !== header.kid) return false
    // A key whose algorithm disagrees with the header's is not a candidate
    // (AAuth -11: reject a key whose alg, kty, or crv disagree). The key's
    // algorithm is its `alg` where it has a fully-specified one, and the
    // curve otherwise; only RSA-without-alg is indeterminate, and those keys
    // are still tried — the WebCrypto import below rejects a real mismatch.
    const keyAlg = fullySpecifiedAlg(k)
    return !keyAlg || keyAlg === header.alg
  })
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
