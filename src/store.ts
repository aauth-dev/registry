import type { AccessMode, Env, RegistryEntry, RegistryIndex } from './types'
import { INDEX_OBJECT, RESOURCE_PREFIX } from './types'
import { fetchResourceMetadata } from './validate'

export function resourceKey(host: string): string {
  return `${RESOURCE_PREFIX}${host}`
}

// Bare host from an https origin (https://notes.aauth.dev -> notes.aauth.dev).
function hostOf(issuer: string): string {
  return new URL(issuer).host
}

// --- KV: per-resource entries (source of truth) ---

export async function getEntry(env: Env, host: string): Promise<RegistryEntry | null> {
  return env.REGISTRY_KV.get<RegistryEntry>(resourceKey(host), 'json')
}

export async function putEntry(env: Env, entry: RegistryEntry): Promise<void> {
  await env.REGISTRY_KV.put(resourceKey(hostOf(entry.issuer)), JSON.stringify(entry))
}

// --- R2: aggregate index (denormalized read view) ---

export async function getIndex(env: Env): Promise<RegistryIndex> {
  const obj = await env.REGISTRY_R2.get(INDEX_OBJECT)
  if (!obj) return { updated: '', resources: [] }
  return (await obj.json()) as RegistryIndex
}

// Re-fetch a resource's live well-known and refresh cached fields.
// Returns the (possibly updated) entry, or 'gone' if the resource
// returns a definitive 404/410 (transient errors keep the stale entry).
async function revalidate(env: Env, host: string, entry: RegistryEntry): Promise<RegistryEntry | 'gone'> {
  const result = await fetchResourceMetadata(entry.issuer, host)
  if (!result.ok) {
    if (result.errors.some((e) => e === 'well_known_status_404' || e === 'well_known_status_410')) {
      return 'gone'
    }
    return entry // keep stale on transient/other errors
  }

  const meta = result.metadata
  const updated: RegistryEntry = {
    ...entry,
    name: meta.client_name?.trim() || entry.name,
    description: meta.description!.trim(),
    access_mode: (meta.access_mode as AccessMode) ?? 'agent-token',
    ...(meta.logo_uri ? { logo_uri: meta.logo_uri } : {}),
  }

  if (JSON.stringify(updated) !== JSON.stringify(entry)) {
    await env.REGISTRY_KV.put(resourceKey(host), JSON.stringify(updated))
    return updated
  }
  return entry
}

// Rebuild resources.json in R2 from the authoritative KV set, refreshing
// each entry's live metadata and pruning resources that are definitively
// gone. Called by the daily cron, by waitUntil after a successful POST,
// and by POST /admin/reconcile. Entries are sorted by issuer so the
// serialized bytes (and R2 ETag) are stable across runs.
//
// Note: KV list() is eventually consistent — a key written moments ago
// may not appear yet; the next reconcile picks it up. GET /resources is
// therefore eventually consistent, while GET /resources/{host} (a direct
// key read) is immediately consistent.
export async function reconcile(env: Env): Promise<{ count: number; refreshed: number; pruned: number }> {
  const resources: RegistryEntry[] = []
  let refreshed = 0
  let pruned = 0
  let cursor: string | undefined

  do {
    const page = await env.REGISTRY_KV.list({ prefix: RESOURCE_PREFIX, cursor })
    for (const key of page.keys) {
      const entry = await env.REGISTRY_KV.get<RegistryEntry>(key.name, 'json')
      if (!entry) continue
      const host = key.name.slice(RESOURCE_PREFIX.length)
      const result = await revalidate(env, host, entry)
      if (result === 'gone') {
        await env.REGISTRY_KV.delete(key.name)
        pruned++
        continue
      }
      if (result !== entry) refreshed++
      resources.push(result)
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  resources.sort((a, b) => (a.issuer < b.issuer ? -1 : a.issuer > b.issuer ? 1 : 0))

  const index: RegistryIndex = { updated: new Date().toISOString(), resources }
  await env.REGISTRY_R2.put(INDEX_OBJECT, JSON.stringify(index), {
    httpMetadata: { contentType: 'application/json' },
  })

  return { count: resources.length, refreshed, pruned }
}
