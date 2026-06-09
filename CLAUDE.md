# registry.aauth.dev — Claude project notes

## Deployment

**Deploy is via GitHub Actions** (`.github/workflows/deploy.yml`):
push to `main` runs `cloudflare/wrangler-action` (`npm ci` → `wrangler
deploy`). Requires a `CLOUDFLARE_API_TOKEN` repo secret (Workers Scripts
edit token) — set it under repo Settings → Secrets → Actions, else the
workflow fails.

To ship a change:

1. Commit locally.
2. `git push origin main`.
3. Watch the deploy: `gh run watch` (or `gh run list`).
4. Verify (usually live within a minute):
   ```bash
   curl -s https://registry.aauth.dev/.well-known/aauth-resource.json | jq .
   ```

Until `CLOUDFLARE_API_TOKEN` is set, the Action fails; a one-off
`npx wrangler deploy` from a local machine with CF auth is the fallback.

## Local development

- `npm run dev` — runs `wrangler dev`.
- `npm run dev -- --test-scheduled` then
  `curl 'http://localhost:8787/__scheduled?cron=0+0+*+*+*'` — fire the daily
  reconcile handler locally.
- `npm run typecheck` — `tsc --noEmit`.
- `bash scripts/test.sh [base_url]` — curl smoke tests.

## Architecture quick ref

- Cloudflare Worker (`src/index.ts`, Hono). Plays the AAuth **resource**
  role with `access_mode: agent-token` — the resources API is gated by
  agent-token verification (`src/agent-token.ts`). Phase B will add the
  agent-provider role + a Hellō-authenticated human UI.
- **Storage:** KV (`REGISTRY_KV`) one key per resource = source of truth;
  R2 (`REGISTRY_R2`) holds the aggregate `resources.json` read view.
  `src/store.ts` owns both, plus `reconcile()`.
- **Reconcile:** daily cron (`scheduled` handler) + `waitUntil` after each
  POST + manual `POST /admin/reconcile`. Rebuilds R2 from KV, refreshes live
  metadata, prunes 404/410 hosts.
- **Admin auth is AAuth-native** (no shared secret): `POST /admin/reconcile`
  requires an agent token from an agent provider in the KV allowlist at key
  `admin:providers` (JSON `string[]` of agent-token `iss` URLs — any agent
  from a listed AP is authorized). See `wrangler.toml` for the seed command.
- **POST validation + SSRF guards:** `src/validate.ts` (https-only, fixed
  well-known path, no redirects, timeout, size cap, `issuer === host`).
- **Events:** `src/events.ts` emits to the `aauth-events` queue; shipper
  drains + signs + ships to Freezer.
- Signing key is an Ed25519 JWK stored as the `SIGNING_KEY` secret
  (`npm run generate-key`).

## Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /.well-known/aauth-resource.json` | none | Resource self-metadata (`access_mode: agent-token`) |
| `GET /.well-known/aauth-agent.json` | none | Agent-provider self-metadata |
| `GET /.well-known/jwks.json` | none | Public key (shared by both roles) |
| `GET /robots.txt` · `/sitemap.xml` · `/llms.txt` | none | Discoverability — keep in sync with routes |
| `POST /bootstrap` | sig=hwk | Mint a browser web-agent token (AP role); `ps` defaults to Hellō |
| `GET /auth/identity` | agent/auth token | Login: agent token → resource_token challenge; auth token → set session |
| `GET /auth/session` | session cookie | Current human session or `{logged_in:false}` |
| `POST /auth/logout` | — | Clear session cookie |
| `GET /resources` | agent token | List (R2 index, ETag) |
| `GET /resources/{host}` | agent token | Single entry (KV) |
| `POST /resources` | agent token (+ session → `submitted_by.user`) | Add by issuer → 201 / 200 / 422 |
| `POST /admin/reconcile` | agent token from `admin:providers` AP allowlist | Manual reconcile |

**Phase B** (AP + human login): `src/ap.ts` (bootstrap/mint), `src/login.ts`
(identity resource, whoami-style auth-token flow vs Hellō PS), `src/session.ts`
(signed session cookie). Server side done; the browser UI (`public/`, ported
from playground's client) is still to come.

## Cloudflare setup (one-time, outside this repo)

- KV namespace → put its id in `wrangler.toml` (`REGISTRY_KV`).
- R2 bucket `registry-aauth-dev` (`REGISTRY_R2`).
- `aauth-events` queue producer (shared with the other workers).
- `registry.aauth.dev` custom domain route.
- `wrangler secret put SIGNING_KEY`.
- Seed the admin allowlist: `wrangler kv key put --namespace-id <id> --remote 'admin:providers' '["https://dickhardt.github.io"]'`.
