export interface Env {
  ORIGIN: string
  SIGNING_KEY: string // Ed25519 private key (JWK JSON), set as a secret
  REGISTRY_KV: KVNamespace // source of truth: resource:{host} -> RegistryEntry
  REGISTRY_R2: R2Bucket // denormalized read view: resources.json
  EVENTS_QUEUE: Queue // bound to aauth-events; drained + signed by shipper.aauth.dev → Freezer
}

export type AccessMode = 'agent-token' | 'aauth-access-token' | 'auth-token'

export const ACCESS_MODES: AccessMode[] = ['agent-token', 'aauth-access-token', 'auth-token']

// The verified person behind a submission — asserted by their Person
// Server (Hellō) via the AAuth auth-token flow. Every new add carries one.
export interface SubmitterIdentity {
  sub: string // stable identifier asserted by the PS
  ps: string // the Person Server that asserted it
  email?: string // verified email (Hellō always releases one)
  name?: string
}

export interface RegistryEntry {
  issuer: string // https://notes.aauth.dev — canonical id + dedup key
  name: string // from resource name field
  description: string
  access_mode: AccessMode
  logo_uri?: string
  added: string // ISO timestamp
  submitted_by: {
    user?: SubmitterIdentity // verified person (present on all new adds; absent on legacy seeds)
    agent?: string // the agent/web-agent sub that signed the request
    ap?: string // agent provider
  }
}

export interface RegistryIndex {
  updated: string // ISO timestamp of last reconcile
  resources: RegistryEntry[]
}

// KV key prefix for per-resource entries
export const RESOURCE_PREFIX = 'resource:'
// R2 object key for the aggregate index
export const INDEX_OBJECT = 'resources.json'
// KV key holding the allowlist of agent providers (APs) whose agents may
// run admin ops (e.g. POST /admin/reconcile). Value: JSON string[] of agent
// token `iss` URLs — any agent issued by a listed AP is authorized.
export const ADMIN_PROVIDERS_KEY = 'admin:providers'

// Validation limits
export const MAX_DESCRIPTION = 4096 // chars
export const MAX_METADATA_BYTES = 65536 // 64 KB cap on fetched well-known
export const FETCH_TIMEOUT_MS = 5000
