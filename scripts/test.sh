#!/usr/bin/env bash
# Smoke tests for registry.aauth.dev deployment.
# Usage: bash scripts/test.sh [base_url]
#
# Covers the unauthenticated surface (well-known, jwks, discoverability)
# and the agent-token gating (signed endpoints return 401 + Accept-Signature
# when unsigned). Full signed flows are exercised manually with @aauth/fetch
# — see the "Signed end-to-end" section printed at the end.

set -uo pipefail

BASE="${1:-https://registry.aauth.dev}"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local ok="$2"
  if [ "$ok" = "true" ]; then
    echo "  PASS  $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $desc"
    FAIL=$((FAIL + 1))
  fi
}

status_of() { echo "$1" | grep -o 'HTTP/[0-9.]* [0-9]*' | head -1 | awk '{print $2}'; }

echo "Testing $BASE"
echo

# ── .well-known/aauth-resource.json ──
echo "--- /.well-known/aauth-resource.json ---"
META=$(curl -sf "$BASE/.well-known/aauth-resource.json")

check "issuer matches origin" \
  "$(echo "$META" | jq -r '.issuer' | grep -qx "$BASE" && echo true || echo false)"
check "access_mode is agent-token" \
  "$(echo "$META" | jq -e '.access_mode == "agent-token"' >/dev/null 2>&1 && echo true || echo false)"
check "description present" \
  "$(echo "$META" | jq -e '.description | type == "string"' >/dev/null 2>&1 && echo true || echo false)"
check "jwks_uri present" \
  "$(echo "$META" | jq -e '.jwks_uri' >/dev/null 2>&1 && echo true || echo false)"
echo

# ── .well-known/jwks.json ──
echo "--- /.well-known/jwks.json ---"
JWKS=$(curl -sf "$BASE/.well-known/jwks.json")
check "has at least one key" \
  "$(echo "$JWKS" | jq -e '.keys | length > 0' 2>/dev/null || echo false)"
check "key is OKP/Ed25519" \
  "$(echo "$JWKS" | jq -e '.keys[0].kty == "OKP" and .keys[0].crv == "Ed25519"' 2>/dev/null || echo false)"
check "no private key material" \
  "$(echo "$JWKS" | jq -e '.keys[0].d == null' 2>/dev/null || echo false)"
echo

# ── Discoverability ──
echo "--- discoverability ---"
ROBOTS=$(curl -sf "$BASE/robots.txt")
check "robots.txt has Sitemap line" \
  "$(echo "$ROBOTS" | grep -qi "Sitemap: $BASE/sitemap.xml" && echo true || echo false)"
check "sitemap.xml is 200" \
  "$([ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/sitemap.xml")" = "200" ] && echo true || echo false)"
check "llms.txt is 200" \
  "$([ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/llms.txt")" = "200" ] && echo true || echo false)"
echo

# ── GET /resources (no signature) → 401 + Accept-Signature ──
echo "--- GET /resources (no signature) ---"
LIST_RESP=$(curl -s -D - -o /dev/null "$BASE/resources" 2>&1)
check "returns 401" "$([ "$(status_of "$LIST_RESP")" = "401" ] && echo true || echo false)"
check "has Accept-Signature header" \
  "$(echo "$LIST_RESP" | grep -qi 'accept-signature' && echo true || echo false)"
echo

# ── POST /resources (no signature) → 401 + Accept-Signature ──
echo "--- POST /resources (no signature) ---"
POST_RESP=$(curl -s -D - -o /dev/null -X POST -H "Content-Type: application/json" \
  -d '{"issuer":"https://notes.aauth.dev"}' "$BASE/resources" 2>&1)
check "returns 401" "$([ "$(status_of "$POST_RESP")" = "401" ] && echo true || echo false)"
check "has Accept-Signature header" \
  "$(echo "$POST_RESP" | grep -qi 'accept-signature' && echo true || echo false)"
echo

# ── GET /resources/:host (no signature) → 401 ──
echo "--- GET /resources/notes.aauth.dev (no signature) ---"
ONE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/resources/notes.aauth.dev")
check "returns 401" "$([ "$ONE_STATUS" = "401" ] && echo true || echo false)"
echo

# ── admin reconcile without token → 403 ──
echo "--- POST /admin/reconcile (no token) ---"
ADMIN_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/admin/reconcile")
check "returns 403" "$([ "$ADMIN_STATUS" = "403" ] && echo true || echo false)"
echo

# ── CORS ──
echo "--- CORS ---"
CORS_HEADERS=$(curl -s -D - -o /dev/null -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  "$BASE/" 2>/dev/null || true)
check "Access-Control-Allow-Origin present" \
  "$(echo "$CORS_HEADERS" | grep -qi 'access-control-allow-origin' && echo true || echo false)"
echo

echo "========================================="
echo "Results: $PASS passed, $FAIL failed"
echo
cat <<EOF
Signed end-to-end (manual, requires a published agent keypair — see
https://www.aauth.dev/walkthrough.md to set one up with @aauth/bootstrap):

  # list (empty at first)
  npx @aauth/fetch $BASE/resources

  # add notes — expect {"status":"added",...}
  npx @aauth/fetch -X POST -H 'content-type: application/json' \\
    -d '{"issuer":"https://notes.aauth.dev"}' $BASE/resources

  # add again — expect {"status":"already_present",...}
  npx @aauth/fetch -X POST -H 'content-type: application/json' \\
    -d '{"issuer":"https://notes.aauth.dev"}' $BASE/resources

  # bogus host — expect 422 {"status":"metadata_invalid",...}
  npx @aauth/fetch -X POST -H 'content-type: application/json' \\
    -d '{"issuer":"https://example.com"}' $BASE/resources

  # list again — notes now present (after reconcile)
  npx @aauth/fetch $BASE/resources
EOF
[ "$FAIL" -eq 0 ] && echo "All unauthenticated tests passed!" || echo "Some tests failed."
exit "$FAIL"
