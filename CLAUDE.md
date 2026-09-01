
# URLPulse - Claude Code Instructions

## 1. Project Overview

URLPulse is a bulk URL health-checking application.

Users can submit a list of URLs or upload a CSV file. The system processes each URL independently in the background and records the health-check result.

For every URL, the system must capture at minimum:

- Final HTTP status code
- Response time
- Page title, when available

The application consists of:

- Next.js + TypeScript frontend
- Fastify + TypeScript API
- PostgreSQL for persistent application state
- Redis for shared infrastructure
- BullMQ for background job processing
- Separate worker process for URL checking

URLPulse is a standalone, production-oriented product.

The implementation must prioritize correctness, reliability, clarity, and deliberate architectural decisions over unnecessary features or visual polish.

---

# 2. Primary Engineering Goal

Build a production-minded system that satisfies URLPulse's functional and technical requirements while keeping the architecture understandable and appropriately scoped.

Do not add complexity unless it solves a real requirement, reliability problem, or clearly documented engineering concern.

Prefer:

- Simple designs that are correct
- Explicit state transitions
- Strong typing
- Idempotent operations
- Clear separation of responsibilities
- Testable components
- Well-documented trade-offs

Avoid:

- Over-engineering
- Unnecessary abstractions
- Premature optimization
- Features outside the defined product scope
- Hidden global state
- UI state being treated as authoritative application state

---

# 3. Required Technology Stack

The following technologies are required and must not be replaced:

### Frontend

- Next.js
- React
- TypeScript

### Backend

- Node.js
- TypeScript
- Fastify

### Data

- PostgreSQL
- Redis

### Background Processing

- BullMQ

The worker must run as a separate process from the API server.

Other libraries may be introduced when they provide a clear benefit, but every significant dependency should have a reason to exist.

---

# 4. Core Functional Requirements

The implementation must support:

## Batch Submission

Users must be able to:

- Paste a list of URLs
- Upload a CSV containing URLs

The batch and its URLs must be persisted in PostgreSQL before URL checking begins.

Each URL must be represented by its own background job.

The API response must provide the client with enough information to track the created batch.

---

## Background Processing

Workers must:

- Run separately from the API process
- Process URLs independently
- Maintain a global maximum of 10 HTTP requests per second
- Maintain a maximum of 5 URL checks in flight
- Retry transient failures up to 3 times
- Use exponential backoff for retries

The 10 requests/second limit is GLOBAL across the entire system.

It must NOT become:

- 10 requests/second per worker
- 10 requests/second per process
- 10 requests/second per API instance

The design must continue satisfying this requirement when multiple worker processes are running.

---

## Live Updates

The batch detail page must update as URL checks complete.

Requirements:

- No manual refresh should be required during normal operation
- Refreshing the page must reconstruct the correct state
- Multiple API instances must be supported
- Dropped client connections must recover correctly
- The live-update transport must not become the source of truth

The transport mechanism must be chosen deliberately and documented.

---

## Batch Views

The application must provide:

### Batch List

A view showing existing batches.

### Batch Detail

A dedicated URL for each batch.

A batch URL must work when opened directly in a new browser tab with no previous client state.

The correct state must be displayed whether the batch is:

- Still processing
- Completed
- Failed
- Cancelled

---

## Batch Controls

### Cancel Batch

Cancellation must correctly handle:

- Queued jobs
- Jobs already in flight

Persisted state must remain consistent with what the user sees.

### Retry Failed

Retrying a batch must:

- Re-run only URLs that ended in a failed state
- Never re-run successful URLs unnecessarily
- Maintain consistent persisted state

---

## Caching

The batch-list endpoint must use a 30-second cache.

However, cached data must not become visibly stale after important mutations such as:

- Creating a batch
- A batch changing state

Cache invalidation or another appropriate strategy must be used to preserve the user-visible correctness requirement.

---

# 5. Source of Truth

PostgreSQL is the authoritative source of truth for application state.

Do not treat:

- React state
- Next.js cache
- SSE state
- Redis state
- BullMQ job state

as the authoritative representation of batch or URL state.

Redis/BullMQ is infrastructure for background job orchestration and distributed coordination.

When correctness matters, persisted PostgreSQL state wins.

The UI should be able to reconstruct the complete batch state from the API/database after:

- Page refresh
- New tab
- Browser reconnect
- API restart
- Worker restart

---

# 6. State Management

All important state transitions must be explicit.

Do not modify status fields arbitrarily from multiple parts of the codebase.

State transitions should be centralized or otherwise constrained so that invalid transitions are difficult to introduce.

Before implementing a state transition, determine:

1. Current state
2. Allowed next states
3. Who is allowed to perform the transition
4. What database update is required
5. What happens if the operation races with another operation
6. What happens if the process crashes

Document the final state machine in:

`docs/03-backend/job-lifecycle.md`

---

# 7. Idempotency

Idempotency is a first-class requirement.

BullMQ jobs may be retried or potentially executed more than once.

The system must not incorrectly:

- Increment counters twice
- Mark a successful URL as failed
- Re-run successful work unnecessarily
- Corrupt batch progress
- Produce inconsistent batch state

Database updates should be designed so duplicate execution is safe.

Never assume:

> "This job will only ever run once."

Design for at-least-once job execution.

---

# 8. Global Rate Limiting

This is one of the most important requirements in the project.

The system must enforce:

**Maximum 10 HTTP requests per second globally.**

A local in-memory limiter is insufficient because multiple worker processes may exist.

Do not implement:

```text
Worker 1 → 10 req/sec
Worker 2 → 10 req/sec
```

Instead, coordinate through shared Redis-backed state so the global limit holds regardless of worker count. See `docs/03-backend/rate-limiting.md`.

---

# 9. Repository Layout

pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`).

```text
apps/web          Next.js App Router UI (@urlpulse/web)
apps/api          Fastify API + SQL migrations (@urlpulse/api)
apps/worker       BullMQ worker (@urlpulse/worker)
packages/types    Shared domain/API types + zod schemas (@urlpulse/types)
packages/config   Server env loading/validation, server-only (@urlpulse/config)
packages/outbound Global Redis rate limiter + SSRF guard (@urlpulse/outbound)
docs/             Product, architecture, backend, frontend, infra, quality docs
public/           Canonical brand assets; served copy in apps/web/public (ADR-029)
docker/ nginx/  Production Dockerfiles + reference host-Nginx config
scripts/deploy.sh  One-shot deploy (preflight, host-nginx, docker build/up, health)
docker-compose.prod.yml  Production containers (web/api/worker); PostgreSQL, Redis, Nginx external
```

The system is fully implemented: real batch endpoints, a BullMQ worker performing
real HTTP health checks, the Redis-coordinated global rate limiter and concurrency
limiter, idempotent conditional state transitions, SSE live updates with
cross-instance pub/sub fan-out, and version-keyed batch-list caching. Documentation
under `docs/` remains the source of design intent.

---

# 10. Documentation Rules

- `docs/README.md` is the documentation index.
- Preserve existing technical reasoning; do not replace detailed documents with shorter generic versions.
- When behavior affecting database, queues, workers, rate limiting, concurrency, live updates, or API contracts changes, update the relevant document in the same change.
- Document behavior, invariants, and trade-offs - not line-by-line code.

---

# 11. Rules for Coding Agents

These are hard invariants. Violating them is a correctness bug.

1. **Inspect before modifying.** Read existing docs and code first.
2. **Do not overwrite existing architectural documentation blindly.** Preserve technical decisions unless proven wrong.
3. **PostgreSQL is authoritative application state.**
4. **Redis/BullMQ represent work and coordination**, never authoritative application state.
5. **Never implement a worker-local substitute for the global 10 req/s limiter.** It must be Redis-coordinated and hold across all workers.
6. **Preserve the maximum of 5 concurrent checks in flight.** Concurrency and rate limiting are separate constraints.
7. **Preserve idempotency.** Duplicate job execution must not double-count progress or corrupt state. Use conditional state transitions.
8. **Respect cancellation races.** A stale worker must never overwrite an accepted cancellation.
9. **Update documentation when architectural behavior changes.**
10. **Do not add dependencies without justification.**
11. **Prefer simple, auditable implementations** over fashionable complexity.
12. **Do not create fake/demo data** when implementing real functionality.
13. **Do not claim functionality that is not implemented.** Distinguish implemented from planned.

---

# 12. Development Commands

```bash
pnpm install                     # install workspace deps
# PostgreSQL + Redis are external: point DATABASE_URL / REDIS_URL at your own
pnpm db:migrate                  # apply SQL migrations (apps/api/src/migrations)
pnpm dev                         # web + api + worker in parallel
pnpm dev:web | dev:api | dev:worker
pnpm lint | typecheck | test | build
```

API and worker run under `tsx` (no separate build step this phase). `pnpm build`
runs `next build` for web and `tsc --noEmit` for the rest. Migrations are plain
SQL files applied by a minimal runner (`apps/api/src/migrate.ts`) - no ORM.
