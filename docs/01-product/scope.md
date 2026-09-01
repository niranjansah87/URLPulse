
# URLPulse - Scope

**Version:** 1.0
**Status:** Draft

---

## 1. Purpose

This document defines the implementation scope for URLPulse.

URLPulse has a deliberately focused scope. Scope is intentionally limited to the functionality required to deliver:

- Full-stack development
- Background job processing
- Distributed rate limiting
- Concurrency control
- Retry handling
- Idempotency
- Persistent state management
- Live progress updates
- Horizontal scalability
- Type-safe client/server communication

The goal is not to build a production SaaS product with every supporting feature.

The goal is to build a small but technically sound system that can be reasoned about and defended.

---

# 2. In Scope

## 2.1 Batch Creation

Users can create a batch of URLs through:

- Pasted URL list
- CSV upload

A batch represents one submitted collection of URLs.

The batch and all URL records are persisted before processing begins.

---

## 2.2 URL Processing

Each URL is processed independently through a background job.

The system records:

- Final HTTP status code
- Response time
- Page title when available
- Processing status
- Failure information when applicable

---

## 2.3 Background Workers

URL processing runs in a worker process separate from the API.

BullMQ manages background jobs.

Redis provides the shared infrastructure required by BullMQ and distributed coordination.

Multiple worker processes must be able to process jobs without violating global processing guarantees.

---

## 2.4 Global Rate Limiting

The system enforces:

```text
Maximum HTTP requests:
10 requests / second globally
```

The limit applies across all workers.

For example:

```text
Worker A ─┐
Worker B ─┼──> Shared rate limiter ──> External URLs
Worker C ─┘
```

The system must not accidentally become:

```text
Worker A → 10 req/sec
Worker B → 10 req/sec
Worker C → 10 req/sec
```

---

## 2.5 Concurrency Control

The system limits active URL checks to:

```text
5 concurrent checks (global, across all workers)
```

Concurrency is enforced independently from the global rate limit, and - like the rate limit - is
a single global limit coordinated through Redis, not a per-worker limit.

---

## 2.6 Retry Handling

Transient URL-processing failures may be retried.

The system supports:

* Up to 3 retries
* Exponential backoff
* Retry-safe state updates

Successful work must not be unnecessarily repeated.

---

## 2.7 Batch Dashboard

The UI includes:

### Batch List

Shows existing batches.

### Batch Detail

Shows:

* Batch information
* Progress
* URL results
* Current status
* Controls

---

## 2.8 Addressable Batches

Each batch has a unique URL.

For example:

```text
/batches/:batchId
```

Opening that URL directly must work without relying on client state from another page.

---

## 2.9 Live Progress

The batch detail page updates as URL processing completes.

The user should not need to manually refresh the page during normal processing.

---

## 2.10 Refresh Recovery

Refreshing the batch page during processing must reconstruct the correct state from persisted application state.

---

## 2.11 Live Connection Recovery

If the browser loses its live-update connection, it must be able to recover without corrupting or permanently losing batch state.

---

## 2.12 Multiple API Instances

The architecture must remain correct when multiple API instances are running.

No critical application state may depend on memory local to a single API process.

---

## 2.13 Batch Cancellation

Users can cancel a running batch.

Cancellation must correctly account for:

* Queued jobs
* Jobs already in flight

Persisted state must remain authoritative.

---

## 2.14 Retry Failed

Users can retry failed URLs.

The operation must:

* Select only failed URLs
* Preserve successful results
* Create new work only for failed URLs
* Maintain correct batch progress

---

## 2.15 Batch List Caching

The batch-list endpoint uses a 30-second cache.

Important mutations must invalidate or otherwise bypass stale cached state so the user does not see an incorrectly stale batch list.

---

## 2.16 Shared Types

Relevant domain/API types are shared between frontend and backend.

Runtime validation is still performed at external input boundaries.

---

# 3. Out of Scope

The following are intentionally excluded.

## 3.1 Authentication — now IN scope (intentional extension)

Authentication was originally out of scope; it has since been added as a
deliberate extension. URLPulse now has email/password authentication via Better
Auth, with PostgreSQL-backed sessions, and every batch is owned by and scoped to
the authenticated user. See `docs/03-backend/authentication.md`.

Still excluded (kept minimal): OAuth/social login, MFA, email verification,
organizations/teams, and role-based access control.

---

## 3.2 Authorization

Ownership-based only: a user may access and mutate exactly their own batches
(cross-user access returns 404). There is no role-based access control or
permission system beyond that ownership boundary.

---

## 3.3 Notifications

No:

* Email notifications
* Push notifications
* Slack notifications
* Webhooks

---

## 3.4 Charts

No analytical charts or visualization dashboards.

Basic progress indicators are sufficient.

---

## 3.5 Advanced UI Polish

The project does not require:

* Complex animations
* Advanced transitions
* Elaborate design systems
* Highly polished marketing pages

Functionality is prioritized over visual design.

---

## 3.6 URL Scheduling

Users cannot schedule future URL checks.

---

## 3.7 Recurring Monitoring

URLPulse does not continuously monitor URLs after a batch completes.

A batch represents a specific checking operation.

---

## 3.8 Historical Monitoring

No long-term uptime history or monitoring analytics.

---

## 3.9 User-Defined Rate Limits

The global rate limit is fixed by the system requirements.

Users cannot configure their own rate limits.

---

## 3.10 Distributed Deployment Infrastructure

The project demonstrates an architecture capable of horizontal scaling but does not require:

* Kubernetes
* Terraform
* Cloud-specific deployment automation
* Service mesh
* Multi-region deployment

---

# 4. Scope Boundaries

The following distinction is important.

### Required

```text
Correctness
Reliability
Background processing
Rate limiting
Concurrency
Retries
Idempotency
Live updates
Persistence
Horizontal API correctness
```

### Not Required

```text
Notifications
Charts
Advanced analytics
Highly polished UI
Production cloud deployment
```

Notifications, charts, and polished UI are out of scope for the current product.
Authentication is an intentional in-scope extension (see §3.1).

---

# 5. Technical Scope

## Frontend

```text
Next.js
React
TypeScript
```

Responsibilities:

* URL submission UI
* CSV upload UI
* Batch list
* Batch detail
* Progress display
* Result display
* Cancellation
* Retry failed
* Live-update client

---

## API

```text
Fastify
Node.js
TypeScript
```

Responsibilities:

* Validate requests
* Create batches
* Persist application state
* Enqueue jobs
* Query batch state
* Cancel batches
* Retry failed URLs
* Provide live-update connections
* Manage cache invalidation

The API does not perform URL health checks directly.

---

## Worker

```text
Node.js
TypeScript
BullMQ
```

Responsibilities:

* Consume URL jobs
* Perform URL checks
* Apply global request-rate control
* Apply global (Redis-coordinated) concurrency control
* Retry transient failures
* Persist results
* Publish state-change notifications

---

## PostgreSQL

Responsibilities:

* Batch persistence
* URL persistence
* URL results
* State transitions
* Progress-related data

PostgreSQL is the source of truth.

---

## Redis

Responsibilities:

* BullMQ job infrastructure
* Distributed rate limiting
* Cross-process event propagation
* Optional short-lived cache infrastructure where appropriate

Redis is not the authoritative store for batch state.

---

# 6. Scope Decision Principles

When a proposed feature is considered during implementation, evaluate it using:

### Does it satisfy a stated requirement?

If yes, prioritize it.

### Does it improve correctness of a required feature?

If yes, consider it.

### Does it make a required distributed-system guarantee safer?

If yes, consider it.

### Is it purely cosmetic?

Defer it unless the core functionality is complete.

### Does it introduce substantial infrastructure without satisfying a requirement?

Avoid it.

---

# 7. Implementation Priority

## Priority 1 - Core Correctness

```text
Database
Batch creation
URL persistence
BullMQ jobs
Worker
URL checking
Results
```

---

## Priority 2 - Distributed Guarantees

```text
Global rate limiting
Concurrency
Retries
Idempotency
Cancellation
Retry failed
```

---

## Priority 3 - User Experience

```text
Batch list
Batch detail
Progress
Live updates
Refresh recovery
Error states
```

---

## Priority 4 - Supporting Infrastructure

```text
Caching
Docker
Testing
Documentation
Scaling validation
```

---

## Priority 5 - Polish

Only after the above is stable:

```text
UI refinement
Minor UX improvements
Developer experience improvements
```

---

# 8. Scope Completion Criteria

The project is within acceptable scope when a reviewer can:

1. Submit a list of URLs.
2. Upload a CSV.
3. Observe jobs being processed in the background.
4. See results appear.
5. Refresh the page while processing.
6. Open a batch directly in a new tab.
7. Cancel a running batch.
8. Retry only failed URLs.
9. Observe correct behavior under retries.
10. Verify the 10 requests/sec global limit.
11. Verify the 5-check concurrency limit.
12. Run multiple workers without breaking those guarantees.
13. Understand why each infrastructure component exists.

These areas directly correspond to the product's functional requirements.

---

# 9. Scope Change Rule

Any feature added after implementation begins should answer:

> What requirement does this satisfy?

If the answer is unclear, the feature should generally not be added at this stage.

This protects the project from spending the limited implementation time on low-value work.
