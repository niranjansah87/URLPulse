# URLPulse - Testing Strategy

**Version:** 1.0  
**Status:** Draft

---

# 1. Purpose

Testing must verify both normal functionality and the distributed-system correctness requirements of URLPulse.

The goal is not simply high line coverage. The most important tests are those that prove:

- URL submission works
- URL checks run asynchronously
- global rate limiting is respected
- global concurrency is respected
- retries behave correctly
- cancellation is safe
- duplicate execution does not corrupt state
- live updates recover from disconnects
- batch state remains correct after refresh
- multiple workers/API instances do not violate invariants

---

# 2. Testing Pyramid

```text
                 E2E
                /   \
             Integration
            /           \
          Unit           Unit
```

Prioritize deterministic unit tests for business rules and integration tests for database/queue behavior.

End-to-end tests cover the most important user journeys.

---

# 3. Unit Tests

Unit tests should cover pure business logic.

Examples:

### URL validation

- Valid HTTP URL
- Valid HTTPS URL
- Invalid URL
- Unsupported protocol
- Empty URL
- Whitespace
- Duplicate URLs

### Input normalization

- Trim whitespace
- Normalize expected URL representation
- Preserve valid URLs

### Retry classification

Test:

```text
retryable failure → retry
permanent failure → no retry
```

### Backoff calculation

Verify exponential delay increases correctly and remains within configured bounds.

### Batch progress

Given:

```text
total = 10
completed = 6
```

verify:

```text
progress = 60%
```

### State transition rules

Verify valid and invalid transitions.

---

# 4. Database Integration Tests

Use a real PostgreSQL instance for database integration tests.

Test:

- Batch insertion
- URL insertion
- Foreign-key constraints
- Unique constraints
- Status transitions
- Atomic counters
- Conditional updates
- Cancellation races
- Retry-failed claiming

---

# 5. API Integration Tests

Test the Fastify application against test PostgreSQL/Redis infrastructure.

Important endpoints:

```text
POST /batches
GET /batches
GET /batches/:id
GET /batches/:id/events
POST /batches/:id/cancel
POST /batches/:id/retry-failed
```

Verify:

- Request validation
- Response schemas
- Correct status codes
- Error handling
- Idempotent mutation behavior
- Cache behavior

---

# 6. Batch Creation Tests

Test:

```text
POST /batches
```

with:

- Small URL list
- Large URL list within allowed bounds
- Empty list
- Invalid URLs
- Duplicate URLs
- Mixed valid/invalid input
- CSV upload
- Malformed CSV
- Unsupported CSV format

Verify that data is persisted before checking begins.

---

# 7. Worker Integration Tests

Run the worker against test Redis/PostgreSQL.

Test:

```text
PENDING → PROCESSING
PROCESSING → SUCCESS
PROCESSING → FAILED
```

Also test:

```text
PROCESSING → retry
retry → PROCESSING
```

Verify that a worker does not process a URL that is already terminal.

---

# 8. Global Concurrency Test

This is a critical correctness test.

Create enough jobs to keep workers busy.

Run multiple worker processes.

Instrument the HTTP checker:

```text
activeRequests++
```

and:

```text
activeRequests--
```

Assert:

```text
max(activeRequests) <= 5
```

The test must use multiple workers so that a per-process semaphore cannot accidentally pass.

---

# 9. Global Rate-Limit Test

Create many URL jobs and multiple workers.

Record timestamps of outbound requests.

Verify that the shared limiter prevents more than:

```text
10 outbound requests / second
```

according to the final limiter's defined window/algorithm.

This test should verify the limit globally rather than per worker.

---

# 10. Retry Tests

For a deterministic mock HTTP target:

### Retryable failure

Example:

```text
attempt 1 → timeout
attempt 2 → timeout
attempt 3 → 503
attempt 4 → success
```

Verify:

```text
final state = SUCCESS
attempt count = 4
```

### Retry exhaustion

```text
attempt 1 → timeout
attempt 2 → timeout
attempt 3 → timeout
attempt 4 → timeout
```

Verify:

```text
final state = FAILED
```

No fifth attempt should occur.

---

# 11. Permanent Failure Test

Example:

```text
404
```

Verify that the job becomes failed without unnecessary retries if the final retry policy classifies the response as permanent.

---

# 12. Idempotency Tests

Simulate the same logical job being delivered twice.

Example:

```text
Worker A → SUCCESS
Worker B → SUCCESS
```

Verify:

- URL is counted once
- Batch progress is counted once
- Final state remains correct
- No duplicate completion event causes incorrect counters

---

# 13. Worker Crash Tests

Simulate:

```text
HTTP request
↓
worker crashes before DB completion
```

Verify the queue/job recovery strategy.

The final behavior must not produce:

```text
completed = 2
```

for one URL.

---

# 14. Cancellation Tests

### Cancel pending batch

Verify:

```text
PENDING → CANCELLED
```

and queued jobs are safely skipped.

### Cancel processing batch

Verify:

```text
PROCESSING → CANCELLED
```

and stale workers cannot overwrite cancellation.

### Cancel completed batch

Verify terminal-state semantics.

### Repeated cancel

Two cancellation requests should not corrupt state.

---

# 15. Cancellation Race Test

Run concurrently:

```text
cancel batch
```

and:

```text
worker completes URL
```

Possible ordering:

```text
cancel first
worker second
```

or:

```text
worker first
cancel second
```

Verify that the resulting state is consistent with the defined transaction ordering.

Most importantly:

> A stale worker must never resurrect a cancelled batch.

---

# 16. Retry-Failed Tests

After a batch has failed partially:

```text
SUCCESS
FAILED
FAILED
```

call:

```text
POST /batches/:id/retry-failed
```

Verify:

- Only failed URLs are selected
- Successful URLs remain unchanged
- Each failed URL is requeued once
- Counters are not double-counted

Run two retry requests concurrently and verify that duplicate retry work is not created.

---

# 17. SSE Tests

Test:

### Initial connection

Client connects and receives updates.

### Update

Worker changes persisted state and publishes event.

Client receives notification and fetches current state.

### Duplicate event

Two identical events should not corrupt UI state.

### Missed event

Disconnect before update.

Reconnect and refetch.

The final state must still be correct.

---

# 18. SSE Reconnection Test

Simulate:

```text
Client
  ↓
SSE connected
  ↓
API instance dies
  ↓
connection closes
  ↓
client reconnects
```

Verify:

- Client reconnects
- Current batch state is fetched
- UI catches up
- No duplicate progress is displayed

---

# 19. API Multi-Instance Test

Run:

```text
API 1
API 2
```

Connect clients to both.

Trigger a worker update.

Verify both connected clients receive the relevant notification through shared Redis distribution.

---

# 20. Cache Tests

The batch list cache should be tested for:

- Cache hit within TTL
- Cache miss after TTL
- Invalidation after batch creation
- Invalidation after relevant state changes

Verify that a newly created batch does not remain invisible because of stale cache data.

---

# 21. Frontend Tests

Test important user interactions:

- Add URL
- Remove URL
- Add CSV
- Submit batch
- Navigate to batch
- View progress
- View results
- Cancel batch
- Retry failed URLs
- Download CSV
- Refresh page
- Open batch in a new tab

---

# 22. End-to-End Scenarios

At minimum:

### Scenario A - Happy path

```text
Submit URLs
→ batch created
→ workers process URLs
→ progress updates
→ final results
```

### Scenario B - Partial failures

```text
Submit
→ some success
→ some failure
→ retry failed
→ final completion
```

### Scenario C - Cancellation

```text
Submit
→ processing
→ cancel
→ remaining work stops/skips
→ cancelled state remains
```

### Scenario D - Refresh

```text
Submit
→ processing
→ refresh
→ correct persisted state appears
→ live updates resume
```

---

# 23. Failure Injection

The test environment should be able to simulate:

- Timeout
- DNS failure
- Connection refusal
- HTTP 500
- HTTP 503
- HTTP 404
- Slow response
- Worker crash
- API restart
- Redis disconnect
- PostgreSQL disconnect

These scenarios are more valuable than testing only successful requests.

---

# 24. Invariants

Tests should explicitly assert system invariants.

### Invariant 1

```text
completed + pending + processing + failed + cancelled
```

must remain consistent with the batch model.

### Invariant 2

A URL cannot be counted as completed more than once.

### Invariant 3

A cancelled batch cannot return to processing.

### Invariant 4

Global outbound concurrency never exceeds 5.

### Invariant 5

Global outbound request rate never exceeds 10 req/sec according to the configured algorithm.

### Invariant 6

A URL receives no more than the configured maximum number of attempts.

### Invariant 7

Successful URLs are not selected by retry-failed.

### Invariant 8

Refreshing a batch page cannot lose persisted state.

---

# 25. CI

CI should run:

```text
lint
typecheck
unit tests
integration tests
build
```

E2E tests may run in a separate CI stage if they require heavier infrastructure.

---

# 26. Test Isolation

Tests should not depend on execution order.

Each test suite should have isolated:

- Database state
- Queue state
- Redis state

Use deterministic test data.

---

# 27. Mocking Strategy

Mock external URL targets rather than relying on public websites.

This makes tests:

- Deterministic
- Fast
- Repeatable
- Independent of external availability

Do not use real production URLs to prove rate-limit or retry behavior.

---

# 28. Coverage Philosophy

Coverage percentage is a secondary metric.

Priority should be:

```text
correctness
>
critical-path coverage
>
edge-case coverage
>
line coverage
```

The distributed-system invariants are more important than maximizing a numerical coverage target.

---

# 29. Related Documents

```text
docs/06-quality/edge-cases.md
docs/03-backend/job-lifecycle.md
docs/03-backend/rate-limiting.md
docs/03-backend/retries-and-idempotency.md
docs/03-backend/cancellation.md
docs/04-frontend/live-updates.md
```
