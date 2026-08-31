# URLPulse — Architecture Decision Records

**Version:** 1.0  
**Status:** Draft

This document records the important architectural decisions made for URLPulse.

The purpose is not to document every coding choice. It records decisions that affect system behavior, correctness, scalability, or trade-offs.

---

# ADR-001 — PostgreSQL Is the Source of Truth

## Decision

Use PostgreSQL as the authoritative source for batch and URL state.

## Context

BullMQ tracks work, but queue state alone is not sufficient to represent application state.

Where the source of truth lives, and whether state remains correct under retries and multiple workers, is a core correctness requirement. 

## Consequences

Positive:

- Durable state
- Transactional state transitions
- Reliable refresh behavior
- Safe idempotency checks

Negative:

- More database transactions
- Need to carefully design concurrent updates

---

# ADR-002 — BullMQ for Background Jobs

## Decision

Each submitted URL becomes its own BullMQ job.

## Context

URLPulse requires each URL to be processed as an independent background job and workers to run separately from the API. 

## Consequences

Positive:

- Independent URL processing
- Retry support
- Delayed exponential backoff
- Worker/API separation

Negative:

- Queue/database consistency must be considered
- Duplicate job execution must be handled

---

# ADR-003 — Redis for Distributed Coordination

## Decision

Use Redis for BullMQ and distributed coordination.

Redis is used for:

- BullMQ
- Global rate limiting
- Global concurrency control
- Cross-instance live-update distribution

## Context

Rate and concurrency guarantees must continue holding with multiple worker processes, and live updates must remain correct with multiple API instances. 

## Consequences

Positive:

- Shared low-latency coordination
- Existing required infrastructure serves multiple purposes

Negative:

- Redis becomes important infrastructure
- Redis failure must be handled deliberately

---

# ADR-004 — SSE for Live Updates

## Decision

Use Server-Sent Events.

## Context

The UI needs server-to-client progress updates, but the application does not require browser-to-server bidirectional streaming.

The transport mechanism is chosen deliberately and documented. 

## Consequences

Positive:

- Simple browser API
- HTTP-based
- Natural fit for one-way updates
- Less protocol complexity than WebSockets

Negative:

- Connection management is required
- Reconnection logic is required
- Cross-instance event distribution is required

---

# ADR-005 — SSE Events Are Notifications, Not State

## Decision

SSE messages contain small update notifications. The client refetches authoritative state.

## Reason

This provides resilience to:

- Missed events
- Duplicate events
- Reordered events
- Browser refresh
- API restarts

The database remains authoritative.

---

# ADR-006 — Redis-Backed Global Rate Limiter

## Decision

Implement the 10 requests/sec limit using shared Redis state.

## Context

The requirement is global across the entire system, not per URL or worker. 

## Reason

A worker-local limiter would violate the requirement when multiple workers run.

## Consequences

Every outbound request must acquire a shared permit.

---

# ADR-007 — Distributed Global Concurrency Limit

## Decision

Enforce the maximum 5 in-flight URL checks globally rather than per worker.

## Reason

A local worker semaphore would multiply the limit when worker count increases.

Example:

```text
3 workers × 5 local slots = 15 concurrent requests
```

which violates the requirement.

---

# ADR-008 — At-Least-Once Processing + Idempotent State Transitions

## Decision

Do not claim exactly-once HTTP execution.

Use:

```text
at-least-once job execution
+
idempotent database transitions
```

## Reason

A worker can crash after an external HTTP request but before persisting the result.

It is not possible to reliably know whether the external side effect occurred.

The database can, however, guarantee that logical completion is not double-counted.

---

# ADR-009 — Conditional Database State Transitions

## Decision

State transitions use conditional updates or equivalent transactional locking.

Example:

```sql
UPDATE urls
SET status = 'SUCCESS'
WHERE id = $1
  AND status = 'PROCESSING';
```

## Reason

This prevents duplicate jobs and stale workers from applying the same logical transition twice.

---

# ADR-010 — Queue Cleanup Is an Optimization

## Decision

Cancellation does not depend on successfully deleting every BullMQ job.

Workers verify current PostgreSQL state before starting external work.

## Reason

Queue deletion and worker execution can race.

Database state provides the reliable correctness boundary.

---

# ADR-011 — Cancellation Is Terminal

## Decision

Once a batch is cancelled, stale workers cannot move it back to processing or completed.

## Reason

Cancellation must remain correct against both queued and in-flight jobs. 

---

# ADR-012 — Batch List Uses a 30-Second Shared Cache

## Decision

The batch list endpoint is cached for 30 seconds.

Cache invalidation occurs on relevant mutations.

## Reason

URLPulse requires a 30-second cache while also requiring that creation and state changes do not produce user-visible stale data. 

---

# ADR-013 — Shared Types Between Client and Server

## Decision

Define API/domain types in a shared TypeScript package/module.

## Reason

URLPulse requires shared types between client and server. 

This reduces drift between:

```text
Fastify API
Next.js client
```

---

# ADR-014 — Next.js Server Components by Default

## Decision

Use Server Components where server rendering/data fetching is useful and Client Components only where browser interactivity requires them.

## Reason

URLPulse makes deliberate use of Next.js routing, server/client boundaries, and data-fetching choices. 

---

# ADR-015 — Separate API and Worker Processes

## Decision

The API never performs long-running URL health checks.

Workers run separately.

## Reason

URLPulse requires workers to run in a separate process from the API. 

This also allows worker capacity to scale independently from HTTP traffic.

---

# ADR-016 — No Authentication

## Decision

Authentication is not implemented.

## Reason

Authentication is out of scope for the current product. 

---

# ADR-017 — Function Over Visual Complexity

## Decision

Prioritize correctness and usability over polished visual features.

## Reason

Visual design is not a priority, and charts and polished UI are out of scope for the current product. 

---

# ADR-018 — Assumptions Must Be Explicit

## Decision

Ambiguities that are not clarified with the company are recorded in the README and/or architecture decisions.

## Reason

URLPulse records explicit assumptions rather than silently introducing behavior when requirements leave details open. 

---

# ADR-019 — Queue/Database Atomicity Trade-Off

## Decision

The initial implementation may use:

```text
PostgreSQL transaction
↓
commit
↓
enqueue BullMQ jobs
```

with an explicit recovery/reconciliation strategy rather than introducing a full transactional outbox unless implementation complexity requires it.

## Context

There is a failure window between database commit and queue enqueue.

## Trade-Off

A transactional outbox provides stronger guarantees but introduces:

- Another persistence concept
- An outbox processor
- More implementation time

At the current stage, the simplest defensible recovery strategy is preferable.

**Superseded by ADR-028:** the selected approach is reliable enqueue + a reconciliation sweep.

---

# ADR-020 — Correctness Over Availability for Distributed Limits

## Decision

If Redis is unavailable and global rate/concurrency guarantees cannot be safely enforced, workers should not bypass the controls with local fallbacks.

## Reason

Violating a hard system requirement is worse than temporarily pausing processing.

---

# ADR-021 — Global Concurrency Is Never Per-Worker (Consistency Pass)

## Decision

The maximum of 5 in-flight checks is **global and Redis-coordinated**. No document or
implementation may describe or implement it as a worker-local limit.

## Reason

A per-worker "5" multiplies with worker count (3 workers → 15), violating the requirement.
This ADR exists because `scope.md` and `architecture.md` previously carried "worker-side"
wording; those are corrected. See ADR-007.

---

# ADR-022 — Concurrency Slots Are Leased With a TTL

## Decision

Each global concurrency slot is acquired as a **lease with an expiry (TTL)** in Redis, not a
plain counter decrement. A worker renews (or holds a short-lived) lease for the duration of its
outbound request and releases it in `finally`. If a worker crashes, the lease **expires
automatically** and the slot returns to the pool.

## Reason

A process-local `try/finally` release does not run on hard crash (SIGKILL/OOM). Without a TTL,
crashed workers permanently leak global slots until capacity reaches zero and the system stalls.
The `finally` release is the fast path; the TTL is the correctness guarantee.

## Consequences

- TTL must exceed the maximum request timeout so a slow-but-alive request is not double-granted.
- A test must prove capacity recovers after a simulated crash.

---

# ADR-023 — Retryable Failures Reset the URL to PENDING for Re-Claim

## Decision

On a **retryable** failure, the worker, inside its completion transaction, transitions the URL
`PROCESSING → PENDING` and re-throws so BullMQ redelivers after backoff. The next delivery
re-claims `PENDING → PROCESSING` conditionally and increments `attempt_count`. Terminal
`SUCCESS`/`FAILED` transitions remain guarded by `WHERE status = 'PROCESSING'`.

## Reason

Earlier docs both (a) claimed URLs with `WHERE status='PENDING'` incrementing `attempt_count`,
and (b) said a URL "stays PROCESSING during backoff." Those are mutually exclusive: a re-delivery
would find `PROCESSING` and either wrongly skip or never increment attempts. Resetting to
`PENDING` makes the claim, the attempt count, and duplicate-delivery idempotency all consistent
under one rule. Duplicate deliveries still race on the single conditional claim — only one wins.

---

# ADR-024 — retry-failed Resets attempt_count; the 4-Attempt Cap Is Per Round

## Decision

The 4-attempt maximum (1 + 3) is enforced **per processing round**. When the user invokes
`retry-failed`, each claimed `FAILED → PENDING` transition **resets `attempt_count` to 0** and a
fresh BullMQ job (with its own `attempts: 4`) is created.

## Reason

`retry-failed` is an explicit new user-initiated round. A lifetime cap would either block a
legitimate retry forever or make the cap check compare against an ever-growing counter. Per-round
is the behavior tests already assume (a retried URL runs up to 4 attempts again).

---

# ADR-025 — Batch Terminal Transition: Owner and Precedence

## Decision

Each worker, in the **same transaction** as its URL's terminal transition, re-evaluates the batch.
When `completed_count + failed_count + cancelled_count = total_count`, it conditionally sets the
batch's terminal status with this precedence:

1. If the batch is already `CANCELLED`, it stays `CANCELLED`.
2. Else if `failed_count > 0` → `FAILED`.
3. Else → `COMPLETED`.

The update is conditional (`WHERE status = 'PROCESSING'`) so exactly one worker performs it and a
completion race cannot double-apply or reopen a terminal batch.

## Reason

`job-lifecycle.md` left the owner and mixed-state precedence undefined. Co-locating the check with
the counter update keeps it atomic and idempotent.

---

# ADR-026 — Cancellation Applies to PENDING and PROCESSING Batches

## Decision

A batch may be cancelled from `PENDING` **or** `PROCESSING`. The cancel transition is conditional:
`WHERE status IN ('PENDING','PROCESSING')`. In the same transaction, non-terminal URLs
(`PENDING`,`PROCESSING`) are set to `CANCELLED`; `SUCCESS`/`FAILED` URLs are left as-is.

## Reason

A freshly created batch sits in `PENDING` with queued jobs; a user can cancel in that window.
The prior conditional (`WHERE status='PROCESSING'`) silently no-op'd that case, and `testing.md`
already asserts `PENDING → CANCELLED`. Bulk-cancelling in-flight URLs makes the worker's
`WHERE status='PROCESSING'` completion naturally lose the race, preserving cancellation.

---

# ADR-027 — retry-failed Is Rejected on a CANCELLED Batch

## Decision

`retry-failed` on a `CANCELLED` batch returns a `409 Conflict` and performs no work. Resuming a
cancelled batch, if ever wanted, is a separate explicit product operation.

## Reason

Resolves the conflict between `edge-cases.md` §18 (reject) and `cancellation.md` §19 (ambiguous).
A cancelled batch is terminal; its non-successful URLs are `CANCELLED`, not `FAILED`, so there is
nothing for `retry-failed` to legitimately select.

---

# ADR-028 — Queue/DB Recovery: Reliable Enqueue + Reconciliation Sweep

## Decision

Batch creation commits the DB transaction, then enqueues jobs. To close the commit-then-enqueue-fails
window, a periodic **reconciliation sweep** re-enqueues any `PENDING` URL that has no active BullMQ
job and whose `created_at`/`updated_at` is older than a threshold. No transactional outbox is
introduced at this scale.

## Reason

Supersedes the open choice in ADR-019. The sweep is the simplest defensible recovery within scope
and needs no new persistence concept. The final threshold and sweep interval are implementation
configuration and must be documented with the worker.

---

# Decision Summary

| Decision | Choice |
|---|---|
| State source of truth | PostgreSQL |
| Queue | BullMQ |
| Coordination | Redis |
| Live transport | SSE |
| Global rate limit | Redis-backed |
| Global concurrency | Redis-backed, global, TTL-leased (never per-worker) |
| Processing semantics | At-least-once |
| State idempotency | Conditional DB transitions |
| Cancellation | Terminal + DB authoritative |
| API scaling | Stateless |
| Worker scaling | Shared BullMQ |
| API/worker separation | Separate processes |
| Client/server types | Shared TypeScript |
| Auth | Out of scope |
| UI priority | Function over polish |
