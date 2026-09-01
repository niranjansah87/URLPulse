#!/usr/bin/env bash
#
# URLPulse remote production deploy — runs ON the production server over SSH,
# invoked by .github/workflows/production.yml (deploy job). It deploys the exact
# commit that triggered the workflow, never an uncontrolled `git pull`.
#
# It intentionally does NOT touch Nginx or the TLS certificate: those are
# host-level, configured once by scripts/deploy.sh, and unchanged by app deploys.
# PostgreSQL and Redis are external and never managed here.
#
# Usage (on the server):  scripts/ci/remote-deploy.sh <target-sha>
# Env:  DEPLOY_DIR  (default: $HOME/URLPulse)
#
set -euo pipefail

TARGET_SHA="${1:?usage: remote-deploy.sh <target-sha>}"
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/URLPulse}"
HEALTH_TIMEOUT=180   # seconds to wait for api + web to become healthy

cd "$DEPLOY_DIR" || { echo "✗ deploy dir not found: $DEPLOY_DIR" >&2; exit 1; }

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"
[ -f "$ENV_FILE" ]     || { echo "✗ $DEPLOY_DIR/$ENV_FILE missing (runtime secrets live on the server)" >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "✗ $DEPLOY_DIR/$COMPOSE_FILE missing" >&2; exit 1; }

dc() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

# --- Record the current commit so a failed deploy has a known rollback target --
PREV_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
echo "• Previous commit (rollback target): $PREV_SHA"
echo "• Deploying commit:                  $TARGET_SHA"

# --- Move the working tree to the exact commit under deploy -------------------
git fetch --prune origin
git checkout prod 2>/dev/null || git checkout -B prod
git reset --hard "$TARGET_SHA"

# --- Build + start. The one-shot `migrate` service runs first (api/worker wait
#     on service_completed_successfully), so replicas never race on the schema,
#     and the migration runner is idempotent. `up -d` recreates only what the new
#     images changed; external PostgreSQL/Redis are untouched. -----------------
echo "• Building images…"
dc build

echo "• Starting containers (migrate → api/worker/web)…"
dc up -d --remove-orphans

# --- Fail fast if migrations failed: api/worker will never come up ------------
cid()      { dc ps -aq "$1" 2>/dev/null | head -n1; }
c_status() { local id; id="$(cid "$1")"; [ -n "$id" ] && docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null || echo missing; }
c_exit()   { local id; id="$(cid "$1")"; [ -n "$id" ] && docker inspect -f '{{.State.ExitCode}}' "$id" 2>/dev/null || echo ""; }
c_health() { local id; id="$(cid "$1")"; [ -n "$id" ] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || echo missing; }

echo "• Waiting for api + web to become healthy (up to ${HEALTH_TIMEOUT}s)…"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  if [ "$(c_status migrate)" = "exited" ] && [ "$(c_exit migrate)" != "0" ]; then
    echo "✗ Migration failed (exit $(c_exit migrate)). Recent logs:" >&2
    dc logs --tail=100 migrate >&2 || true
    echo "  Rollback: ssh in, cd $DEPLOY_DIR, git reset --hard $PREV_SHA, then re-run this script." >&2
    exit 1
  fi
  if [ "$(c_health api)" = "healthy" ] && [ "$(c_health web)" = "healthy" ]; then
    break
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "✗ Timed out (api=$(c_health api) web=$(c_health web)). Recent logs:" >&2
    dc ps >&2 || true
    dc logs --tail=100 api web >&2 || true
    echo "  Rollback: cd $DEPLOY_DIR && git reset --hard $PREV_SHA && docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d --build" >&2
    exit 1
  fi
  sleep 3
done
echo "✓ api and web containers healthy"

# Worker has no HTTP healthcheck; confirm it is running, not crash-looping.
if [ "$(c_status worker)" = "running" ]; then
  echo "✓ worker container running"
else
  echo "✗ worker is not running (state: $(c_status worker)). Recent logs:" >&2
  dc logs --tail=100 worker >&2 || true
  exit 1
fi

# --- Reclaim disk from dangling layers only (never -a: keeps the previous
#     image available as an on-server rollback). -----------------------------
docker image prune -f >/dev/null 2>&1 || true

echo "✓ Deploy complete: $DEPLOY_DIR now at $TARGET_SHA"
