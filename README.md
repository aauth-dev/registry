# registry.aauth.dev

A live directory of [AAuth](https://datatracker.ietf.org/doc/html/draft-hardt-oauth-aauth-protocol)
resources. Agents discover available resources here without knowing their URLs
ahead of time.

The registry is **itself an AAuth resource**: listing requires an agent token
(`access_mode: agent-token`), so access can be attributed and, in time, curated
per agent. Direct resource URLs always work without the registry — it is
discovery convenience, never a gatekeeper.

> **Supersedes the static registry design.** An earlier proposal modeled the
> registry as static, git-backed, fully public files. This service replaces that
> idea with a live, agent-token-gated Worker so we can see and shape who reads
> it. The static design is retired.

## How it works

- **Source of truth:** Cloudflare KV, one key per resource (`resource:{host}` →
  entry). Writes are independent and race-free; `GET /resources/{host}` is a
  direct, immediately-consistent read.
- **Read view:** a single `resources.json` object in R2, rebuilt by a reconcile
  job. `GET /resources` serves it in one read (ETag-cacheable).
- **Reconcile** (daily cron + after each add via `waitUntil`, + manual
  `POST /admin/reconcile`): rebuilds `resources.json` from KV, refreshes each
  entry's live metadata, and prunes resources that are definitively gone.
  Because KV is authoritative, the R2 view is always self-healing — at worst
  briefly stale, so `GET /resources` is *eventually* consistent.

## Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /.well-known/aauth-resource.json` | none | Registry self-description (`access_mode: agent-token`) |
| `GET /.well-known/jwks.json` | none | Public signing key |
| `GET /robots.txt` · `/sitemap.xml` · `/llms.txt` | none | Agent discoverability |
| `GET /resources` | agent token | List all registered resources (from R2 index) |
| `GET /resources/{host}` | agent token | Single entry (direct KV read) |
| `POST /resources` | agent token | Submit `{"issuer":"https://host"}`; fetch + validate + add |
| `POST /admin/reconcile` | agent token (allowlisted) | Manually rebuild the R2 index |

### `POST /resources`

Body: `{ "issuer": "https://notes.aauth.dev" }`. The registry fetches **only**
`https://{host}/.well-known/aauth-resource.json` (no redirects, timeout, size
cap), and requires `issuer === https://{host}` (anti-spoof — proves control of
the host), a present `description`, and a valid `access_mode`. It caches the
resource's `name`, `description`, `access_mode`, `logo_uri`, and the submitting
agent (`submitted_by`).

Responses: `201 added`, `200 already_present`, `422 metadata_invalid`.

## Develop

```bash
npm install
npm run generate-key                 # → set as SIGNING_KEY secret
npm run typecheck
npm run dev                          # wrangler dev (http://localhost:8787)
npm run dev -- --test-scheduled      # then: curl 'localhost:8787/__scheduled?cron=0+0+*+*+*'
bash scripts/test.sh http://localhost:8787
```

## Deploy

Cloudflare Workers Builds auto-deploys on push to `main` — see `CLAUDE.md`.

Required Cloudflare resources: a KV namespace (`REGISTRY_KV`), an R2 bucket
(`registry-aauth-dev`), the `aauth-events` queue, the `registry.aauth.dev`
custom domain, and the `SIGNING_KEY` secret. Seed the admin allowlist KV key
`admin:providers` (see `wrangler.toml`) with the agent-provider `iss` URLs
whose agents may run `POST /admin/reconcile`.
