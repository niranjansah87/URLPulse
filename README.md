<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/brand/logo/horizontal/urlpulse-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="./public/brand/logo/horizontal/urlpulse-light.png">
  <img alt="URLPulse" src="./public/brand/logo/horizontal/urlpulse-light.png" width="360">
</picture>

# URLPulse

**Bulk URL health monitoring with reliable background processing and real-time progress.**

<video src="https://raw.githubusercontent.com/niranjansah87/URLPulse/main/public/brand/urlpulse-logo-reveal.mp4" width="640" autoplay loop muted playsinline></video>

</div>

---

## Overview

URLPulse lets you submit a collection of URLs - pasted directly or uploaded as CSV - and checks each one independently in the background while streaming progress and results to the browser in real time.

For every URL, URLPulse records:

- Final HTTP status code
- Response time
- Page title, when available
- Success / failure state and processing status

Each URL is processed as its own background job, so large batches never block the API and individual URLs can succeed, fail, retry, or be cancelled independently.

> **Project status:** This repository currently contains the product and engineering documentation and the brand assets. The application (Next.js web, Fastify API, and BullMQ worker) is being implemented against the design in [`docs/`](./docs/README.md). Features below are marked **implemented** or **planned** accordingly.

## Key Features

| Feature | Status |
|---------|--------|
| Bulk URL submission (paste) | Planned |
| CSV upload | Planned |
| Background processing with BullMQ | Planned |
| PostgreSQL-backed durable state | Planned |
| Redis-backed distributed coordination | Planned |
| Global 10 requests/second outbound HTTP limit | Planned |
| Maximum 5 URL checks in flight | Planned |
| Retry with exponential backoff | Planned |
| Idempotent job processing | Planned |
| Batch cancellation (queued + in-flight) | Planned |
| Retry failed URLs only | Planned |
| Real-time progress via Server-Sent Events | Planned |
| Refresh-safe state reconstruction | Planned |
| 30-second batch-list caching with invalidation | Planned |
| Light and dark UI themes | Planned |

The engineering design for every item above is documented in [`docs/`](./docs/README.md).

## Architecture

```mermaid
flowchart TD
    Browser["Browser (Next.js UI)"]
    API["Fastify API"]
    PG[("PostgreSQL<br/>source of truth")]
    RD[("Redis<br/>BullMQ + rate limit + pub/sub")]
    Worker["Worker process"]
    Ext["External URLs"]

    Browser -->|HTTP + SSE| API
    API -->|persist batches + URLs| PG
    API -->|enqueue 1 job / URL| RD
    RD -->|deliver jobs| Worker
    Worker -->|global rate limit| Ext
    Worker -->|write results idempotently| PG
    Worker -->|publish updates| RD
    RD -->|fan-out| API
    API -->|SSE stream| Browser
```

| Component | Responsibility |
|-----------|----------------|
| **Next.js web** | UI for submission, batch list, and live batch detail. A projection of backend state - never authoritative. |
| **Fastify API** | Accepts submissions, persists state, enqueues jobs, serves reads, streams SSE. Stateless; horizontally scalable. |
| **Worker** | Separate process. Consumes jobs, performs checks under the global rate limit, writes results idempotently. |
| **PostgreSQL** | Authoritative application state (batches, URLs, counters). |
| **Redis** | BullMQ backing store, global rate-limiter coordination, pub/sub fan-out for live updates. |

## Core Guarantees

### Global rate limit

URLPulse enforces a maximum of **10 outbound HTTP requests per second across the entire system**. The limiter is Redis-coordinated so the limit holds regardless of how many worker processes are running - it is never `10 × workerCount`. See [`docs/03-backend/rate-limiting.md`](./docs/03-backend/rate-limiting.md).

### Concurrency

At most **5 URL checks are in flight at once**. Concurrency and the request-rate limit are **separate constraints** - a worker acquires both a concurrency slot and a rate-limit permit before starting an outbound request.

### Source of truth

**PostgreSQL is authoritative.** Redis, BullMQ, browser state, and live events are infrastructure and transport - they must not replace durable state. Any batch page can be opened directly or refreshed and fully reconstructed from the API.

### Idempotency

Jobs are designed for at-least-once delivery. Repeated execution of the same job must not double-count progress or corrupt state; state transitions are applied conditionally in the database. See [`docs/03-backend/retries-and-idempotency.md`](./docs/03-backend/retries-and-idempotency.md).

### Live updates

Live progress is delivered over **Server-Sent Events**, chosen because updates are one-directional (server → client) and SSE reconnects natively. Multiple API instances fan out through Redis pub/sub. On connect or reconnect the client refetches the authoritative snapshot from the API, so the transport is never the source of truth. See [`docs/04-frontend/live-updates.md`](./docs/04-frontend/live-updates.md).

### Authentication & ownership

Minimal auth via **Better Auth** mounted on the Fastify API, with PostgreSQL-backed sessions (no in-memory state; valid across restarts and multiple API instances). Every batch belongs to the authenticated user; ownership is derived from the session (never the client) and enforced at the data boundary, so a user only ever sees or changes their own batches and cross-user access returns `404`. See [`docs/03-backend/authentication.md`](./docs/03-backend/authentication.md).

## Tech Stack

- **Next.js** + **React** + **TypeScript** - web UI
- **Fastify** + **TypeScript** - API
- **PostgreSQL** - durable application state
- **Redis** - coordination, rate limiting, pub/sub
- **BullMQ** - background job processing
- **Docker** / **Docker Compose** - local infrastructure

## Project Structure

pnpm workspace monorepo:

```text
URLPulse/
├── apps/
│   ├── web/              # Next.js App Router UI (@urlpulse/web)
│   ├── api/              # Fastify API + SQL migrations (@urlpulse/api)
│   └── worker/           # BullMQ worker (@urlpulse/worker)
├── packages/
│   ├── types/            # Shared domain/API types + zod schemas (@urlpulse/types)
│   └── config/           # Server env loading/validation (@urlpulse/config)
├── docs/                 # Product, architecture, backend, frontend, infra, quality
├── public/               # Canonical brand assets (served copy lives in apps/web/public)
├── docker-compose.yml    # Local PostgreSQL + Redis
├── pnpm-workspace.yaml
├── package.json          # Root scripts (dev, build, lint, typecheck, test)
├── tsconfig.base.json
└── .env.example
```

> **Status:** The runnable skeleton exists - web, API, and worker start; the API health endpoint works; the schema migrates. URL health-checking logic (batch creation, processing, live updates) is the next phase; the batch endpoints currently return `501 Not Implemented`.

## Getting Started

### Prerequisites

- Node.js (LTS)
- [pnpm](https://pnpm.io/)
- Docker + Docker Compose

### Setup

```bash
git clone https://github.com/niranjansah87/URLPulse.git
cd URLPulse

pnpm install
cp .env.example .env

# start local infrastructure (PostgreSQL + Redis)
docker compose up -d

# create the database schema
pnpm db:migrate

# run web + api + worker together
pnpm dev
```

Local URLs:

- Web UI: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Environment Variables

See [`.env.example`](./.env.example) for the full list. Never commit a real `.env`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `API_PORT` | Fastify API port (default `4000`) |
| `RATE_LIMIT_RPS` | Global outbound request cap (default `10`) |
| `MAX_CONCURRENCY` | Max URL checks in flight (default `5`) |
| `MAX_RETRIES` | Retry attempts for transient failures (default `3`) |
| `BATCH_LIST_CACHE_SECONDS` | Batch-list cache lifetime (default `30`) |
| `BETTER_AUTH_SECRET` | Signs session cookies; **required in production** (dev/test has an insecure default). Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public API base URL where Better Auth is mounted (default `http://localhost:4000`) |
| `WEB_ORIGIN` | Web origin trusted for credentialed CORS (default `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | Browser-facing API base URL (web) |
| `API_INTERNAL_URL` | Loopback API base used by Next.js Server Components |

## Development

```bash
pnpm install          # install all workspace dependencies

pnpm dev              # run web + api + worker in parallel
pnpm dev:web          # Next.js only
pnpm dev:api          # Fastify API only
pnpm dev:worker       # BullMQ worker only

pnpm db:migrate       # apply SQL migrations

pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit across all packages
pnpm test             # Vitest across all packages
pnpm build            # next build (web) + typecheck (api/worker/packages)
```

The API and worker run under `tsx` in both development and this scaffold phase, so they have no separate compile step; `pnpm build` runs `next build` for the web app and type-checks the rest.

## Testing

Testing focuses on the system guarantees most likely to break under load and concurrency:

- Global rate limit (including across **multiple** workers)
- Concurrency cap (5 in flight)
- Retry and exponential backoff
- Idempotent job execution (duplicate delivery)
- Cancellation of queued and in-flight jobs
- Retry-failed (only failed URLs re-run)
- Live-update recovery after dropped SSE connections
- Batch-list cache behavior and invalidation

See [`docs/06-quality/testing.md`](./docs/06-quality/testing.md) and [`docs/06-quality/edge-cases.md`](./docs/06-quality/edge-cases.md).

## Documentation

Full documentation index: [`docs/README.md`](./docs/README.md).

## Security

See [`SECURITY.md`](./SECURITY.md). URLPulse makes outbound HTTP requests to user-supplied URLs, so **SSRF is a primary consideration** - the security policy separates current controls from recommended production hardening.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Changes affecting the database, queues, workers, rate limiting, concurrency, live updates, or API contracts must update the relevant documentation.

## License

[MIT](./LICENSE)

## Author

**Niranjan Sah** - [niranjansah87.com.np](https://niranjansah87.com.np/) · [github.com/niranjansah87](https://github.com/niranjansah87)
