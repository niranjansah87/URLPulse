# URLPulse - Production Deployment

Production deployment for **https://urlpulse.niranjansah87.com.np**. The app runs
as Docker containers; **PostgreSQL, Redis, and Nginx are all external** to the
compose file. A **host-installed Nginx** terminates TLS and reverse-proxies to
the containers' loopback-published ports.

> **One command:** `scripts/deploy.sh` runs the whole flow - preflight checklist,
> Nginx install, image build, container start, and health checks. See §0.

---

## 0. One-command deploy

```bash
cp .env.production.example .env.production   # fill in real values first
./scripts/deploy.sh                          # add --yes to skip the confirm prompt
```

The script fails fast if anything is missing (env values, DNS, tools), then:
**obtains the TLS certificate via certbot if absent** (§7), installs
`nginx/conf.d/urlpulse.conf` into `sites-available` + symlinks `sites-enabled`,
runs `nginx -t` and restarts Nginx, builds the images, starts
`migrate → api/worker/web`, and health-checks each one (loopback + end-to-end
over HTTPS). Flags: `--yes` (no prompt), `--skip-build`, `--email ADDR` /
`--staging` (certbot). The manual equivalents are in §6-§9.

---

## 1. Architecture

```text
Internet
   |
   | HTTPS (443) / HTTP (80 -> 301)
   v
 Nginx (host) ── /       ──► 127.0.0.1:3000 ──► web  (Next.js container)
              └─ /api/*  ──► 127.0.0.1:4000 ──► api  (Fastify; /api/auth/*, SSE included)
                                   |
             ┌─────────────────────┴───────────────────┐
             v                                          v
      External PostgreSQL                        External Redis
      (source of truth)                          (BullMQ, rate limit, pub/sub, cache)
             ^                                          ^
             └────────── worker container (BullMQ, no HTTP) ─────────┘
```

- **Containers (this repo):** `web`, `api`, `worker` (+ a one-shot `migrate`).
  `api` and `web` publish **only** to `127.0.0.1:4000` / `127.0.0.1:3000` so the
  host Nginx can reach them; they are never exposed to the public host. The
  worker has no network surface at all.
- **External (not in compose):** PostgreSQL and Redis (`DATABASE_URL` /
  `REDIS_URL`), and **Nginx**, installed on the host. `nginx/` in this repo is the
  reference config the deploy script installs.
- **Single origin:** the browser only ever talks to
  `https://urlpulse.niranjansah87.com.np`. Nginx routes `/api/*` to Fastify and
  everything else to Next.js, so there is no CORS preflight and the session
  cookie is same-site.

### Why one origin

The browser API base is baked into the web bundle at build time as
`NEXT_PUBLIC_API_URL=https://urlpulse.niranjansah87.com.np/api`. Server
Components reach the API over the internal Docker network via
`API_INTERNAL_URL=http://api:4000/api` (never exposed to the browser). The
internal Docker hostname `api` is only resolvable inside the compose network -
using it in a browser-facing URL would break every client request.

---

## 2. Prerequisites

- Docker Engine + Docker Compose v2 on the deployment host.
- **Nginx installed on the host** (reverse proxy + TLS termination).
- A reachable **PostgreSQL** instance and a reachable **Redis** instance.
- DNS: an `A`/`AAAA` record for `urlpulse.niranjansah87.com.np` pointing at the
  host's public IP.
- **certbot** installed on the host (the deploy script issues the TLS cert with
  it; see §7). No pre-existing certificate required.
- Ports 80 and 443 open on the host firewall (served by host Nginx; port 80 must
  reach the host for certbot HTTP-01). Container ports 3000/4000 stay bound to
  loopback and are never public.

---

## 3. Environment variables

Copy the template and fill in real values. **Never commit `.env.production`.**

```bash
cp .env.production.example .env.production
```

| Variable | Service | Build/Runtime | Notes |
|---|---|---|---|
| `NODE_ENV=production` | all | runtime | Enforces secret requirements, JSON logs, `Secure` cookies. |
| `DATABASE_URL` | api, worker, migrate | runtime | External PostgreSQL. Add `?sslmode=require` if the provider mandates TLS. |
| `REDIS_URL` | api, worker | runtime | External Redis. Use `rediss://` for TLS providers; `redis://` otherwise. |
| `API_PORT=4000` | api | runtime | Internal port; nginx proxies to it. |
| `TRUST_PROXY=true` | api | runtime | API is behind nginx, which sets `X-Forwarded-For` / `X-Forwarded-Proto`. |
| `HTTP_ALLOW_PRIVATE_HOSTS=false` | api, worker | runtime | MUST be false in production (SSRF). |
| `BETTER_AUTH_SECRET` | api | runtime | Fixed, high-entropy, shared by all API replicas. `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | api | runtime | `https://urlpulse.niranjansah87.com.np`. |
| `WEB_ORIGIN` | api | runtime | `https://urlpulse.niranjansah87.com.np` - the single trusted browser origin (CORS + CSRF + Better Auth). |
| `RESEND_API_KEY` | api | runtime | Required in production (startup fails without it). |
| `RESEND_FROM_EMAIL` | api | runtime | Verified sender address/domain. |
| `NEXT_PUBLIC_API_URL` | web | **build** | `https://…/api`. Inlined into the browser bundle - a rebuild is required to change it. |
| `NEXT_PUBLIC_SITE_URL` | web | **build** | `https://urlpulse.niranjansah87.com.np` (canonical/robots/sitemap). |
| `API_INTERNAL_URL` | web | runtime | `http://api:4000/api` - Server Components -> API over the internal network. |
| `RATE_LIMIT_RPS=10` / `MAX_CONCURRENCY=5` / `MAX_RETRIES=3` | api, worker | runtime | System guarantees; defaults are correct. |
| `BATCH_LIST_CACHE_SECONDS=30` | api | runtime | Batch-list cache TTL. |
| `DB_POOL_MAX=10` | api, worker | runtime | Shared connection budget - see §9. |

Secrets (`DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`) are
supplied only at runtime via `env_file`. They are never baked into an image, and
only public `NEXT_PUBLIC_*` URLs are passed as build args.

---

## 4. External PostgreSQL

- Provide `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/urlpulse`.
- If the provider requires TLS, append `?sslmode=require` (or the provider's
  documented parameter).
- The app and Better Auth share this one database. Better Auth's managed tables
  (`user`, `session`, `account`, `verification`) are created by migration
  `0002_better_auth.sql` alongside the app schema.
- Connection budget: `(API replicas + worker processes) × DB_POOL_MAX`, plus a
  fixed pool of 5 per API instance for Better Auth, must stay under the server's
  `max_connections`.

## 5. External Redis

- Provide `REDIS_URL`. `redis://[:password@]host:port` or `rediss://…` for TLS.
- Redis backs BullMQ queues, the Redis-coordinated global rate limiter and
  concurrency semaphore, the cross-instance SSE pub/sub channel, and the
  batch-list cache version key. All are compatible with a standard (or TLS)
  Redis endpoint; no modules required.
- Redis is **infrastructure, not application state** - PostgreSQL remains the
  source of truth.

---

## 6. Build, start, stop

```bash
# Build all images (web build args come from --env-file).
docker compose --env-file .env.production -f docker-compose.prod.yml build

# Start the containers: migrate runs first, then api/worker/web.
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Logs (stdout/stderr; JSON for app services).
docker compose -f docker-compose.prod.yml logs -f api worker

# Status.
docker compose -f docker-compose.prod.yml ps

# Stop / restart.
docker compose -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.prod.yml restart api
```

`--env-file` is required on `build` and `up` because it supplies the
`NEXT_PUBLIC_*` build args (Compose interpolation) in addition to feeding each
service's `env_file`.

### Host Nginx

Install the reference config into the host Nginx (the deploy script does this):

```bash
sudo install -m 0644 nginx/conf.d/urlpulse.conf /etc/nginx/sites-available/urlpulse.conf
sudo ln -sfn /etc/nginx/sites-available/urlpulse.conf /etc/nginx/sites-enabled/urlpulse.conf
sudo nginx -t && sudo systemctl restart nginx
```

The server block proxies `/api/*` -> `127.0.0.1:4000` and `/` -> `127.0.0.1:3000`,
disables buffering for SSE, and sets `client_max_body_size 6m`. After editing it,
`sudo nginx -t && sudo systemctl reload nginx`.

---

## 7. TLS / HTTPS (certbot on the host)

TLS terminates at the host Nginx; certbot manages the certificate on the host.
The `443` server block references
`/etc/letsencrypt/live/urlpulse.niranjansah87.com.np/{fullchain,privkey}.pem`, so
**Nginx will not start until that certificate exists.**

`scripts/deploy.sh` **issues the certificate automatically when it is missing**:
it stops nginx to free port 80, runs certbot in `--standalone` mode, and installs
a `systemctl reload nginx` deploy-hook for renewals. Provide the contact email via
`--email ADDR`, the `CERTBOT_EMAIL` env var, or `CERTBOT_EMAIL` in
`.env.production`. Use `--staging` to dry-run against the Let's Encrypt staging CA
(avoids rate limits; certs are untrusted). certbot must be installed on the host
(`apt-get install -y certbot` or `snap install --classic certbot`).

The manual equivalent (ports 80/443 free):

```bash
sudo certbot certonly --standalone -d urlpulse.niranjansah87.com.np \
  --deploy-hook "systemctl reload nginx"
```

Renewal runs on the host (certbot systemd timer/cron) and reloads Nginx via the
saved deploy-hook. The HTTP server block also serves the ACME HTTP-01 webroot
from `/var/www/certbot` for `--webroot` renewals.

Cookies are issued `Secure; SameSite=None` in production, so **HTTPS is required**
for authentication to work.

> Never commit certificates or private keys. `/etc/letsencrypt` is a host mount;
> `*.pem`/`*.key` are not in the repo.

---

## 8. Database migrations

Migrations are plain forward-only SQL applied by `apps/api/src/migrate.ts`
(`pnpm --filter @urlpulse/api migrate`).

The compose stack runs them as a dedicated **one-shot `migrate` service** that
exits on success; `api` and `worker` start only after it completes
(`depends_on: service_completed_successfully`). This avoids multiple API replicas
racing on the schema. Re-running is a no-op (each file is recorded in
`schema_migrations`).

To apply a new migration on an already-running stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate
```

---

## 9. Health checks & graceful shutdown

- **nginx** - host service (systemd). The server block serves `GET /healthz`
  directly (no upstream) for an external uptime check; the deploy script curls it
  end-to-end over HTTPS.
- **api** - Docker healthcheck hits `GET /health` (liveness only, touches no
  external dependency, so a DB/Redis blip never restarts the container).
  `GET /health/ready` additionally probes PostgreSQL + Redis for readiness. The
  process drains on `SIGTERM` (closes the server, queue, subscriber, DB pools,
  then the Better Auth pool).
- **worker** - no Docker healthcheck: it has no HTTP surface, and a check that
  always returns success would be fake. Docker restarts it if the process exits;
  a hung worker is recovered by the API reconciliation sweep, which reclaims
  stuck `PROCESSING` URLs. The worker drains on `SIGTERM` (closes the BullMQ
  worker, Redis connections, DB pool).
- **web** - Docker healthcheck fetches `/`.

`depends_on` orders container startup but **cannot** make external PostgreSQL or
Redis ready - ensure they are reachable before `up`. Application containers use
`restart: unless-stopped` and tolerate a dependency being briefly unavailable
(readiness returns 503 until it recovers).

---

## 10. Horizontal scaling

The guarantees hold when `api` and/or `worker` are scaled
(`docker compose … up -d --scale api=3 --scale worker=2`):

- **Global 10 req/s** and **5 in-flight** are enforced through Redis-coordinated
  state, not per-process limiters, so they hold across any number of workers.
- **Idempotency** - job state transitions are conditional on current state, so
  at-least-once delivery never double-counts progress.
- **Live updates** - each API instance subscribes to the Redis `batch.updated`
  channel and fans out to its own SSE clients; refresh/reconnect reconstructs
  state from PostgreSQL (SSE is a notification transport, never the source of
  truth). With multiple API replicas behind nginx, use IP-hash or sticky
  upstreams if you want a client pinned to one replica; correctness does not
  require it, because any replica can serve any request and every event is
  reconciled against PostgreSQL.
- **Batch-list cache** - stored in Redis and keyed by a shared version counter
  that both the API and the worker increment on batch-level state changes, so the
  30-second cache stays correct across every API instance (it is not
  process-local).

See [scaling.md](./scaling.md) for the detailed reasoning.

---

## 11. Troubleshooting

| Symptom | Likely cause |
|---|---|
| host `nginx` won't start / `nginx -t` fails | TLS cert missing at `/etc/letsencrypt/live/…` - issue it first (§7); or a syntax error in `urlpulse.conf`. |
| 502 from nginx | app containers not up/healthy yet, or not published on `127.0.0.1:3000/4000` - check `docker compose ps`. |
| `api` won't start, migrate failed | External PostgreSQL unreachable or `DATABASE_URL` wrong. |
| 401 on every API call from the browser | `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` origin mismatch, or HTTP (not HTTPS) so the `Secure` cookie is dropped. |
| SSE never streams / updates only on refresh | A proxy buffering the `/api` response - confirm `proxy_buffering off` in `urlpulse.conf` and that `X-Accel-Buffering: no` reaches the client. |
| CSV upload rejected with 413 | `client_max_body_size` below the file size (6m here; API accepts 5m). |
| Rate limit seems per-worker | `REDIS_URL` differs between workers - they must share one Redis. |

---

## 12. Remaining manual/server-side steps

These cannot be completed from the repo and must be done on the target server:

1. Point DNS `urlpulse.niranjansah87.com.np` at the host.
2. Provision external PostgreSQL and Redis; put their URLs in `.env.production`.
3. Install Nginx and certbot on the host.
4. Open host firewall ports 80/443.
5. Run `./scripts/deploy.sh` - it issues the TLS certificate (certbot), installs
   the Nginx site, builds, starts, and health-checks.
