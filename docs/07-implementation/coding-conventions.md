# URLPulse Coding Conventions

**Version:** 1.0
**Status:** Active

Practical rules that matter for **this** architecture. Not a generic style guide. Where the scaffold
already set a pattern (`apps/`, `packages/`, ADR-030 stack), these conventions describe and lock in
that pattern rather than inventing a competing one. `.claude/rules/*` (error-handling, security,
database, frontend, code-quality) apply on top; this file resolves URLPulse-specific choices.

---

## 1. TypeScript

- `strict` on. No `any` (use `unknown` + a zod parse at the boundary). No non-null `!` on external data.
- **Contracts are zod-first.** Define a zod schema in `@urlpulse/types`, infer the type
  (`z.infer`). Never hand-write a type that duplicates a schema — that reintroduces drift (the exact
  thing `packages/types` exists to prevent).
- Public functions crossing a module/package boundary get explicit return types.
- Model status/result unions as discriminated unions on `status` where it clarifies exhaustiveness.
- ESM only (`"type":"module"`); use `import`/`export`, `.js`-less internal imports resolved by tsconfig.

## 2. Naming

- **Files:** kebab-case for modules/utilities (`rate-limit.ts`, `url-check.ts`); PascalCase for React
  components (`AppShell.tsx`, `ThemeToggle.tsx`).
- **Variables/functions:** `camelCase`, verb-first functions (`createBatch`, `claimUrl`). Booleans
  `is/has/should/can`. Factories `create*` (matches `createBatchService`, `createUrlCheckQueue`).
- **Handlers:** `handle*` internal, `on*` as React props.
- **Constants:** `SCREAMING_SNAKE` (`URL_CHECK_QUEUE`, `SSE_EVENT_BATCH_UPDATED`).
- **DB tables/columns:** `snake_case`, plural tables (`batches`, `urls`), `snake_case` columns
  (`attempt_count`, `response_time_ms`). The API layer converts to `camelCase` DTOs (`responseTimeMs`).
- **API paths:** plural nouns, `:batchId` param, exactly as `api.md` (`/batches`,
  `/batches/:batchId/retry-failed`). Do not rename.
- **Queue name:** the shared `URL_CHECK_QUEUE` constant (`"url-check"`) — never a string literal.
- **Redis keys:** namespaced (see §8).
- Acronyms as words in identifiers: `urlId`, `httpStatus`, `batchId` (not `URLId`).

## 3. Project Structure

| Concern | Location |
|---|---|
| HTTP routes (thin: validate + delegate) | `apps/api/src/routes/` |
| Application logic / orchestration | `apps/api/src/services/` |
| SQL access + transaction boundaries | `apps/api/src/repositories/` |
| DB/Redis/queue/cache/rate-limit/env/errors | `apps/api/src/lib/`, `apps/worker/src/lib/` |
| Migrations (`NNNN_name.sql`) | `apps/api/src/migrations/` |
| Worker job processors | `apps/worker/src/jobs/` |
| Queue name + job payload schema | `packages/types` (shared producer/consumer contract) |
| Shared domain/API/SSE types + zod | `packages/types` |
| Server-only env loading | `packages/config` |
| UI routes (Server Components default) | `apps/web/app/` |
| Interactive UI (Client Components) | `apps/web/components/` |
| API client, hooks, SSE client | `apps/web/lib/` |

Routes stay thin. Business logic goes in services; SQL goes in repositories. Do not put SQL in a
route or `fetch()` in a service that a repository should own.

## 4. API Conventions

Follow `docs/03-backend/api.md`; do not invent conflicting shapes.

- **Validation:** every external input parsed with a `@urlpulse/types` zod schema **before** any DB
  write or enqueue. TS types alone are insufficient for untrusted HTTP input.
- **Success shape:** `{ data }`, collections `{ data, meta }` (`ApiSuccess<T>`).
- **Error shape:** `{ error: { code, message, details? } }` (`ApiError`), `code` from the shared
  `ErrorCode` enum. Never leak stack traces / raw DB errors.
- **Status codes:** 200 GET/mutation, 201 create, 400 validation, 404 not found, 409 state conflict
  (e.g. retry-failed on CANCELLED, ADR-027), 500 unexpected, 501 not-yet-implemented.
- **Pagination:** `?page&pageSize`, `meta:{page,pageSize,total}`.
- **Concurrency:** never read-then-write on a pre-check; use conditional/transactional updates
  (`api.md §21`).

## 5. Database Conventions

- **postgres.js** client (ADR-030). Always parameterized queries — never string-concatenate input.
- **Migrations are forward-only numbered SQL** (`0001_init.sql`, `0002_*.sql`), applied by
  `migrate.ts`. **Never edit an applied migration** — add a new file. (Project uses forward-only
  plain SQL by decision; the generic reversibility rule in `.claude/rules/database.md` is overridden
  here — this is the repo's actual pattern.)
- Add indexes/columns in their own migration file.
- **UUID** primary keys (`gen_random_uuid()`); **timestamptz** everywhere, UTC; keep `created_at`,
  `updated_at`, and lifecycle timestamps (`started_at`/`completed_at`/`cancelled_at`).
- **Counters are persisted** (`completed/failed/cancelled_count`) and updated **transactionally with
  the URL transition that caused them** (ADR-025) — never in a second statement.
- Repository is the only place that runs SQL; services call repositories.

## 6. State Transitions

- Every status change is **explicit, validated, and conditional**:
  `UPDATE … SET status=<next> WHERE id=$1 AND status=<expected>`.
- A **zero-row result is meaningful** — someone else won the race (duplicate job, cancellation, stale
  worker). Inspect current state; never assume ownership; never blind-update (ADR-009/023).
- Counter change and status change live in **one transaction** (INV-7).
- Terminal states (`SUCCESS/FAILED/CANCELLED`, `COMPLETED`) are not overwritten except by an explicit
  valid transition (retry-failed, ADR-024).
- Legal transitions are those in `job-lifecycle.md §3-4` (as amended by ADR-024/026) — including
  `PENDING→CANCELLED` and `FAILED→PROCESSING`. Do not introduce others.

## 7. Worker Conventions

- **Never trust the job payload alone.** The payload carries only `{batchId,urlId}`; load
  authoritative state from PostgreSQL before acting (`job-lifecycle §10/§13`).
- **Idempotent handlers.** Safe under at-least-once/duplicate delivery via conditional transitions.
- **Bounded retries** = `MAX_RETRIES+1` (4) per round; classify retryable vs permanent centrally
  (INV-5/6).
- **Acquire globally, release in `finally`.** Concurrency slot + rate permit before the outbound
  request; release both in `finally` on success/timeout/abort/failure. Concurrency slots are
  TTL-leased so a crash cannot leak them (ADR-022).
- **Redis down → pause, never local fallback** (ADR-020).
- **Structured logs** with `jobId`/`batchId`/`urlId`.
- **Graceful shutdown:** stop taking jobs, drain in-flight, release resources, close connections.

## 8. Redis Conventions

Namespace every key by purpose to avoid collisions (BullMQ manages its own `bull:` prefix; everything
else is ours):

| Purpose | Prefix |
|---|---|
| BullMQ (managed) | `bull:url-check:*` |
| Rate limiter | `rl:outbound:*` |
| Concurrency semaphore/leases | `cc:outbound:slot:*` |
| Batch-list cache | `cache:batches:list:*` |
| Pub/Sub channel | `events:batch-updated` |

- Rate/concurrency state must be **atomic** (Lua or atomic primitives) — no GET-then-INCR race.
- Cache and coordination keys never overlap. TTLs: cache = `BATCH_LIST_CACHE_SECONDS` (30);
  concurrency lease TTL > max request timeout.

## 9. Logging

- Structured (JSON) logs; use the Fastify logger / a shared `logger` in the worker.
- Include a correlation id: `requestId` (API, Fastify `genReqId`) and `jobId`/`batchId`/`urlId`
  (worker). Thread it through error logs.
- **Never log secrets** (`DATABASE_URL`, `REDIS_URL`) or full URL contents at info level (`api.md §23`).
- Log the *why*: which operation failed and against which entity, with `errorCode`.

## 10. Error Handling

Distinguish and handle each class; never swallow (`.claude/rules/error-handling.md`):

| Class | Handling |
|---|---|
| Validation | zod at boundary → 400 `VALIDATION_ERROR` |
| Expected domain (not found, state conflict) | typed error → 404 / 409 |
| External HTTP failure (checking a URL) | classify retryable/permanent → retry or `FAILED` (not a server error) |
| Infrastructure (PG/Redis down) | fail safe: API 500 / worker pause; never invent success |
| Programmer error | throw, let it surface; do not mask |

Typed error classes with codes (extend the scaffold's `NotImplementedError` pattern). No floating
promises — every async call is awaited or explicitly handled.

## 11. Frontend Conventions

- **Server Components by default;** Client Components only for interactivity/local state/SSE/upload
  (ADR-014, INV-16). Don't turn the app into one big client component.
- Data comes from the API via `lib/api.ts` (typed with `@urlpulse/types`). Only `NEXT_PUBLIC_*` in the
  browser — never import `packages/config` or any secret into client code.
- **No browser-only source of truth for batch state (INV-1).** SSE/React state is a projection;
  cold load, refresh, and new tab reconstruct from `GET /batches/:id`.
- Every async surface has loading/error/empty states; don't show a retry action with no eligible
  failed URLs.
- SSE lifecycle: connect after initial fetch, reconnect with backoff, refetch on reconnect, close on
  terminal batch (INV-10/11).

## 12. Testing Conventions

- Test **behavior**, not mock call counts. One assertion per test, descriptive names, AAA, no
  branching/loops in tests (`.claude/rules/testing.md`).
- Deterministic: **mock external URL targets** (never hit real sites to prove rate/retry, `testing.md
  §27`). Mock only at real boundaries (network, clock, randomness).
- Integration tests use real Postgres + Redis (docker-compose), isolated per suite.
- **Distributed invariants get multi-process tests** (INV-14): rate ≤10/sec and concurrency ≤5 must
  run ≥2 worker processes so a per-process limiter cannot pass. Include a worker-crash slot-recovery
  test (ADR-022).
- Each fix to a distributed edge ships with a failing-before/passing-after test.

## 13. Comments

- Self-explanatory code first; rename before adding a "what" comment.
- Comment the **why**, especially non-obvious distributed behavior: why a transition is conditional,
  why a permit is acquired here, why an event is only a notification. The scaffold's file-header
  comments (pointing to the governing doc/ADR) are the model — keep them.
- Mark deliberate simplifications with `NOTE:`/`TODO(owner): … (#issue)`; never `XXX`/`TEMP`.

## 14. Git Conventions

- Conventional Commits: `type(scope): summary` (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`,
  `perf`, `build`, `ci`). Scope = app/package/area (`feat(api): …`, `feat(worker): …`).
- One concern per commit; commit after a phase/sub-task is verified (tests green), not mid-broken.
- Branch off `main`; never push automatically; never `--no-verify`.
- When behavior affecting DB/queue/rate/concurrency/live-updates/API changes, update the relevant
  `docs/` file **in the same commit** (`CLAUDE.md §10`).
