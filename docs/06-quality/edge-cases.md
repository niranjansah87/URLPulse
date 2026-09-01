# URLPulse - Edge Cases & Failure Scenarios

**Version:** 1.0  
**Status:** Draft

---

# 1. Purpose

URLPulse is a distributed background-processing system. Correct behavior must be defined for failures and race conditions, not only the happy path.

This document records the important edge cases that implementation and testing must address.

---

# 2. Input Edge Cases

## Empty submission

Reject:

```text
[]
```

with a clear validation error.

## Whitespace

Input such as:

```text
"   https://example.com   "
```

should be normalized before validation.

## Invalid URL

Examples:

```text
hello
example
ftp://example.com
```

must be rejected if the product supports only HTTP/HTTPS.

## Duplicate URLs

Define whether duplicate URLs in one batch are:

```text
deduplicated
```

or:

```text
treated as separate URL checks
```

The final implementation must make this explicit.

---

# 3. CSV Edge Cases

Handle:

- Empty CSV
- Header-only CSV
- Missing URL column
- Extra columns
- Blank rows
- Invalid URLs
- Duplicate URLs
- Very large file
- Incorrect encoding
- Malformed CSV quoting

CSV validation should produce actionable errors.

---

# 4. URL Health-Check Edge Cases

Possible failures:

```text
DNS failure
connection refused
connection timeout
TLS error
redirect
4xx response
5xx response
slow response
malformed response
```

Each must map to a deterministic application outcome.

---

# 5. Redirects

The implementation must define:

- Whether redirects are followed
- Maximum redirect count
- Whether the final URL is reported
- Whether redirect chains count toward timeout behavior

Avoid allowing an unbounded redirect chain.

---

# 6. Timeout

Every outbound request must have a finite timeout.

A request that never completes must not occupy one of the five global concurrency slots indefinitely.

On timeout:

```text
release concurrency slot
classify failure
schedule retry if retryable
```

---

# 7. DNS Failure

DNS resolution failures should not crash the worker.

The URL should be classified according to the retry policy.

The worker continues processing other jobs.

---

# 8. Slow Target

A target taking 30 seconds should not block the entire system.

The global concurrency limit intentionally bounds the number of such requests.

When the timeout is reached, the slot is released.

---

# 9. API Restart During Batch Processing

If the API restarts while workers are processing:

```text
PostgreSQL state remains
Redis remains
BullMQ remains
```

The worker continues independently.

When the browser reconnects:

```text
GET current state
→ SSE reconnect
```

---

# 10. Worker Crash

Worker may crash:

```text
before HTTP request
during HTTP request
after HTTP request
before database commit
after database commit
```

The design must tolerate duplicate or recovered execution.

Database transitions must be idempotent.

---

# 11. Duplicate Job Delivery

The same URL may be delivered twice.

Only one worker should successfully claim:

```text
PENDING → PROCESSING
```

or equivalent retry state.

A second worker must safely exit or observe the updated state.

---

# 12. Cancellation Race

The following can happen simultaneously:

```text
User → cancel
Worker → complete
```

Database transaction ordering determines the result.

The implementation must prevent stale workers from applying invalid post-cancellation transitions.

---

# 13. Cancel Before Worker Starts

Correct behavior:

```text
batch = CANCELLED
worker receives job
worker checks state
worker skips URL
```

The worker should avoid making the external HTTP request.

---

# 14. Cancel During HTTP Request

Cancellation cannot necessarily interrupt an already transmitted network request at the remote server.

The local application should:

- Abort the local request where practical
- Stop future retries
- Prevent stale completion from changing cancelled state

The batch remains cancelled.

---

# 15. Cancel After All URLs Finish

If all URLs have already reached terminal states, cancellation should not change the terminal batch state unless the product explicitly defines otherwise.

Terminal-state rules must be consistent.

---

# 16. Retry After Cancellation

A cancelled URL must not automatically retry.

Worker logic should check:

```text
batch status
URL status
```

before starting another attempt.

---

# 17. Retry-Failed Race

Two clients can request:

```text
retry failed
```

simultaneously.

The database must atomically claim failed URLs.

Expected result:

```text
each failed URL → at most one new retry workflow
```

---

# 18. Retry-Failed After Cancellation

If the batch is cancelled, retry-failed should not reactivate it unless the product explicitly defines a separate resume operation.

Recommended behavior:

```text
CANCELLED → reject retry-failed
```

---

# 19. Batch Completion Race

Multiple workers may finish the final URLs at nearly the same time.

The system must not:

- Mark the batch complete too early
- Mark it complete twice
- Lose a final failure
- Reopen a completed batch

Use transactional/conditional state updates.

---

# 20. Progress Counter Race

Two workers can finish concurrently.

Incorrect:

```text
read completed = 4
worker A writes 5
worker B writes 5
```

Correct behavior must result in:

```text
completed = 6
```

Use atomic database updates or derive counters safely from persisted URL state.

---

# 21. Event Publication Failure

If database commit succeeds but live-event publication fails:

```text
database = correct
live UI = temporarily stale
```

The system must recover through:

- SSE reconnect
- Polling fallback if implemented
- Manual refresh

Do not roll back a successful URL state solely because a notification failed unless an explicit transactional-outbox architecture is chosen.

---

# 22. Duplicate Live Events

A client may receive:

```text
batch.updated
batch.updated
```

The client must not:

```text
increment completed twice
```

It should refetch or reconcile authoritative state.

---

# 23. Missed Live Events

A client may disconnect while an event is published.

On reconnect:

```text
GET current state
```

must reconcile the UI.

---

# 24. Out-of-Order Events

If:

```text
version 43
version 42
```

arrive out of order, the client must not regress the displayed state.

The safest design is to use events as invalidation signals and fetch current state.

---

# 25. Redis Failure

Redis failure may affect:

- BullMQ
- Global limiter
- Global concurrency
- Pub/sub

The application must not silently bypass global controls.

Workers should fail safely or pause processing until coordination is available.

---

# 26. PostgreSQL Failure

PostgreSQL failure prevents authoritative state transitions.

The API should return an appropriate server error.

Workers should not invent successful state locally.

---

# 27. Cache Staleness

A 30-second cache is allowed for the batch list, but mutation paths must avoid an obviously stale user experience.

After creation:

```text
create batch
→ invalidate list cache
```

After relevant state change:

```text
invalidate/update cached list
```

---

# 28. Browser Refresh

Refreshing an active batch page must not reset progress.

The page loads state from the API/database.

Client memory is never the source of truth.

---

# 29. Multiple Browser Tabs

Two tabs may observe the same batch.

Both may:

```text
connect SSE
fetch state
cancel
retry
```

Mutation endpoints must remain safe under concurrent requests.

---

# 30. Multiple API Instances

A worker may complete a URL while the browser is connected to a different API instance.

Redis-based event distribution ensures the update reaches the correct instance.

The database remains authoritative.

---

# 31. Multiple Workers

Increasing worker count must not increase:

```text
global request rate
global in-flight requests
allowed retries
logical completion count
```

These are system-level invariants.

---

# 32. Queue/Database Inconsistency

Potential failure:

```text
database commit succeeds
queue enqueue fails
```

A URL exists as pending but has no corresponding job.

The final implementation must choose and document a recovery mechanism.

Possible approaches:

- Transactional outbox
- Reconciliation job
- Queue enqueue within a retryable workflow

Do not silently ignore this failure window.

---

# 33. Database/Queue Ordering

Another dangerous sequence is:

```text
queue job starts
↓
database row does not exist
```

The worker should verify that the referenced batch/URL exists and is processable before making an external request.

---

# 34. Duplicate Batch Submission

A user may click Submit twice.

The API should not accidentally create duplicate batches due to a single UI action being repeated unless that behavior is intentionally supported.

The client should disable or guard submission while a request is pending.

Server-side idempotency may be added if required.

---

# 35. Large Batch

A large batch can create many queue jobs.

The implementation should avoid:

```text
one giant database transaction
```

if it causes unacceptable memory or lock behavior.

Batch limits should be explicit.

---

# 36. Unreachable URL

An unreachable URL should produce a normal failed result, not a worker process failure.

One bad URL must not stop the entire queue.

---

# 37. Malicious or Problematic URLs

The worker accepts arbitrary user-supplied URLs, so SSRF is treated as a
first-class risk. The protection is implemented in `packages/outbound/src/ssrf.ts`
and enforced in `apps/worker/src/lib/http-checker.ts`:

- **Scheme restricted to http/https** - validated in the shared URL schema and
  again per hop; other schemes are rejected (`UNSUPPORTED_PROTOCOL`).
- **Hostname is resolved (DNS) and every resolved IP is checked** before the
  request, so a public-looking name that resolves to a private address is blocked.
- **Blocked ranges:** loopback (`127.0.0.0/8`, `::1`), private v4
  (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`, including the
  `169.254.169.254` cloud-metadata address, and `fe80::/10`), unique-local
  (`fc00::/7`), CGNAT (`100.64/10`), `0.0.0.0/8`, multicast/reserved, and
  IPv4-mapped IPv6 equivalents.
- **Every redirect hop is re-validated** (redirects are followed manually), so a
  redirect to an internal address is caught, not just the initial URL.
- **Redirects are bounded** (`HTTP_MAX_REDIRECTS`, default 5).
- A blocked target consumes no rate-limit permit and is recorded as a
  non-retryable failure (`BLOCKED_ADDRESS` / `DNS_ERROR`).

Local development can allow private targets with `HTTP_ALLOW_PRIVATE_HOSTS=true`;
this MUST be `false` in production (the default).

**Residual risk (documented, not silently ignored):** a full DNS-rebinding
defense would pin the validated IP for the actual socket connection. With
`fetch`, pinning the connect IP is not straightforward, so a narrow TOCTOU window
remains between validation and connect. Accepted for this project's scope; the
upgrade path is a custom agent/lookup that connects to the already-validated IP.

---

# 38. Resource Exhaustion

Bounds are enforced so one request or URL cannot exhaust the worker or API:

- **CSV size** - multipart upload capped at 5 MB (`@fastify/multipart`).
- **JSON body** - capped at 4 MB (Fastify `bodyLimit`).
- **URL count** - at most `MAX_URLS_PER_BATCH` (10,000) per batch.
- **URL length** - at most `MAX_URL_LENGTH` (2,048) characters.
- **Slow responses** - each check is aborted after `HTTP_TIMEOUT_MS` (default
  10s) via an `AbortController`.
- **Response body** - only the first `HTTP_MAX_BODY_BYTES` (default 256 KB) are
  read, for `<title>` extraction; the rest is discarded.
- **SSE connections** - each stream deregisters its client on close/error and
  sends periodic heartbeats so dead connections are reclaimed.

Limits are enforced at the API boundary (schemas, Fastify limits) and in the
worker's HTTP checker.

---

# 39. Shutdown During Processing

On graceful shutdown:

```text
stop accepting new work
↓
finish/release active resources where practical
↓
close connections
```

Jobs that do not finish safely should be recoverable through queue semantics.

---

# 40. Terminal State Invariant

Once a URL reaches:

```text
SUCCESS
FAILED
CANCELLED
```

a stale worker must not move it back to:

```text
PENDING
PROCESSING
```

unless an explicit retry operation performs a valid transition.

---

# 41. Failure Handling Philosophy

The system should prefer:

```text
safe failure
+
recoverable state
+
authoritative persistence
```

over:

```text
best-effort success
+
silent inconsistency
```

---

# 42. Related Documents

```text
docs/03-backend/job-lifecycle.md
docs/03-backend/rate-limiting.md
docs/03-backend/retries-and-idempotency.md
docs/03-backend/cancellation.md
docs/04-frontend/live-updates.md
docs/05-infrastructure/scaling.md
docs/06-quality/testing.md
```
