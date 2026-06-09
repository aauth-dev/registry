import type { Context } from 'hono'
import type { Env } from './types'

type HonoEnv = { Bindings: Env }

const SERVICE = 'registry' as const

export type EmitInput = {
  event: string
  level?: number
  msg?: string
  [k: string]: unknown
}

function requestContext(c: Context<HonoEnv>) {
  const h = c.req.raw.headers
  return {
    method: c.req.method,
    route: new URL(c.req.url).pathname,
    cf_ray: h.get('cf-ray') ?? undefined,
    client_ip: h.get('cf-connecting-ip') ?? undefined,
    user_agent: h.get('user-agent') ?? undefined,
    referer: h.get('referer') ?? undefined,
    origin: h.get('origin') ?? undefined,
  }
}

function signatureHeaders(c: Context<HonoEnv>) {
  const h = c.req.raw.headers
  return {
    sig_signature: h.get('signature') ?? undefined,
    sig_signature_input: h.get('signature-input') ?? undefined,
    sig_signature_key: h.get('signature-key') ?? undefined,
    sig_signature_agent: h.get('signature-agent') ?? undefined,
    sig_accept_signature: h.get('accept-signature') ?? undefined,
  }
}

// Enqueue a structured event to the aauth-events queue without
// blocking the response. Errors are logged and swallowed — event
// emission must never break the request path. Field shape matches
// Freezer's RawEvent (snake_case top-level service/event/timestamp/
// level/event_id) so rows union cleanly with the rest of Freezer.
export function emit(c: Context<HonoEnv>, input: EmitInput): void {
  const full = {
    service: SERVICE,
    timestamp: new Date().toISOString(),
    event_id: crypto.randomUUID(),
    level: 30,
    ...requestContext(c),
    ...input,
  }
  c.executionCtx.waitUntil(
    c.env.EVENTS_QUEUE.send(full).catch((err: unknown) =>
      console.error('event_emit_failed', {
        error: String(err),
        event: input.event,
      })
    )
  )
}

// Emit an event outside a request context (e.g. from the scheduled
// reconcile handler). No request/signature fields are attached.
export function emitBackground(env: Env, input: EmitInput): Promise<void> {
  const full = {
    service: SERVICE,
    timestamp: new Date().toISOString(),
    event_id: crypto.randomUUID(),
    level: 30,
    ...input,
  }
  return env.EVENTS_QUEUE.send(full)
    .then(() => {})
    .catch((err: unknown) =>
      console.error('event_emit_failed', { error: String(err), event: input.event })
    )
}

// Convenience wrapper for the verify_failed event, which is emitted
// from multiple sites. Attaches the signature headers so unsigned
// probes can be distinguished from malformed signing attempts.
export function emitVerifyFailed(
  c: Context<HonoEnv>,
  reason: string,
  extra: Record<string, unknown> = {},
): void {
  emit(c, {
    event: 'aauth.registry.verify_failed',
    level: 40,
    msg: `verify failed: ${reason}`,
    failure_reason: reason,
    ...signatureHeaders(c),
    ...extra,
  })
}
