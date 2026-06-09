export interface Env {
  ORIGIN: string
  SIGNING_KEY: string // Ed25519 private key (JWK JSON), set as a secret
  ADMIN_TOKEN: string // bearer for POST /admin/reconcile, set as a secret
  REGISTRY_KV: KVNamespace // source of truth: resource:{host} -> RegistryEntry
  REGISTRY_R2: R2Bucket // denormalized read view: resources.json
  EVENTS_QUEUE: Queue // bound to aauth-events; drained + signed by shipper.aauth.dev → Freezer
}

export type AccessMode = 'agent-token' | 'aauth-access-token' | 'auth-token'

export const ACCESS_MODES: AccessMode[] = ['agent-token', 'aauth-access-token', 'auth-token']

export interface RegistryEntry {
  issuer: string // https://notes.aauth.dev — canonical id + dedup key
  name: string // from client_name
  description: string
  access_mode: AccessMode
  logo_uri?: string
  added: string // ISO timestamp
  submitted_by: {
    agent: string // agent token sub
    ap: string // agent token iss (agent provider)
    user?: string // Hellō sub, when added via the human UI (Phase B)
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

// Validation limits
export const MAX_DESCRIPTION = 4096 // chars
export const MAX_METADATA_BYTES = 65536 // 64 KB cap on fetched well-known
export const FETCH_TIMEOUT_MS = 5000
