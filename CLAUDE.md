# registry.aauth.dev — Claude project notes

## Deployment

**Do not run `wrangler deploy` manually.** Cloudflare Workers Builds is
connected to this repo and auto-deploys on every push to `main`. The
build runs `npm install`, then `npx wrangler deploy`.

To ship a change:

1. Commit locally.
2. `git push origin main`.
3. Verify (usually live within a minute):
   ```bash
   curl -s https://registry.aauth.dev/.well-known/aauth-resource.json | jq .
   ```

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
| `GET /.well-known/aauth-resource.json` | none | Self-metadata (`access_mode: agent-token`) |
| `GET /.well-known/jwks.json` | none | Public key |
| `GET /robots.txt` · `/sitemap.xml` · `/llms.txt` | none | Discoverability — keep in sync with routes |
| `GET /resources` | agent token | List (R2 index, ETag) |
| `GET /resources/{host}` | agent token | Single entry (KV) |
| `POST /resources` | agent token | Add by issuer → 201 / 200 / 422 |
| `POST /admin/reconcile` | agent token from `admin:providers` AP allowlist | Manual reconcile |

## Cloudflare setup (one-time, outside this repo)

- KV namespace → put its id in `wrangler.toml` (`REGISTRY_KV`).
- R2 bucket `registry-aauth-dev` (`REGISTRY_R2`).
- `aauth-events` queue producer (shared with the other workers).
- `registry.aauth.dev` custom domain route.
- `wrangler secret put SIGNING_KEY`.
- Seed the admin allowlist: `wrangler kv key put --namespace-id <id> --remote 'admin:providers' '["https://dickhardt.github.io"]'`.
