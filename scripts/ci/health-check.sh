#!/usr/bin/env bash
#
# URLPulse production health check — runs on the GitHub runner after deploy.
# Polls the public HTTPS endpoints (through Nginx → containers) until the app is
# live, with retries, so a few seconds of container startup never fails the run.
#
# A health check answers "is the service up?" — it is intentionally shallow and
# retried. Deeper behavioural checks belong in scripts/ci/smoke-test.sh.
#
# Usage:  scripts/ci/health-check.sh [base-url]
#
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://urlpulse.niranjansah87.com.np}}"
ATTEMPTS="${ATTEMPTS:-10}"
DELAY="${DELAY:-10}"   # seconds between attempts

echo "Health-checking $BASE_URL (up to $ATTEMPTS attempts, ${DELAY}s apart)"

# nginx liveness (no upstream dependency) then the API through nginx.
check() {
  curl -fsS --max-time 10 -o /dev/null "$BASE_URL/healthz" \
    && curl -fsS --max-time 10 -o /dev/null "$BASE_URL/api/health"
}

for i in $(seq 1 "$ATTEMPTS"); do
  if check; then
    echo "✓ Healthy after $i attempt(s): $BASE_URL/healthz and $BASE_URL/api/health responded"
    exit 0
  fi
  echo "• attempt $i/$ATTEMPTS not ready yet; retrying in ${DELAY}s…"
  sleep "$DELAY"
done

echo "✗ Service did not become healthy after $ATTEMPTS attempts" >&2
echo "  Last responses (for diagnostics):" >&2
curl -sS -o /dev/null -w "  /healthz      → HTTP %{http_code} in %{time_total}s\n" "$BASE_URL/healthz" >&2 || true
curl -sS -o /dev/null -w "  /api/health   → HTTP %{http_code} in %{time_total}s\n" "$BASE_URL/api/health" >&2 || true
exit 1
