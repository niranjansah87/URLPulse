# URLPulse - Scaling & Horizontal Deployment

**Version:** 1.0  
**Status:** Draft

---

# 1. Purpose

This document explains how URLPulse behaves when the API and worker processes are scaled horizontally.

The architecture must preserve URLPulse's system guarantees:

```text
10 HTTP requests/sec globally
5 checks in flight
up to 3 retries per transient failure
correct state under multiple workers
correct live updates under multiple API instances
```

---

# 2. Horizontal API Scaling

API instances are stateless.

Example:

```text
              Load Balancer
              /     |     \
          API 1   API 2   API 3
             \      |      /
              PostgreSQL
                 |
                Redis
```

Any API instance can serve any request.

The client must not depend on a sticky session.

---

# 3. Source of Truth

PostgreSQL remains authoritative for:

- Batch state
- URL state
- Progress counters
- Results
- Retry eligibility
- Cancellation state

API instance memory is never authoritative.

---

# 4. Horizontal Worker Scaling

Multiple workers consume the same BullMQ queue.

```text
              Redis / BullMQ
              /      |      \
        Worker 1  Worker 2  Worker 3
              \      |      /
               PostgreSQL
```

BullMQ distributes jobs among workers.

---

# 5. Global Concurrency

The requirement is:

```text
5 URL checks in flight globally
```

A worker-local limit of 5 is incorrect.

For example:

```text
Worker 1 → 5
Worker 2 → 5
```

would produce:

```text
10 concurrent checks
```

Therefore concurrency must be coordinated globally.

The chosen implementation should use a Redis-backed distributed semaphore/limiter or equivalent shared mechanism.

---

# 6. Global Rate Limit

The requirement is:

```text
10 outbound HTTP requests/sec globally
```

The limiter must be shared across every worker.

```text
Worker 1 ─┐
Worker 2 ─┼──> Redis global limiter
Worker 3 ─┘
```

This prevents worker count from increasing the allowed request rate.

---

# 7. Queue Durability

BullMQ/Redis represents pending work.

If an API process crashes:

```text
database state remains
queue remains
```

If a worker crashes:

```text
eligible job can be recovered/reprocessed
```

The worker must still consult PostgreSQL before performing work.

---

# 8. Multiple API Instances and SSE

SSE connections are local TCP connections.

Therefore:

```text
Client A → API 1
Client B → API 2
```

must both receive updates.

Redis provides cross-instance event distribution:

```text
Worker
  ↓
Redis pub/sub
  ├── API 1 → Client A
  └── API 2 → Client B
```

---

# 9. Load Balancer

The load balancer may distribute:

```text
GET /batches
GET /batches/:id
POST /batches
POST /batches/:id/cancel
POST /batches/:id/retry-failed
```

SSE connections may remain attached to whichever API instance accepted them.

No sticky session is required for correctness.

---

# 10. SSE Instance Failure

If the API instance holding an SSE connection dies:

```text
connection closes
      ↓
browser reconnects
      ↓
load balancer selects another API
      ↓
client refetches batch
      ↓
SSE resumes
```

Because state is in PostgreSQL, the client does not lose authoritative progress.

---

# 11. Cache Scaling

The batch-list cache must not become inconsistent across API instances.

A process-local cache is problematic:

```text
API 1 cache = old
API 2 cache = new
```

For horizontal deployment, use a shared cache such as Redis or a platform-level shared cache.

Cache invalidation occurs immediately (a shared Redis version counter, bumped
with `INCR`, so it holds across all API instances) on every batch-level state
change:

- A batch is created (API)
- A batch is cancelled or retry-failed is invoked (API)
- A batch goes PENDING → PROCESSING when its first URL is claimed (worker)
- A batch goes → COMPLETED/FAILED when its last URL completes (worker)

The worker bumps the same version key the API cache uses. Per-URL progress
*within* a batch is intentionally not invalidated (that would defeat the cache);
the 30-second TTL bounds any such intermediate staleness, and the batch detail
view is uncached and live (SSE), so processing is always observed in real time
there.

The 30-second cache lifetime remains the maximum staleness for the list view.

---

# 12. Batch Creation Under Multiple APIs

Two API instances can receive:

```text
POST /batches
```

simultaneously.

PostgreSQL handles authoritative persistence.

Each request receives its own batch ID.

No process-local coordination is necessary.

---

# 13. Cancellation Under Multiple APIs

Example:

```text
Client A → API 1 → cancel
Client B → API 2 → cancel
```

Both requests may race.

PostgreSQL conditional state transitions determine the winner.

The second request observes the already-cancelled state.

---

# 14. Retry-Failed Under Multiple APIs

Example:

```text
Client A → API 1 → retry-failed
Client B → API 2 → retry-failed
```

The database must atomically claim failed URLs.

Only successfully claimed rows become eligible for new jobs.

This prevents duplicate retry work.

---

# 15. Worker Idempotency

Even with correct queue distribution, duplicate execution can occur.

Therefore worker state transitions remain conditional.

Scaling workers does not change the idempotency model.

---

# 16. Failure of One Worker

If Worker 2 dies:

```text
Worker 1 ─┐
Worker 2 ✕ ├── BullMQ
Worker 3 ─┘
```

Other workers continue.

The global rate/concurrency controls continue to coordinate through Redis.

---

# 17. Failure of Redis

Redis has multiple responsibilities:

```text
BullMQ
Global concurrency coordination
Global rate limiting
Cross-instance live-update distribution
```

Therefore Redis failure affects more than caching.

The application should fail safely rather than silently bypass global controls.

In particular:

> Workers must not fall back to independent local rate/concurrency limits if that could violate the global guarantees.

---

# 18. Failure of PostgreSQL

PostgreSQL is the source of truth.

If PostgreSQL is unavailable:

```text
state cannot be safely read/written
```

Workers should not invent state in memory.

API mutations should fail clearly.

---

# 19. Scaling Strategy

The simplest initial production topology is:

```text
                Load Balancer
                 /    |    \
               API   API   API
                 \    |    /
                   Redis
                  /    \
             BullMQ    Pub/Sub
              / | \
             W  W  W

                   |
              PostgreSQL
```

---

# 20. What Scaling Does Not Change

Adding workers or API instances must not change:

```text
global rate limit
global concurrency limit
state transitions
retry count
idempotency semantics
```

These are system-level guarantees.

---

# 21. What Would Change at Larger Scale?

Potential future improvements:

- Managed PostgreSQL
- Managed Redis
- Separate Redis deployments by workload
- Read replicas
- Dedicated event infrastructure
- More advanced queue partitioning
- Metrics and distributed tracing
- Autoscaling workers based on queue depth

These are intentionally beyond the current product scope.

---

# 22. Related Documents

```text
docs/02-architecture/architecture.md
docs/03-backend/rate-limiting.md
docs/03-backend/job-lifecycle.md
docs/03-backend/retries-and-idempotency.md
docs/03-backend/cancellation.md
docs/04-frontend/live-updates.md
```
