# registry.aauth.dev — Claude project notes

## Deployment

**Do not run `wrangler deploy` manually.** Cloudflare Workers Builds is
connected to this repo and auto-deploys on every push to `main`. The CI
deploy workflow was removed in `0b36307` in favour of the Git
integration — there is no `.github/workflows/deploy.yml` and no
`CLOUDFLARE_API_TOKEN` secret any more.

To ship a change:

1. Commit locally.
2. `git push origin main`.
3. Verify (usually live within a minute):
   ```bash
   curl -s https://registry.aauth.dev/.well-known/aauth-resource.json | jq .
   ```

Check deployment history in the Cloudflare dashboard (Workers & Pages →
registry-aauth-dev → Deployments).

## Local development

- `npm run dev` — runs `wrangler dev`.
- `npm run dev -- --test-scheduled` then
  `curl 'http://localhost:8787/__scheduled?cron=0+0+*+*+*'` — fire the daily
  reconcile handler locally.
- `npm run typecheck` — `tsc --noEmit`.
- `bash scripts/test.sh [base_url]` — curl smoke tests.

**Signed requests fail under plain `wrangler dev`, and it is not your
signature.** The `[[routes]] custom_domain` entry makes the dev server hand
the Worker a URL whose host is `registry.aauth.dev`, so `new URL(c.req.url)
.host` — what every handler passes to httpsig as `authority` — does not match
the `@authority` the client signed (`localhost:PORT`). httpsig reports
`verified: false` with **no** `error` string, which reads like a bad key. To
test signed flows locally, run with a config copy that drops the `[[routes]]`
block, and set `ORIGIN` to `http://localhost:PORT` so `aud` checks line up
(`.dev.vars` overrides `[vars]`, so set it there).

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
| `GET /auth/identity` | agent/person/auth token | Login ladder: agent token → 401 `requirement=person-token`; person token → 401 `requirement=auth-token` + resource_token; auth token → set session |
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

**Person token first.** AAuth -11: a resource MUST have verified a person
token before it issues a resource token, and MUST challenge with
`requirement=person-token` when it has not — only a PS can redeem a resource
token, so one that names no person is unredeemable. `src/login.ts` verifies
the person token (`typ: aa-person+jwt`, `dwk: aauth-person.json`, JWKS at
`{iss}/.well-known/{dwk}`, `aud` = our ORIGIN, `cnf.jwk` = the request signing
key) and copies its `iss`/`sub`/`jti` into the resource token's
`ps`/`sub`/`person_token_jti`. A bad one is `400 invalid_person_token`. This
does not change the registry's own `access_mode`: listing still needs only an
agent token.

## Cloudflare setup (one-time, outside this repo)

- KV namespace → put its id in `wrangler.toml` (`REGISTRY_KV`).
- R2 bucket `registry-aauth-dev` (`REGISTRY_R2`).
- `aauth-events` queue producer (shared with the other workers).
- `registry.aauth.dev` custom domain route.
- `wrangler secret put SIGNING_KEY`.
- Seed the admin allowlist: `wrangler kv key put --namespace-id <id> --remote 'admin:providers' '["https://dickhardt.github.io"]'`.
