
# URLPulse — Product Requirements Document

**Version:** 1.0
**Status:** Draft
**Product:** URLPulse
**Document Type:** Product Requirements Document

---

## 1. Product Overview

URLPulse is a bulk URL health-checking application that allows users to submit multiple URLs and monitor their health-check results as they are processed.

Users can provide URLs either by:

- Pasting a list of URLs
- Uploading a CSV file

URLPulse processes each URL independently in the background and records the result.

For each URL, the system captures:

- Final HTTP status code
- Response time
- Page title, when available
- Processing outcome

The user can monitor the progress of a batch in real time, inspect individual URL results, cancel processing, and retry URLs that previously failed.

---

## 2. Problem Statement

Checking the health of a large number of URLs sequentially from a web request is inefficient and unreliable.

A bulk URL checker needs to:

- Process URLs asynchronously
- Avoid blocking the API while checks are running
- Control request rate
- Limit concurrent requests
- Retry transient failures
- Persist results reliably
- Provide users with live progress
- Recover correctly after page refreshes or connection failures

URLPulse addresses these requirements through a dedicated API, persistent database state, Redis/BullMQ-based background processing, and a real-time update mechanism.

---

## 3. Product Goal

The goal of URLPulse is to provide a reliable and easy-to-understand interface for checking the health of many URLs while demonstrating production-minded backend architecture.

The system should remain correct when:

- A batch contains many URLs
- Individual URL checks fail
- Jobs are retried
- Multiple workers process jobs
- Multiple API instances serve users
- A user refreshes the page
- A user's live connection is interrupted
- A user cancels a running batch

Correctness and consistency are more important than visual complexity.

---

## 4. Target User

The primary user is a developer, engineer, QA engineer, SEO/technical user, or other technical user who needs to check the health of multiple URLs efficiently.

The initial product does not require authentication or user accounts.

Authentication and notifications are explicitly outside the scope of this implementation.

---

## 5. User Problem

A user wants to check a collection of URLs without manually opening each URL or running an ad-hoc script.

They need to know:

- Which URLs have completed
- Which URLs are still processing
- Which URLs failed
- The HTTP status of each URL
- How long each URL took to respond
- The page title when available
- Overall batch progress

They should be able to leave the page running and see results appear as processing completes.

---

## 6. Primary User Journey

### 6.1 Create a Batch

The user:

1. Opens URLPulse.
2. Provides a list of URLs or uploads a CSV.
3. Submits the batch.
4. URLPulse validates the input.
5. URLPulse persists the batch and URL records.
6. URLPulse creates background jobs.
7. The user is taken to the batch detail page.

The batch and its URLs must be persisted in PostgreSQL before URL checking begins.

---

### 6.2 Monitor a Batch

The user opens a batch detail page.

The page displays:

- Batch status
- Total URLs
- Completed URLs
- Failed URLs
- Pending/processing URLs
- Progress
- Individual URL results

As URL checks complete, the page updates without requiring manual refresh.

---

### 6.3 Inspect URL Results

For each URL, the user can see the result of its latest completed attempt.

At minimum:

- URL
- Status
- HTTP status code
- Response time
- Page title when available
- Error information when applicable

---

### 6.4 Cancel a Batch

The user can request cancellation of a running batch.

Cancellation must account for:

- Jobs that are still queued
- Jobs currently being processed

The persisted state must remain consistent with the state presented to the user.

---

### 6.5 Retry Failed URLs

After a batch has failed URLs, the user can choose to retry failed URLs.

Only URLs that ended in a failed state should be reprocessed.

Successful URLs must not be unnecessarily processed again.

---

## 7. Product Features

### 7.1 Batch Submission

Users can submit multiple URLs as one batch.

Supported input methods:

- Text input / pasted URL list
- CSV upload

Each submitted URL becomes an independently trackable URL record.

---

### 7.2 Background URL Processing

URL checks must execute asynchronously.

Each URL is processed as its own background job.

The API process must not perform the long-running URL-checking workload directly.

Workers operate as a separate process.

---

### 7.3 URL Health Results

For each URL, URLPulse records at minimum:

| Result            | Description                         |
| ----------------- | ----------------------------------- |
| Final HTTP status | Final HTTP status code observed     |
| Response time     | Time taken for the health check     |
| Page title        | Page title when one exists          |
| Outcome           | Successful or failed processing     |
| Error             | Failure information when applicable |

---

### 7.4 Batch Progress

The batch page provides a clear representation of processing progress.

Progress should be derived from persisted application state rather than relying solely on temporary client-side state.

The batch must remain correctly viewable after:

- Page refresh
- Opening in a new tab
- Reconnecting after a dropped connection

---

### 7.5 Batch List

URLPulse provides a page listing existing batches.

Each batch should expose enough information for the user to understand its current state and open its detail page.

The batch list endpoint must be served from a 30-second cache while avoiding visibly stale results after relevant mutations.

---

### 7.6 Batch Detail

Every batch has a dedicated URL.

A batch detail URL must work when opened directly without relying on state from another page.

The page must correctly represent both:

- Running batches
- Completed batches

as well as other persisted terminal states.

---

### 7.7 Cancellation

A user can cancel a running batch.

Cancellation must work correctly for both queued and in-flight jobs.

A cancellation operation must not allow a stale worker result to incorrectly overwrite the final persisted state.

---

### 7.8 Retry Failed URLs

A user can retry failed URLs from an existing batch.

The retry operation must:

- Select only failed URLs
- Preserve successful results
- Create new processing work only for failed URLs
- Maintain consistent batch state

---

### 7.9 Live Progress Updates

The batch page should receive updates as URL checks finish.

The live update mechanism is a delivery mechanism and must not become the authoritative source of application state.

If the connection is interrupted, the client must recover and obtain the correct state.

---

## 8. Processing Constraints

URLPulse must enforce the following system-wide constraints.

### Global Request Rate

Maximum:

**10 HTTP requests per second across the entire system.**

This is a global limit.

It must not be interpreted as:

- 10 requests per worker
- 10 requests per process
- 10 requests per API instance

The limit must remain valid when multiple worker processes are running.

---

### Concurrent Checks

Maximum:

**5 URL checks in flight.**

Concurrency and rate limiting are separate constraints and must both be satisfied.

---

### Retries

Transient failures may be retried.

Maximum:

**3 retries**

Retries must use exponential backoff.

---

## 9. Reliability Requirements

URLPulse should maintain correct persisted state even when:

- A job fails
- A job is retried
- A worker restarts
- A job is executed more than once
- A user refreshes the page
- A live connection is dropped
- Multiple API instances are running
- Multiple workers are running
- Cancellation races with processing

PostgreSQL is the authoritative source of persisted application state.

---

## 10. Scalability Requirements

The system should support horizontal scaling of the API layer.

Multiple API instances must be able to serve clients without requiring application state to live inside an individual API process.

Workers should also be capable of running as multiple processes while preserving the global request-rate constraint.

Shared infrastructure must therefore be used where coordination across processes is required.

---

## 11. Type Safety

The frontend and backend must use TypeScript.

Shared client/server types should be maintained in a shared package/module to avoid independently maintained API contracts.

Runtime validation must still be performed at external input boundaries.

---

## 12. User Experience Requirements

The interface should prioritize:

1. Correctness
2. Clear status representation
3. Progress visibility
4. Fast feedback
5. Useful error information
6. Reliable controls

Visual polish is secondary to functionality.

The implementation should remain intentionally simple because polished UI, charts, authentication, and notifications are outside the task scope.

---

## 13. Product States

### Batch States

A batch can represent states such as:

- Pending
- Processing
- Completed
- Failed
- Cancelled

The exact state model and transition rules will be defined in:

`docs/03-backend/job-lifecycle.md`

---

### URL States

Individual URLs need to represent their processing lifecycle independently.

The exact URL state machine will be defined during architecture and backend design.

---

## 14. Source of Truth

PostgreSQL is the source of truth for:

- Batch state
- URL state
- URL results
- Processing metadata
- Progress-related persisted state

Redis and BullMQ provide job-processing infrastructure and coordination.

The frontend must not treat its local state as authoritative.

Live events should communicate changes rather than becoming a second database.

---

## 15. Security Considerations

URLs supplied by users are untrusted input.

The implementation should consider:

- URL validation
- Supported URL schemes
- Request timeouts
- Redirect behavior
- Excessively large input
- Unsafe network targets
- SSRF risks

Security features beyond the requirements should remain proportional to the current scope of the project.

---

## 16. Out of Scope

The following are explicitly outside the scope of this implementation:

- Authentication
- Authorization
- Notifications
- Charts
- Highly polished UI

Visual design is not the primary focus; functionality takes priority.

---

## 17. Assumptions

Where requirements do not define exact implementation behavior, URLPulse makes explicit assumptions rather than silently introducing behavior.

Initial assumptions:

1. PostgreSQL is the authoritative source for application state.
2. Redis/BullMQ is used for asynchronous job orchestration.
3. The worker is a separate process from the API.
4. The live-update mechanism is responsible for notification, not persistence.
5. A URL health check represents the final response observed for that attempt.
6. Retry behavior applies to transient processing failures rather than every non-2xx HTTP response.
7. The exact definition of retryable failures will be documented before implementation.
8. The exact state transition rules will be documented before implementation.

These assumptions may be refined during architecture design.

---

## 18. Acceptance Criteria

### Batch Creation

- [ ] User can submit multiple URLs.
- [ ] User can upload a CSV.
- [ ] Batch is persisted before processing begins.
- [ ] Each URL is persisted independently.
- [ ] Each URL receives an independent background job.

### Processing

- [ ] Worker runs separately from API.
- [ ] Maximum 5 checks are in flight.
- [ ] Maximum 10 HTTP requests/sec globally.
- [ ] Global limit remains valid with multiple workers.
- [ ] Transient failures retry up to 3 times.
- [ ] Retries use exponential backoff.

### Results

- [ ] Final HTTP status is recorded.
- [ ] Response time is recorded.
- [ ] Page title is recorded when available.
- [ ] Failure information is persisted.

### Live Updates

- [ ] Progress updates without manual refresh.
- [ ] Refreshing the page produces correct state.
- [ ] Opening a batch directly produces correct state.
- [ ] Dropped live connections can recover.
- [ ] Multiple API instances do not break correctness.

### Controls

- [ ] Queued jobs can be cancelled.
- [ ] In-flight processing handles cancellation correctly.
- [ ] Retry-failed only retries failed URLs.
- [ ] Successful URLs are not reprocessed.

### Caching

- [ ] Batch list uses a 30-second cache.
- [ ] Important mutations do not leave visibly stale batch-list state.

### Engineering

- [ ] Shared TypeScript types exist.
- [ ] API and workers are separated.
- [ ] PostgreSQL remains the source of truth.
- [ ] Job processing is idempotent.
- [ ] Architecture and trade-offs are documented.

---

## 19. Success Criteria

URLPulse is successful when it can reliably process a batch of URLs while maintaining the required rate limit, concurrency, retry, and consistency guarantees.

The implementation should also make it possible for another engineer to understand:

- Why PostgreSQL is used
- Why Redis is used
- Why BullMQ is used
- Why workers are separate
- How global rate limiting works
- How retries work
- How idempotency is maintained
- How live updates recover
- How the system behaves when horizontally scaled
