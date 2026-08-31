# URLPulse Milestones

**Audience:** Engineers/agents executing the roadmap in `implementation-plan.md`.

Dependency-ordered, not calendar-based. Each milestone bundles the plan's phases into a
shippable, verifiable unit. Invariant tags (`INV-n`) and ADRs are defined in
`implementation-plan.md §1` and `docs/02-architecture/decisions.md` - this file references them
rather than restating the architecture. A milestone is **done only when its acceptance criteria
and required tests pass**, not when the code merely exists.

Status legend: ✅ done · 🟡 partial · 🔜 next · 🔴 not started.

---

## Milestone 0 - Repository Foundation ✅

- **Goal:** A workspace that installs, lints, type-checks, and tests on a clean clone.
- **Scope:** pnpm workspace, TS strict + `tsconfig.base.json`, flat ESLint + Prettier, root scripts, `@urlpulse/config` env loader. (Plan Phase 0.)
- **Dependencies:** none.
- **Files/modules:** `pnpm-workspace.yaml`, root `package.json`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc.json`, `packages/config/`.
- **Acceptance:** `pnpm install`, `pnpm lint`, `pnpm typecheck` succeed; config fails fast on missing env (INV-18 groundwork).
- **Tests required:** `@urlpulse/config` env-validation tests (present).
- **Exit condition:** all four root gates green on a fresh clone. **Met.**

## Milestone 1 - Local Infrastructure ✅

- **Goal:** One command brings up PostgreSQL + Redis for local dev.
- **Scope:** `docker-compose.yml` (postgres:16, redis:7, healthchecks, volumes), `.env.example`. (Plan Phase 1.)
- **Dependencies:** M0.
- **Files/modules:** `docker-compose.yml`, `.env.example`.
- **Acceptance (INV-18):** `docker compose up -d` → both services healthy; apps read `.env`.
- **Tests required:** none (infra); smoke-verified via `GET /health/ready` later.
- **Exit condition:** services healthy; app processes connect. **Met.**

## Milestone 2 - Database + Shared Contracts 🟡

- **Goal:** Authoritative schema and the shared type/contract surface both apps depend on.
- **Scope:** `0001_init.sql` + runner (done); extend `@urlpulse/types` - CSV parsed-result + row-error shape, `listBatchesQuery` + pagination `meta`, `retryFailedResponse`, `ErrorCode` enum; add `0002_batch_version.sql` (`batches.version`) backing SSE (P3-1). (Plan Phases 2–3.)
- **Dependencies:** M0.
- **Files/modules:** `apps/api/src/migrations/*`, `apps/api/src/migrate.ts`, `packages/types/src/index.ts`.
- **Acceptance (INV-1/17):** `pnpm db:migrate` builds schema from empty and re-runs as a no-op; constraints reject negative counters and `completed+failed+cancelled > total`; every planned request/response/job payload maps to a `@urlpulse/types` schema; no app re-declares a domain type.
- **Tests required:** `@urlpulse/types` enum/DTO round-trip tests; a migration-applies-clean check.
- **Exit condition:** schema + full contract set land; types tests green. **Schema done; contracts partial.**

## Milestone 3 - API Foundation 🟡

- **Goal:** A production-shaped Fastify app: consistent errors, logging, lifecycle, health.
- **Scope:** global error handler → `ApiError` by `ErrorCode` (zod→400, NotImplemented→501, conflict→409, not-found→404, uncaught→500, no stack leak); not-found handler; per-request `requestId`; db/redis/queue as decorators closed `onClose`; `/health` + `/health/ready`. (Plan Phase 4.)
- **Dependencies:** M2 (ErrorCode enum).
- **Files/modules:** `apps/api/src/server.ts`, `routes/health.ts`, `lib/{db,redis,queue,errors}.ts`, a `plugins/` error+logging module.
- **Acceptance (INV-2/19):** malformed request → consistent `ApiError`; readiness reflects real DB+Redis; server starts/stops with no leaked connections.
- **Tests required:** health test (present); error-shape integration test.
- **Exit condition:** bootstrap complete; error/readiness tests green.

## Milestone 4 - Batch Creation + Queue 🔜 (next)

- **Goal:** Persist a batch and enqueue one job per URL, durably.
- **Scope:** `POST /batches` (JSON + CSV multipart → per-row validation, reject-whole-on-malformed); single transaction inserts `batches`+`urls` then commits **then** enqueues; `GET /batches/:batchId` reads full `BatchDetail` cold; queue config `attempts: MAX_RETRIES+1`, exponential backoff, retention; reconciliation sweep for the commit-then-enqueue window (ADR-028). (Plan Phases 5–6.)
- **Dependencies:** M2, M3.
- **Files/modules:** `apps/api/src/services/batches.ts`, `repositories/batches.ts`, `routes/batches.ts`, `lib/queue.ts`; sweep in `apps/worker` or a scheduled API task.
- **Acceptance (INV-1):** batch+URLs persist **before** any job exists; cold `GET` after restart is correct; invalid/empty → 400; CSV and JSON persist identical shapes; enqueue failure recovered by the sweep; job payload is ids only.
- **Tests required:** API integration (create/get, validation, CSV vs JSON parity); DB integration (transactional insert); reconciliation test (enqueue-fails → sweep re-enqueues).
- **Exit condition:** create+get real; no URL lost on enqueue failure.

## Milestone 5 - Worker + URL Health Checking 🔴

- **Goal:** The worker turns queued jobs into persisted URL results (no distributed limits yet).
- **Scope:** BullMQ `Worker` on `URL_CHECK_QUEUE` (separate process); conditional claim `PENDING→PROCESSING` (`attempt_count++`, ADR-023); cancellation/state check before work; HTTP check with finite timeout, bounded redirects, capture status/latency/title; transactional result persistence; graceful shutdown. (Plan Phase 7.)
- **Dependencies:** M4.
- **Files/modules:** `apps/worker/src/worker.ts`, `jobs/url-check.ts`, `lib/http-checker.ts`, `repositories` shared or worker-side DB access.
- **Acceptance (INV-2/19):** single worker drives PENDING→PROCESSING→SUCCESS/FAILED with result columns; missing/terminal URL skipped; SIGTERM drains.
- **Tests required:** worker integration against real PG/Redis with a mock HTTP target (claim, success/failed persistence, terminal-skip, timeout).
- **Exit condition:** end-to-end create→process→persisted result works with one worker.

## Milestone 6 - Distributed Rate + Concurrency 🔴

- **Goal:** Enforce the two global constraints across **all** workers.
- **Scope:** Redis atomic sliding-window rate limiter = `RATE_LIMIT_RPS` (P2-1); Redis TTL-leased semaphore = `MAX_CONCURRENCY` (ADR-022, TTL > max request timeout); acquire concurrency-then-rate immediately before the outbound call; release both in `finally`; Redis-down → pause, never a local fallback (ADR-020). (Plan Phases 8–9.)
- **Dependencies:** M5.
- **Files/modules:** `apps/worker/src/lib/rate-limit.ts`, `lib/concurrency.ts` (Lua scripts), wired into `jobs/url-check.ts`.
- **Acceptance (INV-3/4/14):** with **≥2 worker processes**, outbound rate ≤10/sec and in-flight ≤5 globally; a per-process limiter must fail these tests.
- **Tests required:** multi-worker rate test (timestamp bound); multi-worker concurrency test (max in-flight); worker-crash test proving slot capacity recovers after lease TTL (INV-19).
- **Exit condition:** both globals proven under multiple workers, including crash recovery.

## Milestone 7 - Retry + Idempotency 🔴

- **Goal:** Correct behavior under transient failure and duplicate delivery.
- **Scope:** central retry classification (retryable vs permanent, INV-6); retryable → reset `PROCESSING→PENDING` + re-throw for BullMQ backoff (ADR-023), cap 4/round (INV-5); terminal writes conditional on `status='PROCESSING'`; counters move only when a row moves, same transaction; batch terminal precedence `CANCELLED>FAILED>COMPLETED` (ADR-025). (Plan Phase 10.)
- **Dependencies:** M5 (M6 recommended first).
- **Files/modules:** `apps/worker/src/jobs/url-check.ts`, retry-classification module, batch/url repositories.
- **Acceptance (INV-5/6/7):** retryable-then-success reaches `attempt_count=4`; exhaustion → FAILED, no 5th; duplicate delivery leaves counters unchanged; permanent failure not retried.
- **Tests required:** retry-classification unit; duplicate-delivery idempotency (DB integration); exhaustion test; counter-drift test.
- **Exit condition:** idempotency + retry invariants covered failing-before/passing-after.

## Milestone 8 - Cancellation 🔴

- **Goal:** Cancellation is authoritative and race-safe.
- **Scope:** `POST /batches/:batchId/cancel` conditional `WHERE status IN ('PENDING','PROCESSING')` + bulk-cancel non-terminal URLs same tx + invalidate cache + publish; queued jobs skip; in-flight abort where practical (`AbortController`) and release resources; stale completion loses the `WHERE status='PROCESSING'` race; cancellation stops retries; `retry-failed` on CANCELLED → 409 (ADR-027). (Plan Phase 11.)
- **Dependencies:** M5, M7.
- **Files/modules:** `services/batches.ts`, `repositories/batches.ts`, worker cancellation checks.
- **Acceptance (INV-8):** cancel-of-PENDING and cancel-of-PROCESSING both terminal; worker finishing after cancel cannot revert it (both race orderings); double-cancel stable.
- **Tests required:** cancellation-race DB integration (both orderings); double-cancel; retry-suppression-after-cancel.
- **Exit condition:** no stale worker can resurrect a cancelled batch.

## Milestone 9 - SSE / Live Updates 🔴

- **Goal:** Cross-instance live progress that is never the source of truth.
- **Scope:** worker publishes `batch.updated {batchId,version}` to Redis pub/sub **after** commit; `GET /batches/:batchId/events` (`text/event-stream`) subscribes per API instance and forwards to local clients; heartbeat; notification-only → client refetches `GET /batches/:batchId` (P2-4); tolerate dup/missed/out-of-order. (Plan Phase 12.)
- **Dependencies:** M4 (get), M5 (events), M2 (`version`).
- **Files/modules:** `routes/events` (SSE), `lib/pubsub.ts`, worker publish call.
- **Acceptance (INV-10/11):** update reaches a client on a **different** API instance; disconnect-during-update + reconnect → correct state; killing SSE entirely still lets `GET` return correct state.
- **Tests required:** cross-instance delivery; reconnect reconciliation; duplicate-event no-double-count.
- **Exit condition:** live updates recover from authoritative state under loss.

## Milestone 10 - Frontend 🔴

- **Goal:** Full UI: create, list, detail, live progress, cancel, retry-failed, download.
- **Scope:** Server Components by default, Client only for interaction/SSE (INV-16); batch creation (textarea + CSV, no double-submit); batch list with 30s cache visibility + invalidation (INV-12/13); batch detail (progress, results table, actions, CSV download); SSE client with reconnect/refetch and LIVE/RECONNECTING/OFFLINE; refresh-safe, multi-tab safe. (Plan Phases 13–17.)
- **Dependencies:** M4, M8, M9.
- **Files/modules:** `apps/web/app/**`, `components/**`, `lib/api.ts`, `lib/sse.ts`.
- **Acceptance (INV-1/9/10/11/12/13/16):** freshly created batch visible immediately; retry-failed shown only with eligible FAILED URLs and requeues only those; refresh/new-tab reconstruct state; no batch state held only in the browser.
- **Tests required:** component/UX for create validation, empty/loading/error; E2E happy path + refresh.
- **Exit condition:** a user can run the full flow in the browser.

## Milestone 11 - Testing 🔴

- **Goal:** Every invariant has a failing-before/passing-after test.
- **Scope:** unit, DB/API/worker integration, multi-worker rate+concurrency, retries/idempotency, cancellation races, SSE reconnect, cache invalidation, worker-crash slot recovery, queue/DB reconciliation, E2E. (Plan Phase 18, `testing.md`.)
- **Dependencies:** M4–M10 (tests land with each; this milestone closes gaps + E2E).
- **Files/modules:** `**/*.test.ts`, integration harness (real PG/Redis), mock HTTP target.
- **Acceptance (INV-14/15):** INV-1…INV-15 each covered; multi-worker tests use ≥2 processes.
- **Tests required:** the suite itself.
- **Exit condition:** `pnpm test` green with the full invariant matrix.

## Milestone 12 - Production Hardening 🔴

- **Goal:** Safe to run against untrusted URLs.
- **Scope:** SSRF protections (HTTP(S)-only; block loopback, RFC-1918, link-local, `169.254.169.254`; re-check resolved IP; bound redirects, INV-20); resource limits (URLs/batch, CSV size, URL length, SSE cap); structured logging + correlation ids; graceful shutdown across api+worker; prod Docker images; CI (`lint→typecheck→test→build`). (Plan Phase 19.)
- **Dependencies:** M5 (checker), M11.
- **Files/modules:** `apps/worker/src/lib/http-checker.ts` (SSRF guard), logging config, `Dockerfile`s, `.github/workflows/ci.yml`.
- **Acceptance (INV-19/20):** a URL resolving to a private/metadata address is refused before any request; processes drain on SIGTERM; CI green.
- **Tests required:** SSRF guard unit tests (each blocked class + redirect-to-private); graceful-shutdown test.
- **Exit condition:** SSRF-safe, observable, CI-gated.

## Milestone 13 - Final Review / Demo 🔴

- **Goal:** The whole system runs end to end and docs match behavior.
- **Scope:** `pnpm build/lint/typecheck/test` clean; `docker compose up` + `pnpm dev` runs web+api+worker; multi-process run demonstrates global rate/concurrency; README quickstart accurate; docs updated for any behavior changed during implementation. (Plan Phase 20.)
- **Dependencies:** M0–M12.
- **Files/modules:** `README.md`, `docs/**`.
- **Acceptance:** Definition of Done (`implementation-plan.md §26`) fully checked.
- **Tests required:** full suite green in CI.
- **Exit condition:** DoD satisfied; no doc describes behavior the code lacks.

---

## Milestone dependency graph

```text
M0 ─▶ M1 ─▶ M2 ─▶ M3 ─▶ M4 ─▶ M5 ─▶ M6 ─▶ M7 ─▶ M8 ─▶ M9 ─▶ M10 ─▶ M11 ─▶ M12 ─▶ M13
                         │                                     ▲
                         └──────────────── M9 needs M4 (GET) ──┘
```

**Next milestone to execute: M4 - Batch Creation + Queue** (M0–M2 done, M3 partial).
