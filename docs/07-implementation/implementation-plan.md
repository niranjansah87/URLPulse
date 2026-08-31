# URLPulse Implementation Plan

**Version:** 1.0
**Status:** Active
**Audience:** Engineers/agents implementing URLPulse from the current scaffold.

---

## 1. Purpose

This document converts the finalized architecture (`docs/01`–`docs/06`, and the decisions in
`docs/02-architecture/decisions.md` / `consistency-check.md`) into a concrete, dependency-ordered
implementation roadmap. It records **what already exists in the repository**, then defines the
remaining phases with explicit scope, sequencing, and acceptance criteria.

It is not a new architecture. Where a decision is needed it already lives in an ADR; this plan
points at the ADR rather than re-deciding. If you find a gap, resolve it via an ADR, not inline.

### Invariant register (never silently drop one)

Every acceptance criterion below tags the invariants it protects. These come straight from the
architecture and the review brief.

| ID | Invariant | Source |
|----|-----------|--------|
| INV-1 | PostgreSQL is the sole source of truth | ADR-001 |
| INV-2 | API and worker are separate processes | ADR-015 |
| INV-3 | Global concurrency = 5 across **all** workers | ADR-007/021/022 |
| INV-4 | Global outbound rate = 10/sec across **all** workers | ADR-006 |
| INV-5 | Max attempts = 4 (initial + 3), **per round** | ADR-024, retries.md §2 |
| INV-6 | Retry classification is explicit (retryable vs permanent) | retries.md §3 |
| INV-7 | Duplicate job execution cannot double-count | ADR-008/009 |
| INV-8 | Cancellation cannot be overwritten by a stale worker | ADR-011/026 |
| INV-9 | retry-failed operates only on FAILED URLs | ADR-024, api.md §15 |
| INV-10 | SSE is not the source of truth | ADR-005 |
| INV-11 | SSE reconnect/missed events recover from authoritative state | live-updates.md §11/§20 |
| INV-12 | Batch-list cache TTL = 30s | ADR-012 |
| INV-13 | Cache invalidation prevents obviously-stale reads after mutations | ADR-012, edge-cases §27 |
| INV-14 | Multi-worker behavior is tested | testing.md §8/§9 |
| INV-15 | Important failure modes are tested | edge-cases.md, testing.md §23 |
| INV-16 | Next.js Server/Client boundaries are intentional | ADR-014 |
| INV-17 | Shared types/contracts used where appropriate | ADR-013 |
| INV-18 | Docker + local dev runs the whole system | local-development.md |
| INV-19 | Graceful shutdown supported | edge-cases §39 |
| INV-20 | SSRF/arbitrary-fetch addressed before production | edge-cases §37 |

---

## 2. Current Repository State

Determined by inspecting the working tree on `main` (the scaffold is committed). Verified against
`apps/`, `packages/`, migrations, and config, not assumed from docs.

### Completed

- **Workspace/tooling (Phase 0).** pnpm@9.15.0 workspace (`pnpm-workspace.yaml`: `apps/*`,
  `packages/*`), Node ≥20, ESM. Root scripts: `dev` (parallel), `dev:web|api|worker`, `build`,
  `lint`, `typecheck`, `test`, `db:migrate`. Flat ESLint + Prettier, `tsconfig.base.json` +
  per-package `tsconfig.json`. Stack pinned in **ADR-030** (postgres.js, ioredis, BullMQ, zod, `tsx`,
  plain-SQL migrations - no ORM).
- **Local infrastructure (Phase 1).** `docker-compose.yml`: `postgres:16-alpine` and
  `redis:7-alpine`, both with healthchecks and named volumes. App processes run on the host via
  `pnpm` (not containerized in dev). `.env.example` documents every variable.
- **Database schema (Phase 2).** `apps/api/src/migrations/0001_init.sql` creates `batches` and
  `urls` exactly per `database.md`: status CHECK constraints (both enums), non-negative counter
  constraints, `completed+failed+cancelled <= total` invariant, FK `ON DELETE RESTRICT`, and the
  three indexes (`batches(created_at DESC)`, `urls(batch_id)`, `urls(batch_id,status)`).
  Applied by a minimal forward-only runner (`apps/api/src/migrate.ts`).
- **Shared contracts (Phase 3, core).** `packages/types` is **zod-first** (types inferred from
  schemas): `batchStatus`/`urlStatus` enums, `UrlResult`/`BatchSummary`/`BatchDetail` DTOs,
  `createBatchRequest`, `ApiSuccess`/`ApiError` envelopes, `SseBatchUpdated` + `SSE_EVENT_BATCH_UPDATED`,
  `URL_CHECK_QUEUE` name and `urlCheckJobData` payload - the single producer/consumer contract.
- **Config (Phase 0/1).** `packages/config` - zod server-env loader, fail-fast, server-only. All
  system knobs centralized: `RATE_LIMIT_RPS=10`, `MAX_CONCURRENCY=5`, `MAX_RETRIES=3`,
  `BATCH_LIST_CACHE_SECONDS=30`, `DATABASE_URL`, `REDIS_URL`, `API_PORT`.
- **API skeleton (Phase 4, partial).** `apps/api/src/server.ts` (bootstrap), `routes/health.ts`,
  `routes/batches.ts` registering **all six** canonical endpoints with the exact `api.md` names,
  returning `501` (POST `/batches` already wires `createBatchRequest` validation → `400`).
  Libs: `db.ts` (postgres.js), `redis.ts` (ioredis, `lazyConnect`, `maxRetriesPerRequest:null` for
  BullMQ), `queue.ts` (BullMQ producer handle), `errors.ts` (`NotImplementedError`).
- **Worker skeleton (Phase 7, partial).** `apps/worker/src/worker.ts` (bootstrap),
  `jobs/url-check.ts` - a validating **no-op** that parses the payload and performs **no DB writes**
  (safe by construction).
- **Web skeleton (Phase 13, partial).** Next.js App Router: `layout.tsx`, `page.tsx`,
  `batches/page.tsx`, `batches/[id]/page.tsx` (+`loading.tsx`), `AppShell`, `ThemeToggle`,
  `lib/api.ts` client, brand assets served locally (ADR-029).
- **Test harness.** `server.test.ts`, `jobs/url-check.test.ts`, `config` and `types` tests exist
  (runner wired via `pnpm test`).

### Partially completed

- **Contracts** - missing: CSV request path, list pagination `meta` schema, `retry-failed`
  request/response shape, a shared `ErrorCode` enum, an SSE-backing `version` source. (P3 from
  `consistency-check.md`: `batches` has no `version` column yet.)
- **API foundation** - bootstrap + route surface exist; a global error handler, not-found handler,
  request-id/logging config, and the cache layer are not yet confirmed wired.
- **Worker** - consumes the queue name but does no real work; no rate limiter, no concurrency
  lease, no HTTP checker, no persistence, no graceful shutdown.
- **Web** - pages render a shell; not wired to live API data, no SSE, no forms submitting to the API.

### Not started

Real batch create/list/get logic and enqueue wiring · CSV parsing · URL health checking · global
rate limiter · global concurrency lease · retry/backoff logic · cancellation logic · SSE endpoint +
Redis pub/sub · batch-list cache + invalidation · frontend data flow · the bulk of the test suite ·
production hardening (structured logging, SSRF, resource limits, prod Docker) · CI workflows
(`.github/workflows` is absent).

**Net:** Phases 0–2 are done, Phase 3 and 4 are partially done. **Implementation resumes at Phase 5
(Batch APIs) + Phase 6 (Queue), which is Milestone 4.**

---

## 3. Implementation Principles

- **PostgreSQL is truth (INV-1).** Redis/BullMQ/SSE/React are infrastructure or projection, never
  authoritative. Any correctness decision resolves against the DB.
- **API and worker stay independently deployable (INV-2).** No shared in-process state; they
  communicate only through PostgreSQL and Redis.
- **Contracts are shared and zod-first (INV-17).** Every request/response/job payload has a zod
  schema in `packages/types`; types are inferred, never hand-duplicated.
- **State transitions are conditional and atomic.** `UPDATE … WHERE status = <expected>`; a
  zero-row result means "someone else won" - handle it, never assume ownership (INV-7/8).
- **Fail safely, never silently.** On Redis/PG unavailability, pause rather than bypass a global
  control (ADR-020). Typed errors, no swallowed rejections (`.claude/rules/error-handling.md`).
- **Deterministic over clever.** Prefer a small auditable Lua script / SQL transaction over a
  fashionable abstraction.
- **Test the invariants, not the lines (INV-14/15).** Multi-worker/failure tests outrank coverage %.
- **No premature abstraction.** Repositories/services exist because there are real callers; don't
  add interfaces with one implementation.
- **Distinguish implemented from planned.** Never return fake data from a stubbed path - return
  `501`/`NotImplementedError` until the real logic lands (matches current scaffold).

---

## 4. Target Repository Structure

The scaffold already matches the target; keep it.

```text
apps/
├── web/      Next.js App Router UI            (@urlpulse/web)
│   ├── app/            routes (Server Components by default)
│   ├── components/     shared UI (Client Components where interactive)
│   └── lib/            api client, hooks, SSE client
├── api/      Fastify API + SQL migrations     (@urlpulse/api)
│   └── src/
│       ├── routes/         HTTP surface (thin; validation + delegation)
│       ├── services/       application logic / orchestration
│       ├── repositories/   SQL access (postgres.js), transaction boundaries
│       ├── lib/            db, redis, queue, cache, rate-limit, env, errors
│       └── migrations/     NNNN_name.sql (forward-only, applied by migrate.ts)
└── worker/   BullMQ worker                     (@urlpulse/worker)
    └── src/
        ├── jobs/           url-check processor
        └── lib/            redis, rate-limit, concurrency, http-checker, env

packages/
├── types/    shared zod schemas + inferred types + queue/SSE contracts (@urlpulse/types)
└── config/   server-only env loading/validation                        (@urlpulse/config)

docs/            design intent (authoritative for behavior)
docker-compose.yml   local PostgreSQL + Redis
```

Rate-limit, concurrency, and cache logic live in **`apps/api/src/lib`** and **`apps/worker/src/lib`**;
the enforcement point for rate/concurrency is the worker (immediately before the outbound HTTP call).

---

## 5. Phase 0 - Foundation ✅ DONE

Delivered: pnpm workspace, TS strict, ESLint flat + Prettier, `packages/config` env loader, root
dev/build/lint/typecheck/test/db:migrate scripts.

**Remaining for a later phase:** CI workflow (`.github/workflows/ci.yml`) running
`lint → typecheck → test → build` - deferred to Phase 19/20.

**Acceptance (met):** `pnpm install`, `pnpm lint`, `pnpm typecheck` succeed on a clean clone.

---

## 6. Phase 1 - Infrastructure ✅ DONE

Delivered: `docker-compose.yml` (postgres:16, redis:7, healthchecks, volumes), `.env.example`
covering all vars, host-run app processes.

**Acceptance (met):** `docker compose up -d` brings both services healthy; app processes read
config from `.env` and fail fast on missing/invalid vars (INV-18).

---

## 7. Phase 2 - Database ✅ DONE (extend as features need columns)

Delivered: `0001_init.sql` (schema, enums-as-CHECK, counter constraints, FK, indexes), `migrate.ts`.

**Follow-up migrations (new files only - never edit `0001`):**
- `0002_batch_version.sql` - add `batches.version integer NOT NULL DEFAULT 0` to back the SSE
  `version` field (INV-11; resolves `consistency-check.md` P3-1). Bump it in every batch-mutating
  transaction.

**Acceptance:** `pnpm db:migrate` on a fresh DB creates the schema; re-running is a no-op
(idempotent `IF NOT EXISTS` / tracked migration). Constraints reject negative counters and
`completed+failed+cancelled > total`.

---

## 8. Phase 3 - Shared Contracts 🟡 PARTIAL

Extend `packages/types` (do not fork types into apps):

- `createBatchCsv` handling contract (multipart is transport, but define the parsed result +
  per-row validation error shape).
- `listBatchesQuery` (`page`, `pageSize`) and a `meta` pagination schema (`page`, `pageSize`, `total`)
  matching `api.md §8`.
- `retryFailedResponse` (which URL ids were claimed).
- `ErrorCode` enum (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `NOT_IMPLEMENTED`,
  `INTERNAL_ERROR`, …) so API and web agree on codes.
- Backing source for `SseBatchUpdated.version` (the new `batches.version`).

**Acceptance:** every API request/response and job payload references a `@urlpulse/types` schema
(INV-17); `pnpm --filter @urlpulse/types test` covers enum/DTO round-trips; no app re-declares a
domain type locally.

---

## 9. Phase 4 - Fastify API Foundation 🟡 PARTIAL

Finish the bootstrap:

- Global error handler → `ApiError` shape by `ErrorCode`; map `NotImplementedError`→501,
  zod→400, not-found→404, state conflict→409, uncaught→500 (no stack leak;
  `.claude/rules/error-handling.md`).
- `setNotFoundHandler` returning the `ApiError` envelope.
- Structured logging with a per-request `requestId` (Fastify `genReqId`); redact URL contents where
  noisy (`api.md §23`).
- Register the queue/redis/db as Fastify decorators with lifecycle hooks; close them `onClose` (INV-19).

**Acceptance:** health endpoint returns readiness (DB + Redis reachable); a malformed request yields
a consistent `ApiError`; server starts and stops cleanly (no leaked connections).

---

## 10. Phase 5 - Batch APIs 🔜 NEXT

Implement the create/list/get logic behind the existing routes (names are fixed by `api.md` - do
not rename). Fill `services/batches.ts` and `repositories/batches.ts`.

- **POST `/batches`** - validate (JSON `{urls[]}` already wired; add CSV multipart parse →
  per-row validation, reject the whole batch on malformed input, `api.md §7`). In **one DB
  transaction**: insert `batches` (`PENDING`, `total_count`) + `urls` rows, commit, **then** enqueue
  (Phase 6). Return `201 {id,status,totalCount}`. Duplicate-URL rows are kept, not deduped
  (`database.md §8`). Invalidate the batch-list cache (Phase 15).
- **GET `/batches`** - paginated (`page`,`pageSize`), served through the 30s cache (INV-12).
- **GET `/batches/:batchId`** - full `BatchDetail` (counters + URL rows) reconstructed from the DB,
  works cold with no client state (INV-1/11).

**Acceptance (tag INV-1/17):** create persists batch+URLs **before** any job exists; cold GET after
a server restart returns correct state; invalid/empty input → `400`; CSV and JSON paths produce
identical persisted shapes; API integration tests green.

---

## 11. Phase 6 - Queue Integration 🔜 NEXT (with Phase 5)

Wire enqueue and address the DB/queue consistency window explicitly (ADR-028).

- After the create transaction commits, enqueue one `url-check` job per URL (`urlCheckJobData` =
  `{batchId,urlId}` only - identifiers, never mutable state, `api.md §22`).
- Configure the queue: `attempts: MAX_RETRIES+1` (=4, INV-5), `backoff:{type:'exponential',delay}`,
  `removeOnComplete`/`removeOnFail` retention policy.
- **Consistency (ADR-028):** DB-commit-then-enqueue, plus a bounded **reconciliation sweep** that
  re-enqueues `PENDING` URLs with no active job older than a threshold. Do **not** build a
  transactional outbox.

**Acceptance (INV-1):** if enqueue fails after commit, the sweep re-enqueues and no URL is lost; a
job whose URL/batch row is missing is skipped safely (`edge-cases §33`); enqueued payload contains
only ids.

---

## 12. Phase 7 - Worker 🟡 skeleton exists

Replace the no-op processor with real execution (still no rate/concurrency yet - those are 8/9):

- Bootstrap a BullMQ `Worker` on `URL_CHECK_QUEUE` (INV-2, separate process).
- **Claim** conditionally: `UPDATE urls SET status='PROCESSING', started_at=now(),
  attempt_count=attempt_count+1 WHERE id=$1 AND status='PENDING'`; zero rows → inspect state, do not
  assume ownership (ADR-023).
- Check cancellation/batch state before any outbound work (`job-lifecycle §13-15`).
- HTTP health check with a **finite timeout**, capture final status / response time / page title;
  bounded redirects (`edge-cases §5/§6`).
- Persist result transactionally (Phase 10 rules); publish state-change event (Phase 12).
- **Graceful shutdown (INV-19):** stop accepting jobs, let in-flight finish/release, close
  connections.

**Acceptance:** a single-worker run drives URLs PENDING→PROCESSING→SUCCESS/FAILED and persists
result columns; a missing/terminal URL is skipped; SIGTERM drains cleanly.

---

## 13. Phase 8 - Global Rate Limiting (10/sec) 🔴

Enforce **globally** in the worker, immediately before the outbound HTTP call (`rate-limiting.md`).

- Redis-backed atomic limiter (Lua script or equivalent) keyed on a shared key (Phase: pick
  **sliding-window**, `consistency-check.md P2-1`); admit only when window count < `RATE_LIMIT_RPS`.
- Retries consume a fresh permit (`rate-limiting §13`). Network failures still consumed a permit
  (`§14`). Redis down → do not start the request (ADR-020), never a local fallback.

**Acceptance (INV-4/14):** a test with **multiple worker processes** and many jobs records outbound
timestamps and asserts ≤10/sec globally; a per-process limiter would fail this test.

---

## 14. Phase 9 - Global Concurrency (5) 🔴

Enforce **globally**, distinct from rate (ADR-007/021/022).

- Redis distributed semaphore of `MAX_CONCURRENCY` slots, acquired before the request, released in
  `finally`. **Slots are leases with a TTL > max request timeout** so a crashed worker's slot
  auto-reclaims (ADR-022) - this closes the P0 leak identified in the review.
- Acquisition order: concurrency slot then rate permit (`rate-limiting §8`); release both on timeout,
  abort, failure, or cancel (`cancellation §15`).
- Redis down → pause, no local fallback.

**Acceptance (INV-3/14/19):** multi-worker test asserts max in-flight ≤5 globally; a
**simulated worker crash** test shows capacity returns to 5 after the lease TTL (no permanent leak).

---

## 15. Phase 10 - Retries + Idempotency 🔴

Follow `retries-and-idempotency.md` + ADR-023/024.

- Central retry **classification** (INV-6): retryable (timeout, reset, DNS-temp, 429, selected 5xx)
  vs permanent (invalid URL, unsupported scheme, deterministic). Documented status/error mapping.
- On retryable failure: reset URL `PROCESSING→PENDING` and re-throw so BullMQ redelivers after
  backoff; next delivery re-claims and increments `attempt_count` (ADR-023). Cap = 4 per round (INV-5).
- All terminal writes conditional on `status='PROCESSING'`; counter increments happen **only** when
  the row transition actually occurred, in the same transaction (INV-7). Batch terminal transition
  owned by the finishing worker with precedence `CANCELLED > FAILED > COMPLETED` (ADR-025).

**Acceptance (INV-5/6/7/15):** retryable-then-success reaches `attempt_count=4`; exhaustion →
`FAILED`, no 5th attempt; duplicate delivery of the same job leaves counters unchanged (one
increment); permanent failure is not retried.

---

## 16. Phase 11 - Cancellation 🔴

Follow `cancellation.md` + ADR-011/026/027.

- **POST `/batches/:batchId/cancel`** - conditional `UPDATE batches SET status='CANCELLED'
  WHERE status IN ('PENDING','PROCESSING')`; in the same tx bulk-cancel non-terminal URLs; invalidate
  cache; publish. Idempotent (repeat → current state, `api.md §14`).
- Queued jobs check state and skip; in-flight requests abort where practical (`AbortController`),
  release resources; a stale completion loses the `WHERE status='PROCESSING'` race (INV-8).
- Cancellation stops retries (`cancellation §18`). `retry-failed` on a CANCELLED batch → **409**
  (ADR-027).

**Acceptance (INV-8/15):** cancel-of-PENDING and cancel-of-PROCESSING both terminal; a worker that
finishes after cancel cannot revert it (race test both orderings); double-cancel is stable.

---

## 17. Phase 12 - SSE / Live Updates 🔴

Follow `live-updates.md` (INV-10/11).

- Worker publishes small `batch.updated {batchId,version}` to Redis pub/sub **after** DB commit
  (ordering, `live-updates §7`).
- **GET `/batches/:batchId/events`** - `text/event-stream`; each API instance subscribes to Redis and
  forwards to its locally connected clients (multi-instance, `scaling §8`). Heartbeat comment to
  survive proxies. Events are **notifications only** - client refetches `GET /batches/:batchId`
  (resolve `consistency-check.md P2-4` in favor of GET-then-subscribe, not pushing a snapshot).
- Tolerate duplicate/missed/out-of-order events; reconcile on (re)connect (INV-11).

**Acceptance (INV-10/11/14):** worker update reaches a client on a **different** API instance;
disconnect-during-update then reconnect yields correct state; duplicate events don't double-count;
killing SSE entirely still lets `GET /batches/:batchId` return correct state.

---

## 18. Phase 13 - Frontend Foundation 🟡 skeleton exists

- Server Components by default; Client Components only for interactivity/SSE (INV-16, ADR-014).
- `lib/api.ts` typed client using `@urlpulse/types`; `NEXT_PUBLIC_API_URL` only (no secrets in the
  browser bundle).
- Layout, navigation, loading/error/empty primitives.

**Acceptance:** pages fetch real API data server-side on cold load; no batch state held only in the
browser (INV-1/16).

---

## 19. Phase 14 - Batch Creation UI 🔴

Manual textarea (one URL/line) + CSV upload; client validation for UX, backend authoritative;
loading/error states; disable double-submit (`edge-cases §34`); navigate to detail on success.

**Acceptance:** valid submit creates a batch and routes to its detail; invalid input shows backend
validation errors; repeated clicks don't create duplicate batches.

---

## 20. Phase 15 - Batch List 🔴

Recent batches, pagination per `api.md §8`, served via the **30s cache** (INV-12) with
**invalidation on create and relevant state change** (INV-13); loading/error/empty states.

**Acceptance (INV-12/13):** a freshly created batch is visible immediately (not hidden by stale
cache); cache hit within TTL, miss after; multi-instance cache is shared (Redis), not process-local
(`scaling §11`).

---

## 21. Phase 16 - Batch Detail 🔴

Progress (`completed/total`), URL results table (status, HTTP status, latency, title, error,
attempts), cancel + retry-failed actions (shown only when meaningful), CSV **download** of results.

**Acceptance (INV-9):** retry-failed button appears only with eligible FAILED URLs and requeues only
those; cancel disabled/hidden on terminal batches; download reflects persisted state.

---

## 22. Phase 17 - Live Progress UX 🔴

SSE client with reconnect + backoff, refetch-on-reconnect, LIVE/RECONNECTING/OFFLINE indicator;
refresh-safe; multiple tabs safe.

**Acceptance (INV-10/11):** progress advances without manual refresh; refresh/new-tab reconstructs
state; connection loss recovers and reconciles.

---

## 23. Phase 18 - Testing

Map to `testing.md` invariants. Minimum suite:

- Unit: URL validation/normalization, retry classification (INV-6), backoff, progress math, state-transition rules.
- DB integration: conditional updates, atomic counters, cancellation race, retry-failed claim.
- API integration: all six endpoints, validation, status codes, idempotent mutations, cache behavior.
- Worker integration: claim, success/failed persistence, terminal-skip.
- **Multi-worker (INV-14):** concurrency ≤5 (Phase 9), rate ≤10/sec (Phase 8) - must use ≥2 worker
  processes so a per-process limiter cannot pass.
- Retries/idempotency (INV-5/7), cancellation races (INV-8), SSE reconnect (INV-11), cache
  invalidation (INV-12/13), worker-crash slot recovery (INV-3/19), queue/DB reconciliation (Phase 6).
- E2E: happy path, partial-failure→retry, cancellation, refresh (`testing.md §22`).

**Acceptance:** each invariant INV-1…INV-15 has at least one failing-before/passing-after test.

---

## 24. Phase 19 - Production Hardening

Structured logging + request/job correlation ids; graceful shutdown across api+worker (INV-19);
readiness/liveness endpoints; **SSRF protections (INV-20):** HTTP(S)-only, block loopback, RFC-1918,
link-local `169.254/16`, cloud metadata `169.254.169.254`, re-check resolved IP, bound redirects;
resource limits (max URLs/batch, CSV size, URL length, SSE connection cap, `edge-cases §38`);
config validation at startup (done in `config`); production Docker images for api/worker/web; CI
(`lint→typecheck→test→build`).

**Acceptance (INV-20):** a URL resolving to a private/metadata address is refused before any request;
processes drain on SIGTERM; CI is green.

---

## 25. Phase 20 - Final Verification

Full `pnpm test` green; `pnpm build`, `pnpm lint`, `pnpm typecheck` clean; `docker compose up` +
`pnpm dev` runs web+api+worker end to end; **multi-process** run demonstrates global rate/concurrency
hold; README quickstart accurate; docs updated to reflect any behavior changes made during
implementation (INV-18).

---

## 26. Definition of Done

- [ ] INV-1…INV-20 each satisfied and (INV-1–15) covered by a test.
- [ ] All six endpoints implemented per `api.md`; no `501` remains on shipped features.
- [ ] Worker performs real checks; API never performs outbound URL checks (INV-2).
- [ ] Global rate ≤10/sec and concurrency ≤5 proven under ≥2 workers (INV-3/4/14).
- [ ] Max 4 attempts/round; retry classification explicit (INV-5/6).
- [ ] Duplicate delivery, cancellation races, stale workers cannot corrupt state (INV-7/8).
- [ ] retry-failed touches only FAILED URLs (INV-9).
- [ ] SSE is notification-only; refresh/reconnect recover from DB (INV-10/11).
- [ ] Batch-list 30s cache with mutation invalidation (INV-12/13).
- [ ] SSRF protections active; graceful shutdown; prod Docker; CI green (INV-19/20).
- [ ] `docker compose up` + `pnpm dev` runs the whole system (INV-18).
- [ ] Docs reflect final behavior; no doc describes behavior the code lacks.
