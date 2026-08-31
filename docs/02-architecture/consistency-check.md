# URLPulse - Consistency & Architecture Review

**Version:** 1.0
**Status:** Final consistency pass
**Reviewer role:** Principal architect, pre-implementation gate
**Scope:** All of `docs/`, `CLAUDE.md`, `README.md`. No application code exists yet.

> The original technical-task PDF referenced in the review brief is **not present** in
> the repository or workspace (`find . -iname '*.pdf'` returns nothing). This review
> therefore treats the product docs (`01-product/`) as the highest-priority requirement
> record. If the source PDF exists, re-run requirements traceability against it.

---

## 1. Verdict

**NOT READY - 3 P0 blocking issues remain** (plus 4 P1 that should close before code).

The documentation set is unusually thorough and internally coherent on the *big* contracts
(status enums, 4-attempt cap, 10 req/s global, 30s cache, PostgreSQL-as-truth, SSE-as-notification).
The blockers are not missing sections - they are **under-specified mechanisms** and **one contract
(global concurrency) that is contradicted in two documents**. Each blocker would cause two competent
engineers to implement incompatible, subtly-wrong behavior.

---

## 2. Consistency Matrix

| Contract | Canonical Decision | Documents Checked | Status |
|---|---|---|---|
| Batch statuses | `PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED` | job-lifecycle, database, api, frontend-arch, live-updates, testing | ✅ PASS |
| URL statuses | `PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED` | job-lifecycle, database, api, frontend-arch, cancellation, testing | ✅ PASS |
| Retry count | 3 retries | PRD, scope, requirements, job-lifecycle, retries, arch, diagram | ✅ PASS |
| Max attempts | 4 (1 initial + 3) | retries §2/§24, diagram §7, testing §10, job-lifecycle §18 | ✅ PASS |
| Max attempts - *lifetime vs per retry-failed round* | **Unspecified** | retries §24 ("per URL") vs api §15 (retry-failed re-runs) | ⚠️ P1 |
| Global rate limit | 10 req/s, Redis-backed, global | ADR-006, rate-limiting, scope, requirements, scaling, diagram | ✅ PASS |
| Rate-limit algorithm | sliding-window **vs** token-bucket not chosen | rate-limiting §6/§18 vs architecture §15 ("sliding-window") | ⚠️ P2 |
| Global concurrency (value) | 5 in flight | everywhere | ✅ PASS |
| Global concurrency (scope) | **global** per ADR-007 - but contradicted | scope §Worker "worker-side", architecture §28 "Worker processing control" | ❌ **P0** |
| Concurrency slot leasing on crash | **Unspecified** - leak risk | cancellation §15 (process-local finally only), scaling §5 | ❌ **P0** |
| Retry claim / attempt_count / BullMQ-retry interaction | **Contradictory** | job-lifecycle §6+§17, retries §9, diagram §3 | ❌ **P0** |
| Source of truth | PostgreSQL | ADR-001, all docs | ✅ PASS |
| Counters | persisted `completed/failed/cancelled_count`, transactional | database §4.2/§15 | ✅ PASS (decrement-on-retry not stated → P1) |
| Batch completion owner + precedence | **Unspecified** | job-lifecycle §22 ("must be documented") | ⚠️ P1 |
| Queue vs DB enqueue-failure recovery | **Deferred, not chosen** | ADR-019, job-lifecycle §12, edge-cases §32 | ⚠️ P1 |
| Live updates | SSE + Redis pub/sub, notification-only, reconcile-on-reconnect | ADR-004/005, live-updates, arch, diagram, frontend | ✅ PASS |
| SSE initial-state delivery | **Two models** | api §12 ("send snapshot over SSE") vs live-updates §10 ("GET then subscribe") | ⚠️ P2 |
| Cache | 30s, shared (Redis), invalidate on create + state change | ADR-012, api §9, arch §21, scaling §11, edge-cases §27 | ✅ PASS |
| Cancellation (core) | conditional DB transition, terminal, DB authoritative | ADR-010/011, cancellation, diagram §6 | ✅ PASS |
| Cancel of a PENDING batch | **Not allowed by state machine, but tested** | cancellation §6 (`WHERE PROCESSING`), job-lifecycle §3, testing §14 (`PENDING→CANCELLED`) | ⚠️ P1 |
| Batch reactivation on retry-failed | **Missing transition** `FAILED→PROCESSING` | job-lifecycle §3 (no edge) vs §23 + api §15 | ⚠️ P1 |
| retry-failed on CANCELLED batch | **Conflicting guidance** | edge-cases §18 (reject) vs cancellation §19 (ambiguous) | ⚠️ P2 |
| Idempotency | at-least-once + conditional transitions | ADR-008/009, retries, job-lifecycle §24 | ✅ PASS |
| API contract (endpoints) | 6 routes, names agree across docs | api, frontend-arch, requirements, scaling, testing | ✅ PASS |
| Shared types | shared TS package/module | ADR-013, arch §28 | ✅ PASS (location TBD → P3) |
| Frontend boundaries | Server Components default, Client for interactivity/SSE; Fastify is backend | ADR-014, frontend-arch §5, arch | ✅ PASS |
| Auth | out of scope | ADR-016, api §19 | ✅ PASS |
| SSRF | acknowledged, policy deferred to pre-prod | edge-cases §37, frontend §29 | ⚠️ P1 (before prod) |
| Event `version` field | referenced but no schema column | live-updates §19, job-lifecycle §28, api §11 vs database schema | ℹ️ P3 |

---

## 3. Issue Register (classified)

### P0 - Must fix before implementation

**P0-1 - Global concurrency contract contradicted.**
`scope.md` §Worker lists "Enforce **worker-side** concurrency"; `architecture.md` §28 summary table
labels concurrency "**Worker processing control**". Both read as per-worker. ADR-007, `scaling.md` §5,
`architecture-diagram.md` §5, and `requirements.md` BR-006 say **global** (a per-worker 5 becomes 15 with
3 workers). This is CLAUDE.md hard-invariant #6. **Resolution:** state concurrency is a Redis-coordinated
global limit everywhere; fix the two offending docs. (Fixed in this pass - see §5.)

**P0-2 - Distributed concurrency slot can leak on worker crash.**
The 5-slot limit is a Redis-backed distributed semaphore (`scaling.md` §5). The only release described is a
process-local `try/finally` (`cancellation.md` §15), which does **not** run on hard crash / OOM / SIGKILL.
A crashed worker's slot is never returned → global capacity decays 5→4→…→0 and the system stalls.
The review's explicit question "can the design leak a concurrency slot?" - **yes**. **Resolution:** the slot
must be a **lease with a TTL** (or heartbeat-renewed), reclaimed automatically on expiry; the finally-release
is the fast path, TTL is the correctness path. Must be documented as an ADR + tested. (ADR-024 added.)

**P0-3 - Retry claim vs attempt_count vs BullMQ internal retry are contradictory.**
`job-lifecycle.md` §6 claims a URL with `UPDATE … SET status='PROCESSING', attempt_count=attempt_count+1
WHERE status='PENDING'` and says "if zero rows, do not assume you own the URL." But §17 + `retries.md` say a
transient failure leaves the URL **PROCESSING** during BullMQ backoff, and `diagram §3` loops a retry back to
"Claim PENDING→PROCESSING". On a BullMQ internal retry the URL is already `PROCESSING`, so the re-claim
affects **zero rows** → the worker would wrongly skip, OR `attempt_count` never reaches 4 (testing §10 asserts
it does). The claim model and the retry model cannot both be true as written. **Resolution:** pick one model
and make every doc match. Recommended (ADR-023): on a **retryable** failure the worker resets the URL to
`PENDING` inside its transaction and re-throws so BullMQ redelivers; the next run legitimately re-claims
`PENDING→PROCESSING` and increments `attempt_count`. Duplicate-delivery idempotency is preserved because only
one worker wins the conditional claim per delivery. Terminal `SUCCESS/FAILED` remain guarded by
`WHERE status='PROCESSING'`.

### P1 - Should fix before implementation

- **P1-1 - attempt_count on retry-failed / lifetime cap.** `retries.md` §24 says "max 4 attempts per URL"
  (lifetime) but `retry-failed` starts a fresh round. Decide: retry-failed **resets `attempt_count` to 0**
  and the 4-cap is **per round** (recommended, ADR-025). Otherwise the 5th lifetime attempt is blocked forever
  or `attempt_count` overflows the cap check.
- **P1-2 - Batch state machine missing edges.** Add `PENDING → CANCELLED` (cancel a not-yet-started batch;
  `testing.md` §14 already requires it) and `FAILED → PROCESSING` (retry-failed reactivation; `job-lifecycle`
  §23 + `api` §15 require it). Update the cancel conditional to `WHERE status IN ('PENDING','PROCESSING')`.
  (Fixed in this pass - see §5; ADR-026.)
- **P1-3 - Batch terminal-transition owner + precedence.** Undefined who flips the batch to
  COMPLETED/FAILED/CANCELLED and with what precedence. Decide (ADR-027): each worker, in the same transaction
  as its URL's terminal transition, re-evaluates the batch; precedence when
  `completed+failed+cancelled = total`: **CANCELLED dominates** (if batch already CANCELLED it stays), else
  **any FAILED ⇒ FAILED**, else **COMPLETED**. Guard with conditional update so it fires once.
- **P1-4 - Counter decrement on retry-failed.** `retry-failed` moves `FAILED→PENDING`; `failed_count` must be
  decremented transactionally in the same claim. Not currently stated. Document in `database.md` + `api.md` §15.
- **P1-5 - Queue/DB enqueue-failure recovery not chosen.** ADR-019 defers between outbox / reconciliation /
  retryable-enqueue but never picks one; `job-lifecycle` §12 and `edge-cases` §32 repeat the open question.
  Pick the concrete strategy (recommended, ADR-028: reliable enqueue with a bounded reconciliation sweep that
  re-enqueues `PENDING` URLs with no active job older than N seconds - no outbox needed at this scale).
- **P1-6 - SSRF policy before production.** Acknowledged (`edge-cases` §37) but undefined. Not a scaffold
  blocker; **is** a production blocker. Define the deny-list (loopback, RFC-1918, link-local `169.254/16`,
  cloud metadata `169.254.169.254`, non-HTTP(S) schemes) and post-DNS-resolution re-check before deploy.

### P2 - Can defer to implementation (decide, but won't block scaffolding)

- **P2-1** Rate-limiter algorithm: pick sliding-window (recommended, easiest to test to an exact bound) and
  make `architecture.md` §15 stop asserting it before `rate-limiting.md` commits.
- **P2-2** In-flight `PROCESSING` URL on cancel: decide whether cancel bulk-updates non-terminal URLs
  (`PENDING`,`PROCESSING`) → `CANCELLED` in the cancel transaction (recommended - makes the worker's
  `WHERE status='PROCESSING'` naturally lose the race).
- **P2-3** retry-failed on a CANCELLED batch: reject (recommended, matches `edge-cases` §18) - align
  `cancellation.md` §19.
- **P2-4** SSE initial state: `api.md` §12 implies a snapshot pushed over the SSE stream; `live-updates.md`
  §10 uses GET-then-subscribe. Pick GET-then-subscribe (SSE carries only small notifications) and align api.md.
- **P2-5** Permit ordering: `rate-limiting.md` §8 fixes concurrency-slot-before-rate-permit; §10 says ordering
  "can be optimized." A worker waiting for a rate permit while holding a concurrency slot is acceptable
  (concurrency ≥ rate is not required) but state it explicitly to avoid a self-inflicted stall interpretation.

### P3 - Documentation polish

- **P3-1** Event `version`: add a `version`/monotonic column to `batches` (or define it as derived from
  `updated_at`) so `live-updates.md` §19 has a backing field.
- **P3-2** Duplicate-URL handling is **decided** (no dedup) in `database.md` §8 but `edge-cases.md` §2 still
  says "define whether." Close the loop.
- **P3-3** `architecture.md` embeds its whole body inside a ` ```md ` fence (line 53) - renders as one code
  block. Remove the fence.
- **P3-4** `api.md` §17 lists `429` for API requests, but no inbound API rate limiting is specified. Either
  add it or drop the row.
- **P3-5** `testing.md` §24 Invariant 1 sums `pending/processing` counts that aren't stored columns - clarify
  they're derived from URL rows.

---

## 4. Distributed-System Review (summary)

| Concern | Verdict |
|---|---|
| Global rate limit | Sound (Redis atomic admission, permit at outbound edge, retries consume permits, Redis-down = pause not bypass). Algorithm undecided (P2-1). Self-healing on crash (window expiry). |
| Global concurrency | Correct **intent**, but scope contradicted (P0-1) and **slot leaks on crash** (P0-2). |
| Idempotency | Strong: at-least-once + conditional `WHERE status=…` transitions, counters only move when a row moves. Undermined only by the retry-claim ambiguity (P0-3). |
| Cancellation | Strong: conditional transition, terminal, DB authoritative, queue-cleanup is optimization, stale worker cannot resurrect. Gaps: cancel-of-PENDING (P1-2), in-flight URL disposition (P2-2). |
| Retries | 4-attempt cap consistent; classification centralized; backoff defined. Gaps: claim model (P0-3), per-round vs lifetime (P1-1). |
| Queue/DB consistency | Failure window acknowledged but recovery not chosen (P1-5). |
| SSE | Excellent: notification-only, publish-after-commit, reconcile-on-reconnect, at-least-once tolerant of dup/miss/reorder, multi-instance via Redis. Minor initial-state model split (P2-4). |
| Cache | Sound: shared cache, invalidate on create + state change, 30s max, never overrides newer DB state. |
| Horizontal scaling | API stateless; workers share limiter/semaphore/queue; SSE cross-instance via Redis. Holds **once P0-1/P0-2 are fixed**. |

---

## 5. Documentation Changes Applied in This Pass

- **`decisions.md`** - added ADR-021…ADR-028 finalizing every P0/P1 decision.
- **`scope.md`** §Worker - "Enforce worker-side concurrency" → "Apply global (Redis-coordinated) concurrency control" (P0-1).
- **`architecture.md`** §28 table - "Concurrency | Worker processing control" → "Global concurrency | Redis-backed distributed limit" (P0-1).
- **`job-lifecycle.md`** §3 - batch state diagram gains `PENDING → CANCELLED` and `FAILED → PROCESSING : retry-failed` (P1-2), with a note on the completion owner/precedence (P1-3).
- **`cancellation.md`** §3/§6 - cancel conditional widened to `status IN ('PENDING','PROCESSING')` (P1-2).

Remaining P1/P2/P3 items are recorded here and in the new ADRs as decisions to honor during implementation;
they are called out in the report to the author.

---

## 6. Acceptance Checklist

| Criterion | State |
|---|---|
| Status enums canonical | ✅ |
| State transitions canonical | ⚠️ after §5 fixes; owner/precedence still to encode (P1-3) |
| Retry semantics canonical | ⚠️ claim model (P0-3) + per-round cap (P1-1) |
| Rate limiting global (conceptual) | ✅ (algorithm P2-1) |
| Concurrency global (conceptual) | ⚠️ scope fixed (P0-1); crash-safety needs lease (P0-2) |
| PostgreSQL source of truth | ✅ |
| Idempotency defined | ✅ (pending P0-3) |
| Cancellation races handled | ✅ (pending P1-2 edges) |
| SSE reconnect / missed events | ✅ |
| Cache invalidation defined | ✅ |
| API contracts agree | ✅ |
| Frontend/backend boundaries agree | ✅ |
| Worker/API separation | ✅ |
| Horizontal scaling preserves invariants | ⚠️ after P0-1/P0-2 |
| Critical failure modes defined | ✅ (SSRF policy pre-prod, P1-6) |
| Critical invariants have tests | ✅ mapped in testing.md |
| Diagrams agree with text | ⚠️ architecture.md §16/§28 vs diagram (P0-1, fixed) |
| decision.md reflects final decisions | ✅ after ADR-021…028 |

**Close P0-2 and P0-3 (both mechanism decisions, not code) and encode P1-1…P1-4, and this set is
implementation-ready.**
