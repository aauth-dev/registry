export interface Env {
  ORIGIN: string
  SIGNING_KEY: string // Ed25519 private key (JWK JSON), set as a secret
  REGISTRY_KV: KVNamespace // source of truth: resource:{host} -> RegistryEntry
  REGISTRY_R2: R2Bucket // denormalized read view: resources.json
  EVENTS_QUEUE: Queue // bound to aauth-events; drained + signed by shipper.aauth.dev → Freezer
}

// Values of the `access_mode` resource-metadata field. AAuth -11 turned this
// into an IANA registry (AAuth Access Mode Value Registry, Specification
// Required), seeded with the first four; R3 registers `per-call`. The -11
// rename: `aauth-access-token` → `session-token` — the credential a resource
// issues for its own consumption, returned in the `AAuth-Access` header.
//
// This list is the set of values the REGISTRY will list, not a limit on what
// exists. Because the field is an open registry, agent-side code must never
// treat an unlisted value as an error — see the note in validate.ts.
export type AccessMode =
  | 'agent-token' // resource authorizes on the agent's identity alone
  | 'person-token' // resource authorizes on the person's identity alone
  | 'session-token' // resource-managed; it issues a session token (AAuth-Access)
  | 'auth-token' // agent gets an auth token from its PS with a resource token
  | 'per-call' // R3: each invocation authorized against that call's parameters

export const ACCESS_MODES: AccessMode[] = [
  'agent-token',
  'person-token',
  'session-token',
  'auth-token',
  'per-call',
]

// Spec default when a resource publishes no `access_mode`.
export const DEFAULT_ACCESS_MODE: AccessMode = 'agent-token'

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
  documentation_uri?: string
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
// KV key holding a JSON string[] of hosts that may not be registered
// (internal infrastructure). Set via: wrangler kv key put --remote 'registry:blocklist' '["web-agent.aauth.dev"]'
export const BLOCKLIST_KEY = 'registry:blocklist'
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
