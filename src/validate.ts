import type { AccessMode, RegistryEntry } from './types'
import { ACCESS_MODES, FETCH_TIMEOUT_MS, MAX_DESCRIPTION, MAX_METADATA_BYTES } from './types'

export interface ResourceMetadata {
  issuer: string
  client_name?: string
  description?: string
  access_mode?: string
  logo_uri?: string
}

export type FetchResult =
  | { ok: true; metadata: ResourceMetadata }
  | { ok: false; errors: string[] }

// Normalize a submitted issuer/host into an https origin + bare host,
// applying SSRF guards. Returns null if the input is malformed or the
// host is disallowed (non-https, IP literal, localhost, internal TLD,
// or a non-default port).
export function normalizeHost(input: string): { origin: string; host: string } | null {
  let urlStr = input.trim()
  if (!urlStr) return null
  if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`

  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  if (url.port && url.port !== '443') return null // only standard https

  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    isIpLiteral(host)
  ) {
    return null
  }

  return { origin: `https://${host}`, host }
}

function isIpLiteral(host: string): boolean {
  // IPv6 literals arrive bracketed in URL.hostname (e.g. [::1]); IPv4 is dotted-decimal.
  if (host.startsWith('[') || host.includes(':')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
  return false
}

// The registry's own resource self-metadata — the document served at
// /.well-known/aauth-resource.json. Shared so the POST self-registration
// and reconcile paths can produce/validate it locally: a Worker can't
// fetch its own custom domain (Cloudflare returns 522).
export function resourceSelfDoc(origin: string): ResourceMetadata & { jwks_uri: string; scope_descriptions: Record<string, string> } {
  return {
    issuer: origin,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    access_mode: 'agent-token',
    client_name: 'AAuth Registry',
    description:
      'A directory of AAuth resources. Listing is open to any agent; contributing a resource requires a verified person — log in with your Person Server (or present an auth token) so each entry is attributable.',
    scope_descriptions: {
      openid: 'Confirm who you are',
      email: 'Your verified email address',
      name: 'Your name',
    },
  }
}

// Validate a parsed well-known document against the registry's rules:
// issuer === origin (anti-spoof), a present + bounded description, and a
// valid access_mode (or absent). Shared by the fetch path and the local
// self-registration path.
export function validateResourceMetadata(origin: string, meta: ResourceMetadata): FetchResult {
  const errors: string[] = []

  const issuer = typeof meta.issuer === 'string' ? meta.issuer.replace(/\/+$/, '') : ''
  if (issuer !== origin) {
    errors.push(`issuer_mismatch: expected ${origin}, got ${meta.issuer ?? 'none'}`)
  }

  if (typeof meta.description !== 'string' || meta.description.trim() === '') {
    errors.push('description_missing')
  } else if (meta.description.length > MAX_DESCRIPTION) {
    errors.push('description_too_long')
  }

  if (meta.access_mode !== undefined && !ACCESS_MODES.includes(meta.access_mode as AccessMode)) {
    errors.push(`invalid_access_mode: ${meta.access_mode}`)
  }

  if (errors.length > 0) return { ok: false, errors }

  return { ok: true, metadata: { ...meta, issuer } }
}

// Fetch and validate a resource's well-known metadata. Only ever
// fetches the fixed well-known path on the submitted host, with no
// redirects, a timeout, and a size cap (SSRF hardening). Enforces
// issuer === origin (anti-spoof), a present + bounded description, and
// a valid access_mode (or absent).
export async function fetchResourceMetadata(origin: string, host: string): Promise<FetchResult> {
  const url = `${origin}/.well-known/aauth-resource.json`

  let res: Response
  try {
    res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
  } catch (err) {
    return { ok: false, errors: [`fetch_failed: ${(err as Error).message}`] }
  }

  if (res.status >= 300 && res.status < 400) {
    return { ok: false, errors: ['unexpected_redirect'] }
  }
  if (!res.ok) {
    return { ok: false, errors: [`well_known_status_${res.status}`] }
  }

  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_METADATA_BYTES) {
    return { ok: false, errors: ['metadata_too_large'] }
  }

  let meta: ResourceMetadata
  try {
    meta = JSON.parse(new TextDecoder().decode(buf))
  } catch {
    return { ok: false, errors: ['metadata_not_json'] }
  }

  return validateResourceMetadata(origin, meta)
}

// Build a RegistryEntry from validated metadata and the submitter.
export function buildEntry(
  meta: ResourceMetadata,
  submitted_by: RegistryEntry['submitted_by'],
): RegistryEntry {
  return {
    issuer: meta.issuer,
    name: meta.client_name?.trim() || meta.issuer,
    description: meta.description!.trim(),
    access_mode: (meta.access_mode as AccessMode) ?? 'agent-token',
    ...(meta.logo_uri ? { logo_uri: meta.logo_uri } : {}),
    added: new Date().toISOString(),
    submitted_by,
  }
}
