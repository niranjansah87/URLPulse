# URLPulse - API Contract

**Version:** 1.0  
**Status:** Draft  
**Transport:** HTTP + SSE  
**API Framework:** Fastify

---

# 1. Purpose

This document defines the HTTP API contract between the Next.js frontend and the Fastify backend.

The API is responsible for synchronous application operations:

- Creating batches
- Listing batches
- Retrieving batch state
- Cancelling batches
- Retrying failed URLs
- Establishing live-update connections

URL health checks are performed by workers, not by API request handlers.

---

# 2. API Principles

1. PostgreSQL is the source of truth.
2. API responses represent persisted application state.
3. Long-running URL checks are never performed directly inside API handlers.
4. External input is validated at runtime.
5. Errors use consistent response shapes.
6. Mutations are designed to be safe under retries where practical.
7. API instances are stateless with respect to authoritative application state.

---

# 3. Base URL

Development:

```text
/api
```

The exact production prefix may be configured through deployment configuration.

---

# 4. Common Response Shape

Successful responses should use predictable JSON structures.

Example:

```json
{
  "data": {}
}
```

For collection endpoints:

```json
{
  "data": [],
  "meta": {}
}
```

---

# 5. Error Response

Errors should use a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more URLs are invalid",
    "details": []
  }
}
```

The API should avoid leaking internal stack traces or sensitive infrastructure information.

---

# 6. POST `/batches`

Creates a new URL-checking batch.

## Request

The endpoint supports either:

- JSON URL input
- CSV upload

### JSON Example

```json
{
  "urls": [
    "https://example.com",
    "https://example.org"
  ]
}
```

---

## Validation

The API must validate:

- Input is present
- At least one URL exists
- URL syntax is valid
- Supported URL scheme
- Input size is within configured limits

The exact limits should be documented as implementation configuration.

---

## Processing

The API:

```text
Validate request
    ↓
Create batch + URL records in PostgreSQL
    ↓
Commit transaction
    ↓
Enqueue URL jobs
    ↓
Return batch information
```

The worker must not process URLs before their database records exist.

---

## Response

Example:

```json
{
  "data": {
    "id": "batch-id",
    "status": "PENDING",
    "totalCount": 2
  }
}
```

Recommended status:

```text
201 Created
```

---

# 7. POST `/batches` - CSV

CSV upload uses multipart/form-data.

Example conceptual request:

```text
POST /batches
Content-Type: multipart/form-data

file=<urls.csv>
```

The API parses and validates the CSV before creating the batch.

Malformed input should return a validation error rather than creating a partial batch.

---

# 8. GET `/batches`

Returns existing batches.

The endpoint is served through a 30-second cache as a system requirement.

---

## Query Parameters

Potential parameters:

```text
?page=1&pageSize=20
```

Pagination is recommended to avoid returning an unbounded number of batches.

---

## Response

Example:

```json
{
  "data": [
    {
      "id": "batch-1",
      "status": "PROCESSING",
      "totalCount": 100,
      "completedCount": 37,
      "failedCount": 2,
      "createdAt": "2026-08-31T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

---

# 9. Batch List Cache

The cache lifetime is:

```text
30 seconds
```

Important mutations should invalidate the list cache.

At minimum:

- Batch creation
- Relevant batch terminal-state changes

The exact cache implementation is an infrastructure decision.

---

# 10. GET `/batches/:batchId`

Returns the current authoritative state of a batch.

This endpoint is used by:

- Batch detail page
- SSE recovery
- Browser refresh
- Direct navigation

---

## Response

Example:

```json
{
  "data": {
    "id": "batch-id",
    "status": "PROCESSING",
    "totalCount": 3,
    "completedCount": 1,
    "failedCount": 0,
    "cancelledCount": 0,
    "urls": [
      {
        "id": "url-1",
        "url": "https://example.com",
        "status": "SUCCESS",
        "httpStatus": 200,
        "responseTimeMs": 183,
        "pageTitle": "Example Domain",
        "error": null
      },
      {
        "id": "url-2",
        "url": "https://example.org",
        "status": "PROCESSING",
        "httpStatus": null,
        "responseTimeMs": null,
        "pageTitle": null,
        "error": null
      }
    ]
  }
}
```

---

# 11. GET `/batches/:batchId/events`

Establishes an SSE connection for live batch updates.

Content type:

```text
text/event-stream
```

---

## Event Model

Example:

```text
event: batch.updated
data: {"batchId":"batch-id","version":12}
```

The event payload should remain small.

The client can fetch the latest authoritative state when needed.

---

# 12. SSE Initial State

When a client connects:

```text
Connect SSE
    ↓
Load current batch state
    ↓
Send initial snapshot
    ↓
Subscribe to future updates
```

The implementation must ensure that the subscription does not create an avoidable gap where an event can be missed between reading state and subscribing.

The detailed live-update protocol is documented in:

```text
docs/04-frontend/live-updates.md
```

---

# 13. POST `/batches/:batchId/cancel`

Requests cancellation of a running batch.

Example:

```http
POST /batches/batch-id/cancel
```

---

## Behavior

The API:

1. Validates the batch exists.
2. Checks whether cancellation is meaningful.
3. Updates authoritative state transactionally.
4. Prevents future queued work from executing where possible.
5. Invalidates relevant cache state.
6. Returns the current batch state.

---

## Response

Example:

```json
{
  "data": {
    "id": "batch-id",
    "status": "CANCELLED"
  }
}
```

---

# 14. Cancellation Idempotency

Repeated cancellation requests should not create inconsistent state.

Example:

```text
POST cancel
POST cancel
POST cancel
```

should result in one stable terminal state.

If the batch is already cancelled, the API may return the current state rather than treating the request as an infrastructure error.

---

# 15. POST `/batches/:batchId/retry-failed`

Schedules failed URLs for another processing attempt.

---

## Behavior

The API:

1. Loads the batch.
2. Selects only eligible failed URLs.
3. Transitions them to `PENDING`.
4. Creates BullMQ jobs for those URLs.
5. Updates batch state as required.
6. Invalidates relevant cache.
7. Returns the updated batch state.

---

## Example

Before:

```text
URL A = SUCCESS
URL B = FAILED
URL C = SUCCESS
URL D = FAILED
```

After:

```text
URL A = SUCCESS
URL B = PENDING
URL C = SUCCESS
URL D = PENDING
```

Only B and D receive new jobs.

---

# 16. Retry-Failed Idempotency

The API must avoid creating duplicate retry work when the same retry request is submitted concurrently.

The database transition should identify which failed rows were actually claimed for retry.

Only those rows should result in new jobs.

---

# 17. HTTP Status Codes

Recommended status codes:

| Situation | Status |
|---|---:|
| Successful GET | 200 |
| Batch created | 201 |
| Successful mutation | 200 |
| Invalid request | 400 |
| Unauthenticated request | 401 |
| Forbidden | 403 |
| Resource not found (incl. not owned) | 404 |
| Conflict with current state | 409 |
| Rate limited API request | 429 |
| Unexpected server failure | 500 |

Exact usage should be consistent across endpoints.

---

# 18. Validation

Runtime validation is required for all external input.

TypeScript interfaces alone are insufficient because incoming HTTP data is untrusted.

Validation should occur before:

- Database writes
- Queue creation
- URL processing

---

# 19. API Authentication

The API is authenticated with [Better Auth](https://better-auth.com), mounted on
Fastify at `/api/auth/*` with PostgreSQL-backed sessions. See
`docs/03-backend/authentication.md` for the full architecture.

- **Every batch endpoint requires a session.** A request with no valid session
  cookie is rejected with `401 UNAUTHORIZED` before any handler logic runs.
- **All batch operations are scoped to the session user.** The owning `user_id`
  is derived from the session, never from the request body. Every read and
  mutation filters `WHERE user_id = <session user>`.
- **Ownership is not leaked.** A batch owned by another user is indistinguishable
  from one that does not exist — both return `404 NOT_FOUND` — for get, cancel,
  retry-failed, and the SSE stream.
- Sessions are database-backed, so they hold across restarts and across multiple
  API instances (§20), and the SSE stream (§11) is authenticated and
  ownership-checked before a client is subscribed.

Email/password reset is implemented (Better Auth + transactional email). Out of
scope (intentional): OAuth/social login, MFA, email verification,
organizations/teams, and RBAC.

---

# 20. API State Ownership

The API does not maintain authoritative state in process memory.

Avoid designs such as:

```ts
const batches = new Map();
```

for application state.

Multiple API instances would produce inconsistent views.

---

# 21. Concurrency and Mutations

Concurrent API requests may target the same batch.

Examples:

```text
cancel
retry-failed
cancel
```

The database state machine must determine which transition is valid.

The API should not rely only on a pre-check such as:

```text
if (batch.status === "PROCESSING")
```

because the state can change between reading and writing.

Use transactional/conditional database updates where required.

---

# 22. API-to-Queue Boundary

The API creates jobs after the relevant database state exists.

Conceptually:

```text
HTTP request
    ↓
Database transaction
    ↓
Persist batch/URLs
    ↓
Commit
    ↓
BullMQ enqueue
```

The queue payload contains identifiers, not authoritative mutable state.

Example:

```json
{
  "batchId": "batch-id",
  "urlId": "url-id"
}
```

---

# 23. API Observability

API operations should produce structured logs for important failures.

Useful fields include:

```text
requestId
batchId
urlId
route
statusCode
duration
errorCode
```

Sensitive URL contents should not be logged unnecessarily.

---

# 24. API Versioning

Versioning is not required for the initial implementation.

The API should nevertheless keep domain responses and route responsibilities clearly separated so versioning can be introduced later if required.

---

# 25. Related Documents

```text
docs/01-product/requirements.md
docs/02-architecture/architecture.md
docs/03-backend/database.md
docs/03-backend/job-lifecycle.md
docs/03-backend/rate-limiting.md
docs/03-backend/retries-and-idempotency.md
docs/03-backend/cancellation.md
docs/04-frontend/live-updates.md
```
