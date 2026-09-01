#!/usr/bin/env bash
#
# URLPulse production smoke test — runs on the GitHub runner after the health
# check passes. Where the health check asks "is it up?", the smoke test asks
# "does the critical path actually work?": the SPA renders, the API answers,
# the DB + Redis are reachable end-to-end, and the auth boundary is enforced.
#
# Every check is deterministic, fast, and NON-DESTRUCTIVE — it creates no batch,
# no user, and no background job. No retries: the service is already known healthy.
#
# Usage:  scripts/ci/smoke-test.sh [base-url]
#
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://urlpulse.niranjansah87.com.np}}"
echo "Smoke-testing $BASE_URL"

fail=0
pass() { echo "  ✓ $*"; }
bad()  { echo "  ✗ $*" >&2; fail=1; }

# 1. Frontend renders (SSR HTML from Next.js through nginx), not just any 200.
body="$(curl -fsS --max-time 15 "$BASE_URL/")" || { bad "GET / did not return 2xx"; body=""; }
if echo "$body" | grep -qi "URLPulse"; then pass "GET / renders the app (contains \"URLPulse\")"
else bad "GET / did not contain expected marker \"URLPulse\""; fi

# 2. API liveness through nginx returns the documented JSON shape.
health="$(curl -fsS --max-time 10 "$BASE_URL/api/health")" || { bad "GET /api/health did not return 2xx"; health=""; }
if echo "$health" | grep -q '"status":"ok"'; then pass "GET /api/health → status ok"
else bad "GET /api/health missing '\"status\":\"ok\"' (got: ${health:-<empty>})"; fi

# 3. Readiness exercises the full stack end-to-end: API → PostgreSQL + Redis.
#    Returns 200 only when both dependencies answer; this is the highest-value check.
ready_code="$(curl -sS --max-time 10 -o /tmp/up_ready.json -w '%{http_code}' "$BASE_URL/api/health/ready" || echo 000)"
if [ "$ready_code" = "200" ] && grep -q '"ready":true' /tmp/up_ready.json; then
  pass "GET /api/health/ready → ready (PostgreSQL + Redis reachable)"
else
  bad "GET /api/health/ready not ready (HTTP $ready_code, body: $(cat /tmp/up_ready.json 2>/dev/null))"
fi

# 4. Auth boundary is enforced: an unauthenticated protected call is rejected
#    (401/403). Proves API routing + the auth guard without creating any data.
batches_code="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$BASE_URL/api/batches" || echo 000)"
if [ "$batches_code" = "401" ] || [ "$batches_code" = "403" ]; then
  pass "GET /api/batches (unauthenticated) → $batches_code (auth enforced)"
else
  bad "GET /api/batches expected 401/403, got $batches_code"
fi

# 5. Next.js metadata routing works (robots is a real route, cheap and stable).
robots_code="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$BASE_URL/robots.txt" || echo 000)"
if [ "$robots_code" = "200" ]; then pass "GET /robots.txt → 200 (routing works)"
else bad "GET /robots.txt expected 200, got $robots_code"; fi

if [ "$fail" -ne 0 ]; then
  echo "✗ Smoke test failed" >&2
  exit 1
fi
echo "✓ All smoke tests passed"
