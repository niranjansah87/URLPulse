# URLPulse - Frontend Architecture

**Version:** 1.0  
**Status:** Draft  
**Framework:** Next.js + React + TypeScript

---

# 1. Purpose

This document defines the frontend architecture for URLPulse.

The frontend is responsible for:

- Batch creation
- URL/CSV input
- Batch list
- Batch detail
- Progress visualization
- Live updates
- Cancellation
- Retry-failed
- Loading/error/empty states

The frontend does not perform URL health checks itself.

---

# 2. Architectural Principle

The frontend is a projection of backend state.

```text
PostgreSQL
    ↓
API
    ↓
Frontend state
    ↓
UI
```

The browser should never become the source of truth for batch processing.

---

# 3. Suggested Route Structure

```text
/
├── page.tsx
│
├── batches/
│   ├── page.tsx
│   └── [batchId]/
│       └── page.tsx
```

Possible responsibilities:

### `/`

Create a new batch.

### `/batches`

Show recent batches.

### `/batches/:batchId`

Show detailed results and live progress.

---

# 4. Component Structure

A reasonable component hierarchy:

```text
app/
├── page
│   ├── BatchInput
│   ├── UrlTextarea
│   ├── CsvUploader
│   └── CreateBatchButton
│
├── batches/
│   ├── BatchList
│   ├── BatchListItem
│   └── BatchStatus
│
└── batches/[batchId]/
    ├── BatchHeader
    ├── ProgressSummary
    ├── BatchActions
    ├── UrlResultsTable
    ├── UrlResultRow
    └── ConnectionStatus
```

The exact directory organization may change during implementation.

---

# 5. Server vs Client Components

Use Server Components by default where they provide value.

Use Client Components when the component requires:

- Browser events
- Local interactive state
- SSE
- Upload progress
- Client-side actions
- Interactive tables

Avoid turning the entire application into one large client component.

---

# 6. Data Fetching

The frontend should retrieve authoritative batch state through the API.

For example:

```text
GET /batches/:id
```

The detail page uses this response as the initial snapshot.

Live events then update the displayed state.

---

# 7. Initial Load + Live Updates

Recommended flow:

```text
Open batch page
      ↓
Fetch current batch
      ↓
Render initial state
      ↓
Connect SSE
      ↓
Receive updates
      ↓
Update displayed state
```

The frontend should always be able to recover by refetching the batch.

---

# 8. SSE State Model

The browser should treat SSE as a notification mechanism rather than a complete database replacement.

Example:

```text
SSE:
batch.updated
```

The client can then:

```text
refetch GET /batches/:id
```

or apply the event payload if the event contains sufficient authoritative information.

Keeping SSE payloads small and refetching authoritative state is easier to reason about.

---

# 9. Reconnection

SSE connections can fail because of:

- Network changes
- Browser sleep
- Server restart
- Proxy timeout
- Temporary connectivity issues

The frontend should reconnect automatically.

After reconnect:

```text
Reconnect SSE
    ↓
Refetch current batch
    ↓
Resume live updates
```

This prevents missed events from causing permanently stale UI.

---

# 10. Connection Status

The detail page should make live connection state understandable.

Possible states:

```text
LIVE
RECONNECTING
OFFLINE
```

This is useful because the user should know whether progress updates are currently live.

---

# 11. Progress Calculation

The progress indicator can use persisted counters:

```text
completed_count / total_count
```

For example:

```text
37 / 100
```

The frontend should not invent progress based on received events alone.

After refresh, progress must remain correct.

---

# 12. Batch Status Display

Recommended status mapping:

```text
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
```

Status labels should be visually distinct and accessible.

Do not rely only on color to communicate status.

---

# 13. URL Result States

Each row should clearly communicate:

```text
PENDING
PROCESSING
SUCCESS
FAILED
CANCELLED
```

For successful checks, show relevant data such as:

```text
HTTP status
Response time
Page title
```

For failures:

```text
Error message
Attempt count
```

---

# 14. Cancel Action

The cancel button should be visible only when cancellation is meaningful.

Flow:

```text
User clicks Cancel
        ↓
Confirmation if appropriate
        ↓
POST /batches/:id/cancel
        ↓
Update UI from returned state
        ↓
Continue listening for events
```

The UI should disable repeated clicks while the mutation is pending.

---

# 15. Retry-Failed Action

Show retry-failed when there are eligible failed URLs.

Flow:

```text
User clicks Retry Failed
        ↓
POST /batches/:id/retry-failed
        ↓
Failed URLs become PENDING
        ↓
UI updates
        ↓
SSE continues
```

Successful URLs remain unchanged.

---

# 16. Optimistic Updates

Avoid aggressive optimistic state changes for core batch state.

For example, after cancellation:

```text
Do not assume cancellation succeeded solely because the button was clicked.
```

Instead:

```text
API confirms state
↓
UI updates
```

This keeps UI state aligned with the backend.

---

# 17. Loading States

Important loading states include:

```text
Creating batch
Loading batches
Loading batch details
Cancelling
Retrying failed
Connecting to live updates
```

Buttons should communicate when an operation is in progress.

---

# 18. Error States

The UI should distinguish:

### Validation errors

Example:

```text
Please provide at least one valid URL.
```

### Network/API errors

Example:

```text
Unable to create the batch. Please try again.
```

### Batch-specific errors

Example:

```text
This batch no longer exists.
```

Internal server details should not be exposed directly.

---

# 19. Empty States

The application should have deliberate empty states.

Examples:

### No batches

```text
No URL checks yet.
Create your first batch.
```

### No failed URLs

Do not show a misleading retry action.

### Empty input

Guide the user toward entering URLs or uploading CSV.

---

# 20. CSV Upload UX

The upload flow should:

1. Select CSV
2. Show selected filename
3. Validate basic file requirements client-side
4. Submit to API
5. Display validation errors from backend
6. Navigate to batch detail after successful creation

Client validation is for UX.

Backend validation remains authoritative.

---

# 21. URL Input UX

For direct URL input:

```text
textarea
```

is appropriate for a large list.

The UI should communicate expected formatting.

Example:

```text
Enter one URL per line.
```

The backend remains responsible for final parsing and validation.

---

# 22. Table Design

The URL results table should remain usable for large batches.

Recommended columns:

```text
URL
Status
HTTP Status
Response Time
Title
Error
Attempts
```

Avoid rendering expensive UI for every row when it is unnecessary.

Pagination or virtualization can be introduced if the batch size requires it.

---

# 23. Accessibility

Important requirements:

- Keyboard-accessible controls
- Visible focus states
- Semantic buttons
- Accessible status text
- Labels for form controls
- Do not rely on color alone
- Meaningful loading announcements where appropriate

---

# 24. Responsive Design

The application should work on:

- Desktop
- Tablet
- Narrow screens

The URL results table may need horizontal scrolling or a responsive alternate layout on small screens.

---

# 25. State Management

Avoid introducing a large global state library unless required.

Recommended separation:

```text
Server/application state
→ API + query/cache layer

Local UI state
→ React state
```

SSE should update/refetch the relevant server state.

---

# 26. Cache Strategy

Batch list data follows the backend's 30-second cache behavior.

The frontend may maintain its own short-lived query cache, but it must not create a stale UI that contradicts explicit mutation results.

After mutations:

```text
invalidate/refetch affected batch data
```

---

# 27. Direct Navigation

The batch detail route must work when opened directly:

```text
/batches/<id>
```

It must not depend on navigating from the batch list first.

The page loads the batch using the ID from the URL.

---

# 28. Browser Refresh

Refreshing a batch page must recover:

```text
current batch status
progress
URL results
```

through the API.

SSE is supplementary.

---

# 29. Security Considerations

The frontend should:

- Treat API responses as untrusted input
- Avoid injecting raw HTML
- Avoid rendering unsanitized content as HTML
- Avoid exposing internal infrastructure details
- Avoid storing secrets in browser code

Environment variables exposed to the browser must never contain server-only secrets.

---

# 30. Performance Principles

Prioritize:

- Small API payloads where practical
- Efficient list rendering
- Avoid unnecessary rerenders
- Stable row keys
- Debounced input processing where needed
- Reconnect/backoff for SSE
- Avoid polling while SSE is healthy

The frontend should not repeatedly poll every second as the primary live-update mechanism.

---

# 31. Frontend Error Recovery

When a live connection is lost:

```text
SSE disconnect
     ↓
show reconnecting state
     ↓
retry connection
     ↓
refetch batch
     ↓
restore live state
```

If the API itself is unavailable, preserve the last known UI state while clearly communicating that the application cannot currently reach the backend.

---

# 32. Related Documents

```text
docs/01-product/PRD.md
docs/03-backend/api.md
docs/03-backend/job-lifecycle.md
docs/03-backend/cancellation.md
docs/04-frontend/live-updates.md
docs/05-infrastructure/local-development.md
docs/06-quality/testing.md
```
