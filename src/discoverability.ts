// Agent-discoverability documents, mirroring the www.aauth.dev pattern.
// Keep the listed URLs in sync when routes change.

export function robotsTxt(origin: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`
}

export function sitemapXml(origin: string): string {
  const paths = ['/', '/llms.txt', '/.well-known/aauth-resource.json']
  const urls = paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export function llmsTxt(origin: string): string {
  return `# AAuth Registry

> A directory of AAuth resources. The registry is itself an AAuth resource:
> listing requires an agent token (access_mode: agent-token), so access can
> be attributed and curated. Direct resource URLs always work without the
> registry — it is discovery convenience, not a gatekeeper.

## Endpoints

- [Resource metadata](${origin}/.well-known/aauth-resource.json): registry self-description
- [JWKS](${origin}/.well-known/jwks.json): public signing key
- GET ${origin}/resources — list all registered AAuth resources (agent token required)
- GET ${origin}/resources/{host} — fetch a single entry by host (agent token required)
- POST ${origin}/resources — submit a resource. Body: {"issuer":"https://host"}. The
  registry fetches and validates the host's /.well-known/aauth-resource.json, then adds it.
  Responses: 201 added, 200 already_present, 422 metadata_invalid (agent token required).

## Notes

Each entry caches the resource's name, description, and access_mode; full,
current metadata is always at the resource's own /.well-known/aauth-resource.json.

### access_mode

The credential flow a resource expects on a first call:

- \`agent-token\` — the resource authorizes on the agent's identity alone
- \`person-token\` — the resource authorizes on the person's identity alone
- \`session-token\` — the resource manages authorization itself and issues a
  session token, returned in the AAuth-Access header
- \`auth-token\` — the agent obtains an auth token from its person server using
  a resource token; the initial call presents a person token
- \`per-call\` — each invocation is authorized individually against that call's
  parameters (defined by AAuth R3)

This is an IANA registry (AAuth Access Mode Value Registry, Specification
Required), so the list can grow. An agent that meets a value it does not
recognize proceeds exactly as it would with no declaration: call the resource
and read the AAuth-Requirement that comes back. The declaration is advisory —
the runtime requirement is authoritative.

A resource may also state the mode per operation rather than for the whole
resource, as an R3 operation access annotation on the operation in its own
vocabulary (its OpenAPI document, MCP tool list, AsyncAPI document, or OData
metadata document). Those annotations replace the resource-wide access_mode for the
operations they cover. This registry lists only the resource-wide value; read
the resource's vocabulary for per-operation detail.
`
}
