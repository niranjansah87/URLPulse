# URLPulse Milestones

**Version:** 1.0
**Status:** Active
**Pairs with:** `implementation-plan.md` (phase detail), `coding-conventions.md` (how to write it).

Milestones are **dependency-based**, not calendar-based. No hour estimates (the task does not
require them). Each milestone lists Goal · Scope · Dependencies · Files touched · Acceptance ·
Tests · Exit condition. Invariant IDs (INV-n) reference the register in `implementation-plan.md §1`.

Milestones 0–2 are **already delivered by the current scaffold** (see `implementation-plan.md §2`);
they are recorded here as satisfied so the sequence stays complete. **Active work starts at
Milestone 4.**

---

## Milestone 0 — Repository Foundation ✅ DONE

- **Goal:** runnable pnpm workspace with strict TS and shared tooling.
- **Scope:** workspace config, TS base, ESLint/Prettier, root scripts, `packages/config`.
- **Dependencies:** none.
- **Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `eslint.config.js`,
  `.prettierrc.json`, `packages/config/*`.
- **Acceptance:** `pnpm install/lint/typecheck` clean on fresh clone.
- **Exit:** met (ADR-030).

## Milestone 1 — Local Infrastructure ✅ DONE

- **Goal:** one-command local Postgres + Redis; fail-fast config.
- **Scope:** docker-compose, `.env.example`, env loader.
- **Dependencies:** M0.
- **Files:** `docker-compose.yml`, `.env.example`, `packages/config/src/index.ts`.
- **Acceptance (INV-18):** `docker compose up -d` → both healthy; missing env fails fast.
- **Exit:** met.

## Milestone 2 — Database + Shared Contracts 🟡 MOSTLY DONE

- **Goal:** authoritative schema + shared zod contracts.
- **Scope:** `0001_init.sql` (done); migrate runner (done); `packages/types` core (done). **Remaining:**
  `0002_batch_version.sql` (SSE `version`), CSV/pagination/retry-failed/ErrorCode schemas.
- **Dependencies:** M0–M1.
- **Files:** `apps/api/src/migrations/*`, `apps/api/src/migrate.ts`, `packages/types/src/index.ts`.
- **Acceptance (INV-1/17):** `pnpm db:migrate` builds schema idempotently; every contract lives in
  `@urlpulse/types`; constraints enforce counter invariants.
- **Tests:** `packages/types` schema round-trips; a migration smoke test.
- **Exit:** schema done; contract extensions land alongside M4 as needed.

## Milestone 3 — API Foundation 🟡 PARTIAL

- **Goal:** production-shaped Fastify bootstrap.
- **Scope:** global error handler + not-found → `ApiError`/`ErrorCode`; request-id logging; db/redis/
  queue decorators with `onClose` cleanup; health readiness.
- **Dependencies:** M2.
- **Files:** `apps/api/src/server.ts`, `routes/health.ts`, `lib/{errors,db,redis,queue}.ts`.
- **Acceptance (INV-19):** malformed request → consistent `ApiError`; clean start/stop, no leaked
  connections; health reflects DB+Redis reachability.
- **Tests:** error-shape + health integration (`server.test.ts` extended).
- **Exit:** bootstrap complete; six routes still `501` until M4+.

## Milestone 4 — Batch Creation + Queue 🔜 NEXT

- **Goal:** create/list/get batches for real and enqueue one job per URL.
- **Scope:** Phase 5 + Phase 6. Fill `services/batches.ts`, `repositories/batches.ts`; JSON + CSV
  create; transactional insert-then-enqueue; BullMQ producer config (`attempts:4`, exp backoff);
  DB/queue reconciliation sweep (ADR-028); list pagination.
- **Dependencies:** M2 (contracts), M3 (bootstrap).
- **Files:** `apps/api/src/routes/batches.ts`, `services/batches.ts`, `repositories/batches.ts`,
  `lib/queue.ts`, new `lib/csv.ts`, `packages/types` (CSV/pagination shapes).
- **Acceptance (INV-1/2/17):** batch+URLs persist **before** any job; cold `GET /batches/:id` after
  restart is correct; CSV and JSON persist identically; enqueue-fail is recovered by the sweep;
  invalid input → `400`.
- **Tests:** API integration (create/list/get, validation, CSV), DB integration (transaction,
  reconciliation), enqueue-failure recovery.
- **Exit:** create→list→detail work end to end with jobs queued (worker still no-op).

## Milestone 5 — Worker + URL Health Checking 🔴

- **Goal:** worker performs real checks and persists results idempotently (no global limits yet).
- **Scope:** Phase 7 + Phase 10 core. Real processor: conditional claim (ADR-023), HTTP check with
  timeout + bounded redirects, result parsing (status/latency/title), transactional persistence,
  retry classification (INV-6), backoff, terminal batch transition + precedence (ADR-025), graceful
  shutdown.
- **Dependencies:** M4 (jobs exist).
- **Files:** `apps/worker/src/worker.ts`, `jobs/url-check.ts`, `worker/src/lib/{http-checker,env,redis}.ts`,
  `apps/api/src/repositories/urls.ts` (shared transition SQL) or a shared query module.
- **Acceptance (INV-5/6/7):** URLs reach SUCCESS/FAILED with result columns; retryable→success hits
  `attempt_count=4`; exhaustion→FAILED, no 5th; duplicate delivery = one counter increment;
  SIGTERM drains.
- **Tests:** worker integration, retry (success + exhaustion), duplicate-delivery idempotency,
  permanent-failure-no-retry.
- **Exit:** single-worker batches complete correctly with accurate counters.

## Milestone 6 — Distributed Rate + Concurrency 🔴

- **Goal:** enforce global 10/sec and global 5-in-flight across all workers.
- **Scope:** Phase 8 + Phase 9. Redis sliding-window rate limiter (Lua/atomic); Redis TTL-leased
  concurrency semaphore (ADR-022, crash-safe); acquisition/release ordering; Redis-down = pause,
  never local fallback (ADR-020).
- **Dependencies:** M5 (real outbound requests to limit).
- **Files:** `apps/worker/src/lib/{rate-limit,concurrency}.ts`, worker request path, `packages/config`
  (already exposes `RATE_LIMIT_RPS`, `MAX_CONCURRENCY`).
- **Acceptance (INV-3/4/14/19):** **multi-worker** test: outbound rate ≤10/sec globally and in-flight
  ≤5 globally; **crash test**: a killed worker's concurrency slot returns after lease TTL (no leak);
  Redis-down pauses rather than bypasses.
- **Tests:** multi-worker rate, multi-worker concurrency, crash-recovery of a slot, Redis-unavailable
  behavior. These are the highest-value tests in the project.
- **Exit:** limits provably global, not per-process.

## Milestone 7 — Retry + Idempotency (hardening) 🔴

- **Goal:** lock down every idempotency/retry edge beyond M5's core.
- **Scope:** Phase 10 completion — retry-after-restart, stale-job rejection, counter-race safety,
  centralized backoff config, retry passes through the limiter (INV-4 interaction).
- **Dependencies:** M5, M6.
- **Files:** worker persistence module, `packages/types` (attempt semantics), tests.
- **Acceptance (INV-5/7):** re-execution after worker restart never double-counts; a stale job on a
  terminal URL is a no-op; retries consume rate permits.
- **Tests:** worker-crash re-execution, stale-job, concurrent-completion counter race.
- **Exit:** all `retries-and-idempotency.md §24` invariants have tests.

## Milestone 8 — Cancellation 🔴

- **Goal:** safe cancellation of queued and in-flight work.
- **Scope:** Phase 11. Cancel endpoint (conditional `PENDING`/`PROCESSING`, bulk URL cancel, cache
  invalidate, publish); worker cancellation checks + in-flight abort + resource release; retry
  suppression; retry-failed-on-cancelled → 409 (ADR-027).
- **Dependencies:** M5 (in-flight work), M6 (slots to release), M9-SSE optional for UX.
- **Files:** `apps/api/src/routes/batches.ts` (cancel), `services/batches.ts`, worker request path,
  `repositories/batches.ts`.
- **Acceptance (INV-8/15):** cancel-of-PENDING and cancel-of-PROCESSING both terminal; stale
  completion cannot revert cancel (both race orderings); double-cancel stable; slots released on abort.
- **Tests:** cancel-pending, cancel-during-request race (both orders), concurrent cancel, cancel+retry.
- **Exit:** `cancellation.md §26` invariants covered.

## Milestone 9 — SSE 🔴

- **Goal:** live cross-instance updates that are never the source of truth.
- **Scope:** Phase 12. Worker publishes `batch.updated` after commit; API SSE endpoint subscribes to
  Redis and forwards; heartbeat; client reconciles via GET (INV-10/11). Add `batches.version` (M2
  follow-up) as the event version.
- **Dependencies:** M5 (state changes to broadcast); pairs with M10 frontend.
- **Files:** `apps/api/src/routes/batches.ts` (`/events`), `lib/pubsub.ts`, worker publish path,
  `apps/web/lib/sse.ts`.
- **Acceptance (INV-10/11/14):** update reaches a client on a **different** API instance; disconnect+
  reconnect reconciles; duplicate/out-of-order events don't corrupt UI; SSE-off still correct via GET.
- **Tests:** multi-instance delivery, reconnect reconciliation, duplicate-event, ordering.
- **Exit:** live updates resilient; DB remains authoritative.

## Milestone 10 — Frontend 🔴

- **Goal:** full UI wired to real API + SSE.
- **Scope:** Phases 13–17. Foundation (Server/Client boundaries INV-16), create UI (manual+CSV),
  batch list (30s cache-aware, INV-12/13), batch detail (results, cancel, retry-failed, CSV
  download), live progress UX (reconnect/refetch, refresh-safe).
- **Dependencies:** M4 (APIs), M8 (cancel/retry), M9 (SSE).
- **Files:** `apps/web/app/**`, `apps/web/components/**`, `apps/web/lib/{api,sse}.ts`.
- **Acceptance (INV-1/9/12/13/16):** cold load + refresh + new tab reconstruct state from the API;
  retry-failed only on eligible FAILED; created batch visible immediately; no browser-only source of
  truth.
- **Tests:** component/interaction tests; wired into E2E in M11.
- **Exit:** a user can run the full flow in the browser.

## Milestone 11 — Testing 🔴

- **Goal:** invariant-first suite proving distributed guarantees.
- **Scope:** Phase 18 — fill any gaps from M5–M10 plus E2E (happy, partial-failure→retry,
  cancellation, refresh).
- **Dependencies:** M4–M10.
- **Files:** test files across apps/packages; CI workflow.
- **Acceptance (INV-14/15):** every INV-1…INV-15 has a failing-before/passing-after test; multi-worker
  and failure-injection suites are in CI.
- **Exit:** `pnpm test` green in CI.

## Milestone 12 — Production Hardening 🔴

- **Goal:** production-ready processes.
- **Scope:** Phase 19 — structured logging + correlation ids, graceful shutdown (INV-19), readiness/
  liveness, **SSRF protections (INV-20)**, resource limits, prod Docker images, CI.
- **Dependencies:** M4–M11.
- **Files:** `apps/*/Dockerfile`, `lib/logger.ts`, worker SSRF guard, `.github/workflows/ci.yml`.
- **Acceptance (INV-19/20):** private/metadata-address URLs refused pre-request; processes drain on
  SIGTERM; CI green; no secrets logged.
- **Tests:** SSRF deny-list, shutdown drain.
- **Exit:** deployable images, green pipeline.

## Milestone 13 — Final Review / Demo 🔴

- **Goal:** verified, documented, demonstrable system.
- **Scope:** Phase 20 — full test/build/lint/typecheck; `docker compose up` + `pnpm dev` end to end;
  multi-process demonstration of global limits; README quickstart; doc reconciliation.
- **Dependencies:** M0–M12.
- **Acceptance (INV-18):** whole system runs from a clean clone; docs match behavior; demo script works.
- **Exit:** Definition of Done in `implementation-plan.md §26` fully checked.

---

## Critical path

M0→M1→M2→M3→**M4**→M5→M6→(M7,M8,M9 can parallelize after M6)→M10→M11→M12→M13.
M9 (SSE) and M10 (frontend) can begin in parallel once M4 exposes read APIs, but M10's cancel/retry
UI depends on M8 and its live UX depends on M9.
