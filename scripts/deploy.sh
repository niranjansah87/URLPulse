#!/usr/bin/env bash
#
# URLPulse one-shot production deployment (host-installed Nginx + Docker app).
#
# Flow:
#   1. Preflight checklist (fail fast BEFORE changing anything):
#      tools, .env.production + required values, DNS/IP, ports.
#   2. TLS: obtain the Let's Encrypt certificate via certbot if it is missing.
#   3. Install the Nginx site: copy config, symlink sites-enabled, test, restart.
#   4. Build the Docker images and start web + api + worker (+ one-shot migrate).
#   5. Health-check every service (containers, loopback, and end-to-end via HTTPS).
#
# External to this script: PostgreSQL and Redis. The TLS certificate is issued
# here with certbot (Let's Encrypt) when absent.
#
# Usage:
#   scripts/deploy.sh [--yes] [--skip-build] [--email ADDR] [--staging] [--help]
#     --yes         Do not prompt for confirmation (non-interactive / CI).
#     --skip-build  Reuse existing images; only (re)start and health-check.
#     --email ADDR  Contact email for Let's Encrypt (else CERTBOT_EMAIL env, else prompt).
#     --staging     Use the Let's Encrypt staging CA (untrusted certs, no rate limits).
#
set -euo pipefail

# --- Configuration ----------------------------------------------------------
DOMAIN="urlpulse.niranjansah87.com.np"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production"
COMPOSE_FILE="$REPO_ROOT/docker-compose.prod.yml"
NGINX_SRC="$REPO_ROOT/nginx/conf.d/urlpulse.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/urlpulse.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/urlpulse.conf"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
HEALTH_TIMEOUT=150   # seconds to wait for containers to become healthy
DEFAULT_EMAIL="niranjansah250@gmail.com"   # Let's Encrypt contact (override: --email / CERTBOT_EMAIL)

ASSUME_YES=0
SKIP_BUILD=0
CERTBOT_STAGING=0
EMAIL="${CERTBOT_EMAIL:-}"   # resolved to DEFAULT_EMAIL if still empty after arg parsing
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --staging) CERTBOT_STAGING=1 ;;
    --email) shift; EMAIL="${1:-}" ;;
    --email=*) EMAIL="${1#--email=}" ;;
    --help|-h) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (see --help)"; exit 2 ;;
  esac
  [ $# -gt 0 ] && shift
done

# --- Output helpers ---------------------------------------------------------
if [ -t 1 ]; then
  R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; B=$'\e[1m'; Z=$'\e[0m'
else R=; G=; Y=; C=; B=; Z=; fi
ok()   { echo "${G}✓${Z} $*"; }
info() { echo "${C}•${Z} $*"; }
warn() { echo "${Y}!${Z} $*"; }
die()  { echo "${R}✗ $*${Z}" >&2; exit 1; }

SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

# Read a KEY from .env.production without executing the file (values may contain
# spaces or shell metacharacters).
env_val() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//'; }

FAILED=0
fail_check() { echo "${R}  ✗ $*${Z}"; FAILED=1; }
pass_check() { echo "${G}  ✓ $*${Z}"; }

confirm() {
  [ "$ASSUME_YES" -eq 1 ] && return 0
  read -r -p "$1 [y/N] " ans
  case "$ans" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

# =============================================================================
# PHASE 1 - PREFLIGHT
# =============================================================================
echo
echo "${B}URLPulse deploy → $DOMAIN${Z}"
echo "${B}Preflight checks${Z}"
echo "─────────────────────────────"

# 1. Platform + required tooling.
[ "$(uname -s)" = "Linux" ] || die "This deploy targets a Linux host (needs nginx + systemctl)."
for cmd in docker curl openssl nginx systemctl getent; do
  command -v "$cmd" >/dev/null 2>&1 && pass_check "found: $cmd" || fail_check "missing command: $cmd"
done
docker compose version >/dev/null 2>&1 && pass_check "found: docker compose v2" || fail_check "docker compose v2 not available"
docker info >/dev/null 2>&1 && pass_check "docker daemon running" || fail_check "docker daemon not reachable (is it running / do you have permission?)"

# 2. Repo files present.
[ -f "$COMPOSE_FILE" ] && pass_check "compose file present" || fail_check "missing $COMPOSE_FILE"
[ -f "$NGINX_SRC" ] && pass_check "nginx config present" || fail_check "missing $NGINX_SRC"

# 3. .env.production present + no leftover placeholders + key invariants.
if [ ! -f "$ENV_FILE" ]; then
  fail_check ".env.production is missing - copy .env.production.example and fill it in:"
  echo "      cp .env.production.example .env.production"
else
  pass_check ".env.production present"
  # No placeholder values left from the example template.
  if grep -Eq 'REPLACE|example\.com|USER:PASSWORD|re_REPLACE_ME' "$ENV_FILE"; then
    fail_check ".env.production still contains placeholder values (REPLACE / example.com / …)"
  else
    pass_check "no placeholder values remain"
  fi
  # Required, no-safe-default variables.
  for key in DATABASE_URL REDIS_URL BETTER_AUTH_SECRET RESEND_API_KEY \
             WEB_ORIGIN BETTER_AUTH_URL NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL API_INTERNAL_URL; do
    [ -n "$(env_val "$key")" ] && pass_check "set: $key" || fail_check "unset: $key"
  done
  # Invariants that silently break auth / routing if wrong.
  [ "$(env_val NODE_ENV)" = "production" ] || fail_check "NODE_ENV must be 'production'"
  [ "$(env_val WEB_ORIGIN)" = "https://$DOMAIN" ] || fail_check "WEB_ORIGIN must be https://$DOMAIN (CORS/CSRF/auth)"
  [ "$(env_val NEXT_PUBLIC_API_URL)" = "https://$DOMAIN/api" ] || fail_check "NEXT_PUBLIC_API_URL must be https://$DOMAIN/api"
  [ "$(env_val HTTP_ALLOW_PRIVATE_HOSTS)" != "true" ] || fail_check "HTTP_ALLOW_PRIVATE_HOSTS must be false in production (SSRF)"
  secret="$(env_val BETTER_AUTH_SECRET)"
  [ "${#secret}" -ge 16 ] || fail_check "BETTER_AUTH_SECRET must be at least 16 characters"
  [ "$(env_val TRUST_PROXY)" = "true" ] || warn "TRUST_PROXY is not 'true' - the API is behind nginx; set it so per-IP limits see the real client."
fi

# 4. DNS / IP: does the domain point at this server?
resolved_ip="$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -n1 || true)"
if [ -z "$resolved_ip" ]; then
  fail_check "DNS: $DOMAIN does not resolve. Add an A record to this server's public IP."
else
  server_ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  if [ -n "$server_ip" ] && [ "$server_ip" = "$resolved_ip" ]; then
    pass_check "DNS: $DOMAIN → $resolved_ip (matches this server)"
  else
    warn "DNS: $DOMAIN → $resolved_ip, this server appears to be ${server_ip:-unknown}."
    warn "     If DNS is still propagating or the host is behind NAT/CDN this may be fine."
    DNS_WARN=1
  fi
fi

# 5. TLS certificate: use the existing one, otherwise issue it with certbot in
#    the TLS phase below. (nginx's 443 block will not start without it.)
NEED_CERT=0
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  pass_check "TLS certificate present for $DOMAIN"
else
  NEED_CERT=1
  warn "TLS certificate missing at $CERT_DIR - will obtain it via certbot."
  # certbot must be available to issue it.
  if command -v certbot >/dev/null 2>&1; then
    pass_check "found: certbot"
  else
    fail_check "certbot not installed. Install it (e.g. 'apt-get install -y certbot' or 'snap install --classic certbot'), then re-run."
  fi
  # Email precedence: --email > CERTBOT_EMAIL env > .env.production > DEFAULT_EMAIL.
  [ -z "$EMAIL" ] && [ -f "$ENV_FILE" ] && EMAIL="$(env_val CERTBOT_EMAIL)"
  [ -z "$EMAIL" ] && EMAIL="$DEFAULT_EMAIL"
  pass_check "certbot email: $EMAIL"
fi

# 6. Ports 80/443 - warn if held by a non-nginx process.
for port in 80 443; do
  holder="$($SUDO ss -lptnH "sport = :$port" 2>/dev/null | grep -o 'users:.*' || true)"
  if [ -n "$holder" ] && ! echo "$holder" | grep -q nginx; then
    warn "port $port is in use by a non-nginx process: $holder"
  fi
done

echo "─────────────────────────────"
if [ "$FAILED" -ne 0 ]; then
  die "Preflight failed. Fix the ✗ items above and re-run."
fi
ok "Preflight passed."

echo
echo "About to:"
[ "$NEED_CERT" -eq 1 ] && echo "  0. Obtain a Let's Encrypt certificate for $DOMAIN via certbot (standalone)"
echo "  1. Install nginx site → $NGINX_ENABLED and restart nginx"
echo "  2. $([ "$SKIP_BUILD" -eq 1 ] && echo 'Skip build; ' )Build + start containers (migrate → api/worker/web)"
echo "  3. Health-check everything"
[ "${DNS_WARN:-0}" -eq 1 ] && warn "Note: the DNS check produced a warning (see above)."
confirm "Proceed?" || die "Aborted by user."

# =============================================================================
# PHASE 2a - TLS CERTIFICATE (certbot)
# =============================================================================
if [ "$NEED_CERT" -eq 1 ]; then
  echo
  echo "${B}TLS certificate${Z}"
  if [ -z "$EMAIL" ]; then
    read -r -p "Let's Encrypt contact email: " EMAIL
    [ -n "$EMAIL" ] || die "An email is required to issue a certificate."
  fi
  # --standalone runs certbot's own temporary web server on :80, so it needs the
  # port free. Stop nginx if it is currently holding it; it is (re)started in the
  # Nginx phase below with the freshly issued cert.
  if $SUDO systemctl is-active --quiet nginx; then
    info "Stopping nginx to free port 80 for standalone issuance"
    $SUDO systemctl stop nginx
  fi
  staging_flag=""
  [ "$CERTBOT_STAGING" -eq 1 ] && { staging_flag="--staging"; warn "Using Let's Encrypt STAGING (certs will not be trusted by browsers)."; }
  info "Requesting certificate for $DOMAIN"
  # shellcheck disable=SC2086
  $SUDO certbot certonly --standalone --non-interactive --agree-tos \
    -m "$EMAIL" -d "$DOMAIN" $staging_flag \
    --deploy-hook "systemctl reload nginx" \
    || die "certbot failed. Common causes: DNS not pointing here yet, or port 80 blocked by the firewall."
  [ -f "$CERT_DIR/fullchain.pem" ] || die "certbot reported success but $CERT_DIR/fullchain.pem is missing."
  ok "Certificate issued for $DOMAIN (auto-renews via certbot; reloads nginx on renewal)"
fi

# =============================================================================
# PHASE 2 - NGINX (host)
# =============================================================================
echo
echo "${B}Nginx${Z}"
# Debian/Ubuntu use sites-available + a sites-enabled symlink (included by the
# stock nginx.conf). Distros without that pattern (e.g. RHEL) only include
# conf.d, so fall back to installing there.
if $SUDO grep -qs 'sites-enabled' /etc/nginx/nginx.conf; then
  info "Installing site config → $NGINX_AVAILABLE (+ sites-enabled symlink)"
  $SUDO mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
  $SUDO install -m 0644 "$NGINX_SRC" "$NGINX_AVAILABLE"
  $SUDO ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  ok "Config copied and symlinked into sites-enabled"
else
  warn "nginx.conf does not include sites-enabled; installing to /etc/nginx/conf.d instead."
  $SUDO install -m 0644 "$NGINX_SRC" /etc/nginx/conf.d/urlpulse.conf
  ok "Config copied to /etc/nginx/conf.d/urlpulse.conf"
fi

info "Validating nginx configuration"
$SUDO nginx -t || die "nginx config test failed - not restarting. Fix the config and re-run."
ok "nginx -t passed"

info "Restarting nginx"
$SUDO systemctl restart nginx
$SUDO systemctl is-active --quiet nginx || die "nginx failed to start after restart (check: systemctl status nginx)."
ok "nginx restarted"

# =============================================================================
# PHASE 3 - DOCKER
# =============================================================================
echo
echo "${B}Docker${Z}"
dc() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

if [ "$SKIP_BUILD" -eq 0 ]; then
  info "Building images (this can take a few minutes)…"
  dc build
  ok "Images built"
else
  warn "Skipping build (--skip-build); reusing existing images."
fi

info "Starting containers…"
dc up -d
ok "Containers started (migrate runs first, then api/worker/web)"

# =============================================================================
# PHASE 4 - HEALTH CHECKS
# =============================================================================
echo
echo "${B}Health checks${Z}"

# Inspect containers directly - portable across docker compose versions.
cid()       { dc ps -aq "$1" 2>/dev/null | head -n1; }
c_status()  { local id; id="$(cid "$1")"; [ -n "$id" ] && docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null || echo missing; }
c_exit()    { local id; id="$(cid "$1")"; [ -n "$id" ] && docker inspect -f '{{.State.ExitCode}}' "$id" 2>/dev/null || echo ""; }
c_health()  { local id; id="$(cid "$1")"; [ -n "$id" ] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || echo missing; }

info "Waiting for migrate + api + web (up to ${HEALTH_TIMEOUT}s)…"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  # Fail fast if migrations failed - api/worker will never come up.
  if [ "$(c_status migrate)" = "exited" ] && [ "$(c_exit migrate)" != "0" ]; then
    dc logs migrate || true
    die "Migration failed (exit $(c_exit migrate)). Check DATABASE_URL and DB permissions, then re-run."
  fi
  [ "$(c_health api)" = "healthy" ] && [ "$(c_health web)" = "healthy" ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    dc ps
    die "Timed out (api=$(c_health api) web=$(c_health web)). Logs: docker compose -f $COMPOSE_FILE logs api web"
  fi
  sleep 3
done
ok "api and web containers healthy"

# Worker has no healthcheck; confirm it is running (not crash-looping).
[ "$(c_status worker)" = "running" ] && ok "worker container running" || warn "worker state: $(c_status worker)"

# Loopback probes (what nginx will proxy to).
curl -fsS --max-time 5 http://127.0.0.1:4000/health >/dev/null && ok "api /health (loopback 4000)" \
  || die "api not answering on 127.0.0.1:4000"
curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:3000/ && ok "web / (loopback 3000)" \
  || die "web not answering on 127.0.0.1:3000"

# End-to-end through nginx over HTTPS.
if curl -fsS --max-time 8 "https://$DOMAIN/healthz" >/dev/null 2>&1; then
  ok "nginx https /healthz"
else
  warn "https://$DOMAIN/healthz did not respond (DNS/cert/firewall?) - check externally."
fi
if curl -fsS --max-time 8 "https://$DOMAIN/api/health" >/dev/null 2>&1; then
  ok "end-to-end: https://$DOMAIN/api/health → api"
else
  warn "https://$DOMAIN/api/health failed. If the cert/DNS is fine, check nginx→api routing."
fi

# =============================================================================
# DONE
# =============================================================================
echo
ok "${B}Deployment complete.${Z}"
echo "  Site:      https://$DOMAIN"
echo "  API:       https://$DOMAIN/api"
echo "  Logs:      docker compose -f docker-compose.prod.yml logs -f api worker"
echo "  Rollback:  docker compose -f docker-compose.prod.yml down"
