# URLPulse Coding Conventions

Practical rules for implementing URLPulse. These extend `.claude/rules/*` and follow the existing
architecture (`docs/03-backend/api.md`, `database.md`, `docs/02-architecture/decisions.md`) rather
than inventing new conventions. When this file and an ADR disagree, the ADR wins - fix this file.

---

## 1. TypeScript

- Strict mode is on (`tsconfig.base.json`). No `any`, no non-null `!` on untrusted data, no unsafe casts; use `unknown` + a zod parse at boundaries.
- Public contracts (exported functions, route handlers, repository methods) have explicit return types.
- Model finite states as discriminated unions or the shared status enums - never loose strings in app code.
- ESM only (`"type": "module"`); relative imports are extensionless (resolved by `tsx`/Next/`tsc` bundler resolution). Import order: node builtins, external, workspace (`@urlpulse/*`), relative, types.

## 2. Naming

- **Files:** PascalCase for React components (`AppShell.tsx`); kebab-case for everything else (`url-check.ts`, `rate-limit.ts`).
- **Identifiers:** `camelCase` vars/functions (verb-first: `createBatch`, `claimUrl`); `PascalCase` types/classes; `SCREAMING_SNAKE` constants (`URL_CHECK_QUEUE`, `MAX_CONCURRENCY`). Booleans `is/has/should/can`. Handlers `handle*` internal, `on*` as props. Acronyms as words: `batchId`, `httpStatus` - never `batchID`.
- **DB tables/columns:** `snake_case`, plural tables (`batches`, `urls`), `snake_case` columns (`attempt_count`, `response_time_ms`) - matches `database.md`.
- **API routes:** plural nouns, kebab where multi-word; use the exact `api.md` names and `:batchId` param - do not rename.
- **Queue name:** the `URL_CHECK_QUEUE` constant from `@urlpulse/types`, never a string literal.
- **Redis keys:** see §8.

## 3. Project structure (where things live)

- **routes/** - thin: validate input, delegate to a service, shape the response. No SQL, no business logic.
- **services/** - application logic/orchestration (transactions spanning repos, enqueue, cache invalidation, publish).
- **repositories/** - the only place raw SQL lives; own transaction boundaries; return domain types.
- **lib/** - infrastructure clients and primitives: `db`, `redis`, `queue`, `cache`, `rate-limit`, `concurrency`, `http-checker`, `env`, `errors`.
- **migrations/** - `NNNN_name.sql`, forward-only.
- **packages/types** - every shared schema/type/queue/SSE contract. **Never** re-declare a domain type inside an app.
- **packages/config** - server-only env; never imported by browser code.
- **web:** `app/` routes (Server Components by default), `components/` (Client only where interactive), `lib/` (api client, sse client, hooks).

## 4. API conventions (follow `api.md`)

- Validate every external input at the boundary with a zod schema from `@urlpulse/types` before any DB/queue work.
- Success shape `{ data }` (collections add `{ meta }`); error shape `{ error: { code, message, details? } }` - no stack traces.
- Status codes per `api.md §17`: 200 read, 201 create, 400 validation, 404 not found, 409 state conflict, 429 rate limited, 500 unexpected. Unimplemented features return **501**, never fake data.
- Pagination: `page`/`pageSize` query + `meta { page, pageSize, total }`.
- Mutations are idempotent where documented (cancel repeat → current state).

## 5. Database conventions (follow `database.md`)

- Schema changes are new migration files; **never edit an applied migration**.
- UUID primary keys (`gen_random_uuid()`); `timestamptz` in UTC; every table has `created_at`/`updated_at`.
- Important transitions run in a transaction; counter updates happen in the **same** transaction as the URL transition that caused them.
- State transitions are conditional: `UPDATE … WHERE status = <expected>`; a zero-row result means someone else won - handle it, never assume ownership.
- SQL lives only in repositories; services compose repositories.

## 6. State transitions

- Explicit, validated, atomic, and protected from stale workers. Allowed transitions are defined in `job-lifecycle.md` - do not introduce a transition it does not list.
- Terminal states (`COMPLETED`/`FAILED`/`CANCELLED`) are never overwritten; batch terminal precedence is `CANCELLED > FAILED > COMPLETED` (ADR-025).

## 7. Worker conventions

- Never trust the job payload as truth - it carries ids only; load authoritative state from PostgreSQL (`api.md §22`, ADR-023).
- Handlers are idempotent: duplicate delivery must not double-count (guarded `WHERE status='PROCESSING'`, counters move only when a row moves).
- Retries are bounded (4/round, INV-5) with explicit retryable/permanent classification (INV-6).
- Acquire distributed resources (concurrency lease, rate permit) immediately before the outbound call; **release in `finally`**; leases carry a TTL so a crash cannot leak a slot (ADR-022).
- On Redis/PG unavailability, pause - never bypass a global control with a local fallback (ADR-020).
- Structured logs and graceful shutdown (drain in-flight, release, close connections).

## 8. Redis conventions

Namespace every key by purpose to prevent collisions; BullMQ owns its own prefix.

| Purpose | Prefix | Notes |
|---|---|---|
| Queue (BullMQ) | `bull:url-check:*` | managed by BullMQ; do not hand-write |
| Batch-list cache | `cache:batches:*` | 30s TTL (INV-12) |
| Global rate limiter | `rl:outbound` | sliding-window (P2-1) |
| Global concurrency | `sem:outbound` | TTL-leased slots (ADR-022) |
| Pub/Sub (SSE) | `events:batch:<batchId>` | notification channel |

Prefer a single small Lua script for each atomic admission (rate/concurrency) over multi-command races.

## 9. Logging

- Structured (JSON via Fastify/pino). Attach a per-request `requestId`; on worker logs attach `batchId`/`urlId`/`jobId`.
- Never log secrets, full env, or noisy URL bodies. Log error context (code, cause), not raw stack traces to clients.

## 10. Error handling (follow `.claude/rules/error-handling.md`)

Distinguish and handle distinctly: **validation** (400, zod), **domain** (expected, e.g. 404/409), **external HTTP** (a URL-check outcome, not an app crash - classify + record), **infrastructure** (Redis/PG down → pause/500), **programmer errors** (fail loud). Never swallow errors; no floating promises; typed error classes (`NotImplementedError` pattern).

## 11. Frontend conventions

- Server Components by default; Client Components only for interactivity/SSE (INV-16, ADR-014).
- The browser is never the source of truth for batch state (INV-1); it renders server/API data and reconciles from `GET /batches/:batchId`.
- Only `NEXT_PUBLIC_*` env reaches the browser bundle - never `DATABASE_URL`/`REDIS_URL`.
- Every async view has loading/error/empty states; disable double-submit on mutations.
- SSE is a notification channel: refetch authoritative state on connect/reconnect (INV-10/11).

## 12. Testing conventions (follow `.claude/rules/testing.md`, `testing.md`)

- Verify behavior, not implementation; one assertion per test; Arrange-Act-Assert; no `if`/loops in tests.
- Deterministic: mock only system boundaries - outbound URL HTTP, clock, randomness - with real PG/Redis for integration.
- Distributed invariants (rate, concurrency) **must** run ≥2 worker processes so a per-process implementation fails the test.
- No `expect(true)` and no asserting a mock was merely called; flaky tests are fixed or deleted.

## 13. Comments

Prefer self-explanatory code; rename instead of writing a "what" comment. Comment the **why**, especially non-obvious distributed behavior (lease TTL vs `finally`, publish-after-commit ordering, conditional-update race outcomes). Use `NOTE:`/`TODO(author): … (#issue)` markers per `.claude/rules/code-quality.md`.

## 14. Git conventions

Conventional Commits (`type(scope): summary`; `feat|fix|refactor|docs|test|chore|perf|build|ci`). One concern per commit; scope by package (`api`, `worker`, `web`, `packages`). Explain **why** in the body when non-obvious. Update the docs affected by a behavior change in the same commit. Don't commit secrets; don't push without being asked.

## Dependency policy

No new runtime dependency without a clear reason a few lines of code can't cover; prefer the stack already chosen (ADR-030: Fastify, postgres.js, ioredis/BullMQ, zod, Next, `tsx`). No ORM, no monorepo framework. Record any significant addition as an ADR.
