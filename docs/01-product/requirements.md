# URLPulse - System Requirements

**Version:** 1.0
**Status:** Draft

---

# 1. Purpose

This document translates the URLPulse product requirements into explicit, testable system requirements.

Requirements are grouped into:

- Functional requirements
- Background processing requirements
- Consistency requirements
- Live-update requirements
- API requirements
- Frontend requirements
- Caching requirements
- Type-safety requirements
- Scalability requirements

The requirements in this document define the functional and non-functional behavior of URLPulse.

---

# 2. Functional Requirements

## FR-001 - Batch Submission

The system MUST allow a user to submit multiple URLs as a single batch.

### Acceptance Criteria

- User can provide multiple URLs.
- A unique batch identifier is generated.
- The API returns enough information for the client to track the batch.

---

## FR-002 - URL List Input

The system MUST support URLs supplied as a pasted list.

The implementation MUST define how URLs are separated and validated.

---

## FR-003 - CSV Input

The system MUST support uploading a CSV containing URLs.

The implementation MUST validate the CSV and reject invalid input according to documented validation rules.

---

## FR-004 - Batch Persistence

The system MUST persist the batch in PostgreSQL before URL checking begins.

---

## FR-005 - URL Persistence

Every URL belonging to a batch MUST be persisted in PostgreSQL before URL checking begins.

---

## FR-006 - Independent URL Jobs

Each URL MUST be represented by its own background job.

A failure of one URL MUST NOT inherently prevent other URLs in the batch from being processed.

---

# 3. URL Health Requirements

## FR-007 - HTTP Status

The system MUST record the final HTTP status code for a successfully completed HTTP check when one is available.

---

## FR-008 - Response Time

The system MUST record the response time of each URL check.

The unit and measurement boundary MUST be documented by the implementation.

---

## FR-009 - Page Title

The system MUST capture the page title when one exists.

If a page does not contain a title, the absence of a title MUST be represented without causing the entire URL check to fail unnecessarily.

---

## FR-010 - Failure Information

When a URL cannot be successfully processed, the system MUST persist sufficient information to represent the failed state.

The exact error classification will be defined in the backend design.

---

# 4. Background Processing Requirements

## BR-001 - Separate Worker

URL-checking jobs MUST be processed by a worker process separate from the API process.

---

## BR-002 - BullMQ

BullMQ MUST be used to manage URL-checking background jobs.

---

## BR-003 - Redis

Redis MUST support the BullMQ infrastructure and any required distributed coordination.

---

## BR-004 - Global Rate Limit

The entire system MUST NOT exceed:

**10 HTTP requests per second.**

This limit applies globally across all worker processes.

---

## BR-005 - Multi-Worker Rate Limit

The global 10 requests/second requirement MUST remain valid when more than one worker process is running.

A worker-local or process-local rate limiter alone is insufficient.

---

## BR-006 - Maximum Concurrency

The system MUST limit URL checks to a maximum of:

**5 concurrent checks in flight.**

---

## BR-007 - Independent Constraints

The implementation MUST enforce both:

```text
Maximum concurrent checks: 5
Maximum HTTP request rate: 10/sec globally
```

Satisfying one requirement MUST NOT be assumed to satisfy the other.

---

# 5. Retry Requirements

## RR-001 - Retry Transient Failures

Transient failures MUST be eligible for retry.

The exact retryable failure classification MUST be documented.

---

## RR-002 - Maximum Retries

A URL check MUST NOT exceed 3 retries.

This means the system may perform the initial attempt plus up to three retry attempts, depending on the selected BullMQ configuration.

The final interpretation MUST be made explicit in the implementation documentation.

---

## RR-003 - Exponential Backoff

Retries MUST use exponential backoff.

---

## RR-004 - Successful URLs

A successfully completed URL MUST NOT be retried unnecessarily.

---

## RR-005 - Permanent Failures

Failures determined to be non-transient SHOULD NOT be retried unnecessarily.

---

# 6. Persistence Requirements

## PR-001 - PostgreSQL Source of Truth

PostgreSQL MUST be the authoritative source of application state.

---

## PR-002 - Persist Before Processing

The system MUST persist the batch and URL records before URL processing begins.

---

## PR-003 - Persist URL Results

URL processing results MUST be persisted in PostgreSQL.

---

## PR-004 - Persist Batch State

Batch state MUST be persisted.

---

## PR-005 - Refresh Safety

The correct batch state MUST be reconstructable from persisted state after a browser refresh.

---

## PR-006 - Cold Navigation

Opening a batch URL in a new browser tab without previous client state MUST produce the correct batch state.

---

# 7. Idempotency Requirements

## IR-001 - Duplicate Job Safety

The system MUST tolerate duplicate or repeated execution of a URL-processing job without corrupting application state.

---

## IR-002 - Counter Safety

Duplicate job execution MUST NOT incorrectly increment batch progress counters multiple times.

---

## IR-003 - Result Safety

A stale or duplicate job completion MUST NOT overwrite a newer valid state incorrectly.

---

## IR-004 - State Transition Safety

Database state transitions SHOULD be conditional or otherwise protected against invalid concurrent updates.

---

# 8. Live Update Requirements

## LR-001 - Automatic Updates

The batch detail page MUST reflect URL completion without requiring manual refresh.

---

## LR-002 - Progress Updates

Batch progress MUST update as URL processing results become available.

---

## LR-003 - Refresh Recovery

Refreshing the page during processing MUST produce the complete and correct persisted state.

---

## LR-004 - Connection Recovery

The client MUST recover correctly after a dropped live-update connection.

---

## LR-005 - Multiple API Instances

Live updates MUST remain correct when more than one API instance serves clients.

---

## LR-006 - Live Transport Is Not Source of Truth

The live-update mechanism MUST NOT be treated as the authoritative source of batch state.

---

# 9. Batch Requirements

## B-001 - Batch List

The system MUST provide a view that lists batches.

---

## B-002 - Batch Detail

The system MUST provide a view for an individual batch.

---

## B-003 - Addressable Batch

Every batch MUST have a unique addressable URL.

---

## B-004 - Running Batch

A batch URL MUST correctly represent a batch that is still running.

---

## B-005 - Completed Batch

A batch URL MUST correctly represent a completed batch.

---

# 10. Cancellation Requirements

## C-001 - Cancel Batch

The user MUST be able to request cancellation of a batch.

---

## C-002 - Queued Jobs

Cancellation MUST correctly handle jobs that have not started processing.

---

## C-003 - In-Flight Jobs

Cancellation MUST correctly handle jobs that are already being processed.

---

## C-004 - Persisted Cancellation

Cancellation state MUST be persisted.

---

## C-005 - Cancellation Race

A worker finishing around the same time as cancellation MUST NOT leave the database in an invalid or contradictory state.

---

## C-006 - UI Consistency

The state presented to the user MUST reflect the authoritative persisted state.

---

# 11. Retry Failed Requirements

## RF-001 - Retry Failed Only

The system MUST provide an operation to retry failed URLs.

---

## RF-002 - Failed URLs Only

The retry operation MUST select only URLs that ended in a failed state.

---

## RF-003 - Preserve Success

Successful URLs MUST NOT be unnecessarily reprocessed.

---

## RF-004 - Persist New Processing State

Retried URLs MUST transition through the appropriate persisted processing states.

---

# 12. Caching Requirements

## CA-001 - Batch List Cache

The batch list endpoint MUST be served from a 30-second cache.

---

## CA-002 - Mutation Invalidation

Creating a batch MUST NOT leave the user-visible batch list incorrectly stale.

---

## CA-003 - State Mutation Invalidation

Important batch state changes MUST be reflected appropriately despite the 30-second cache requirement.

---

## CA-004 - Cache Is Not Source of Truth

The cache MUST NOT replace PostgreSQL as the authoritative application state.

---

# 13. Type Safety Requirements

## TS-001 - TypeScript

The frontend MUST use TypeScript.

---

## TS-002 - Backend TypeScript

The backend MUST use TypeScript.

---

## TS-003 - Shared Types

Client and server MUST share relevant API/domain types.

---

## TS-004 - Runtime Validation

External input MUST be validated at runtime.

TypeScript compile-time types alone MUST NOT be considered sufficient validation for untrusted input.

---

# 14. Frontend Requirements

## FE-001 - Next.js

The frontend MUST use Next.js.

---

## FE-002 - Deliberate Data Fetching

Data fetching decisions MUST be deliberate regarding:

* Server Components
* Client Components
* Client-side state
* API calls
* Cache behavior

---

## FE-003 - Routing

The application MUST use appropriate Next.js routing for:

* Batch list
* Batch detail

---

## FE-004 - Loading State

The UI MUST communicate loading states where appropriate.

---

## FE-005 - Error State

The UI MUST communicate meaningful error states.

---

# 15. API Requirements

The exact API contract will be defined in:

`docs/03-backend/api.md`

The API MUST provide functionality sufficient to support:

* Batch creation
* Batch listing
* Batch detail retrieval
* Live updates
* Batch cancellation
* Retry failed URLs

Potential endpoint structure:

```text
POST   /batches
GET    /batches
GET    /batches/:id
GET    /batches/:id/events
POST   /batches/:id/cancel
POST   /batches/:id/retry-failed
```

The final API design is an implementation decision and may change before coding.

---

# 16. Infrastructure Requirements

## INF-001 - PostgreSQL

PostgreSQL MUST be used for persistent application state.

---

## INF-002 - Redis

Redis MUST be used as part of the background processing infrastructure.

---

## INF-003 - BullMQ

BullMQ MUST manage URL-processing jobs.

---

## INF-004 - Separate Processes

At minimum, the system must conceptually separate:

```text
Web Application
API
Worker
PostgreSQL
Redis
```

---

## INF-005 - One-Command Startup

The entire system MUST be runnable using a documented single command.

---

# 17. Horizontal Scaling Requirements

## HS-001 - Multiple API Instances

The application MUST remain correct when multiple API instances serve requests.

---

## HS-002 - Shared State

API instances MUST NOT rely on local in-memory application state for authoritative batch state.

---

## HS-003 - Multiple Workers

The system MUST support more than one worker process without violating the global 10 requests/second limit.

---

## HS-004 - Shared Coordination

Any coordination that must span processes MUST use shared infrastructure rather than process-local memory.

---

# 18. Non-Functional Requirements

## NFR-001 - Correctness

Correct persisted state is more important than optimistic UI behavior.

---

## NFR-002 - Reliability

A temporary failure in one component SHOULD NOT unnecessarily corrupt persisted application state.

---

## NFR-003 - Observability

Important failures and processing states SHOULD be observable through logs or equivalent development diagnostics.

---

## NFR-004 - Maintainability

The system SHOULD have clear separation between:

* API logic
* Domain logic
* Database access
* Queue management
* Worker processing
* Frontend presentation

---

## NFR-005 - Testability

Important distributed-system guarantees MUST be testable.

At minimum, testing should cover:

* Global rate limiting
* Concurrency
* Retries
* Idempotency
* Cancellation
* Retry failed
* Live update recovery

---

# 19. Requirement Priority

Requirements are classified conceptually as follows.

## Critical

These must work correctly before submission:

* Global 10 req/sec rate limit
* Maximum 5 concurrency
* Background jobs
* PostgreSQL persistence
* Retry behavior
* Idempotency
* Cancellation
* Retry failed only
* Live update recovery
* Refresh-safe state
* Multi-worker correctness
* Shared types

## Important

These must be implemented but are less likely to require extensive optimization:

* CSV upload
* Batch listing
* Batch detail
* Page title extraction
* 30-second caching
* Error presentation

## Secondary

These improve usability but should not consume excessive implementation time:

* Visual polish
* Advanced animations
* Extensive filtering
* Complex UI interactions

URLPulse prioritizes functionality and correctness over visual design.

---

# 20. Requirement Traceability

Each critical requirement should eventually map to:

```text
Requirement
    ↓
Architecture decision
    ↓
Implementation
    ↓
Test
    ↓
Documentation
```

Example:

```text
Global 10 req/sec
        ↓
Rate limiting architecture
        ↓
Shared distributed limiter
        ↓
Multi-worker integration test
        ↓
docs/03-backend/rate-limiting.md
```

Another example:

```text
Retry failed only
        ↓
URL state model
        ↓
Retry API + BullMQ jobs
        ↓
Integration test
        ↓
docs/03-backend/retries-and-idempotency.md
```

---

# 21. Open Design Questions

The following should be resolved during architecture design rather than prematurely assumed:

1. Exact URL state machine
2. Exact batch state machine
3. Global rate-limiter algorithm
4. How rate-limit coordination behaves during Redis failure
5. Exact retryable failure classification
6. Exact exponential backoff values
7. How cancellation interacts with in-flight HTTP requests
8. How SSE events are distributed across API instances
9. How missed SSE events are recovered
10. Cache invalidation strategy
11. Database transaction boundaries
12. Idempotency key/job identity strategy
13. Duplicate URL behavior within a batch
14. Redirect handling
15. Request timeout policy
16. URL validation rules

These decisions will be documented in the appropriate architecture/backend documents.

---

# 22. Definition of Requirement Completion

A requirement is considered complete only when:

1. The behavior is implemented.
2. The behavior is verified.
3. Failure/edge cases have been considered.
4. The implementation does not violate another requirement.
5. The relevant documentation reflects the final design.

A feature that only works on the happy path should not be considered complete.

````

---

## Why these two first?

This gives us a clean hierarchy:

```text
                 URLPulse
                    │
                    ▼
                 PRD.md
            "What are we building?"
                    │
                    ▼
            requirements.md
        "What must it guarantee?"
                    │
                    ▼
             Architecture
        "How are we going to do it?"
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
     State Model          Infrastructure
          │                    │
          ▼                    ▼
      Database          Redis/BullMQ
          │                    │
          └─────────┬──────────┘
                    ▼
              Implementation
````
