# URLPulse - Architecture Diagram

**Version:** 1.0  
**Status:** Draft

---

# 1. System Overview

URLPulse consists of five logical layers:

```text
┌──────────────────────────────────────────────┐
│                  Browser                     │
│              Next.js + React                 │
└──────────────────────┬───────────────────────┘
                       │ HTTP / SSE
                       ▼
┌──────────────────────────────────────────────┐
│                    API                       │
│          Fastify + TypeScript                │
└───────────────┬────────────────┬─────────────┘
                │                │
                ▼                ▼
        ┌──────────────┐   ┌──────────────┐
        │ PostgreSQL   │   │    Redis     │
        │ Source of    │   │ Queue +      │
        │ Truth        │   │ Coordination │
        └──────┬───────┘   └──────┬───────┘
               │                  │
               │                  ▼
               │          ┌──────────────┐
               │          │   BullMQ     │
               │          └──────┬───────┘
               │                 │
               │                 ▼
               │          ┌──────────────┐
               └─────────►│   Workers    │
                          │ Separate proc│
                          └──────┬───────┘
                                 │
                                 ▼
                          External URLs
```

The required stack is Node.js/TypeScript, Fastify, PostgreSQL, Redis, BullMQ, and Next.js/TypeScript. 

---

# 2. Request Flow - Batch Creation

```mermaid
sequenceDiagram
    participant Browser
    participant Next as Next.js
    participant API as Fastify API
    participant DB as PostgreSQL
    participant Queue as BullMQ

    Browser->>Next: Submit URLs / CSV
    Next->>API: POST /batches
    API->>API: Validate input
    API->>DB: Insert batch
    API->>DB: Insert URL rows
    DB-->>API: Commit
    API->>Queue: Enqueue one job per URL
    API-->>Next: batchId
    Next-->>Browser: Navigate to batch
```

The database must contain the batch and URL records before checking begins, and each URL is an independent background job. 

---

# 3. Worker Processing Flow

```mermaid
flowchart TD
    A["BullMQ job"] --> B["Worker"]
    B --> C{"Batch/URL processable?"}
    C -->|No| D["Skip safely"]
    C -->|Yes| E["Claim PENDING → PROCESSING"]
    E --> F["Acquire global concurrency slot"]
    F --> G["Acquire global rate-limit permit"]
    G --> H["HTTP request"]
    H --> I{"Result"}
    I -->|Success| J["Persist SUCCESS"]
    I -->|Retryable| K["BullMQ exponential backoff"]
    I -->|Permanent / exhausted| L["Persist FAILED"]
    K --> B
    J --> M["Update batch state"]
    L --> M
    D --> M
    M --> N["Publish update"]
```

The worker must preserve the required 10 requests/sec global rate limit, 5 in-flight concurrency limit, and up to 3 retries on transient failures. 

---

# 4. Live Update Flow

```mermaid
sequenceDiagram
    participant Worker
    participant DB as PostgreSQL
    participant Redis
    participant API1 as API Instance 1
    participant API2 as API Instance 2
    participant Client1
    participant Client2

    Worker->>DB: Commit URL result
    Worker->>Redis: Publish batch.updated

    Redis-->>API1: batch.updated
    Redis-->>API2: batch.updated

    API1-->>Client1: SSE event
    API2-->>Client2: SSE event

    Client1->>API1: GET batch state
    Client2->>API2: GET batch state

    API1->>DB: Read authoritative state
    API2->>DB: Read authoritative state
    DB-->>API1: Current state
    DB-->>API2: Current state
```

This allows live updates to remain correct when more than one API instance serves clients. 

---

# 5. Distributed Limits

```mermaid
flowchart LR
    W1["Worker 1"] --> C["Global concurrency\n5 slots"]
    W2["Worker 2"] --> C
    W3["Worker 3"] --> C

    C --> R["Global rate limiter\n10 req/sec"]
    R --> HTTP["External HTTP requests"]
```

Both controls are global.

Incorrect:

```text
Worker 1 → 5 concurrency
Worker 2 → 5 concurrency
```

Correct:

```text
All workers → shared 5-slot limit
```

Likewise, the rate limit is:

```text
All workers → shared 10 req/sec limit
```

not 10 req/sec per worker. 

---

# 6. Cancellation Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant DB
    participant Queue
    participant Worker
    participant Target

    User->>API: POST /batches/:id/cancel
    API->>DB: Conditional PROCESSING → CANCELLED
    DB-->>API: Commit
    API->>Queue: Optional cleanup
    API-->>User: CANCELLED

    Worker->>Queue: Receives queued job
    Worker->>DB: Check batch state
    DB-->>Worker: CANCELLED
    Worker-->>Queue: Skip

    Note over Worker,Target: Already-running request may finish
    Worker->>Target: HTTP request finishes
    Worker->>DB: Conditional completion
    DB-->>Worker: Cancellation preserved
```

Queue cleanup is not the correctness mechanism.

The worker must verify authoritative database state.

---

# 7. Retry Flow

```mermaid
flowchart LR
    A["HTTP attempt"] --> B{"Failure?"}
    B -->|No| C["SUCCESS"]
    B -->|Yes| D{"Transient?"}
    D -->|No| E["FAILED"]
    D -->|Yes| F{"Retries remaining?"}
    F -->|Yes| G["Exponential backoff"]
    G --> H["New BullMQ attempt"]
    H --> A
    F -->|No| E
```

Maximum:

```text
1 initial attempt
+
3 retries
=
4 outbound attempts
```

Every attempt passes through the global rate limiter.

---

# 8. Source-of-Truth Boundaries

```text
PostgreSQL
──────────
Authoritative:
- Batch status
- URL status
- Results
- Counters
- Attempts
- Cancellation
- Retry eligibility

BullMQ / Redis
──────────────
Represents:
- Pending work
- Retry scheduling
- Delayed jobs
- Queue delivery

SSE / Browser
─────────────
Represents:
- Notifications
- Current UI projection
```

A queue message is not proof that a URL is still eligible for processing.

---

# 9. Horizontal Scaling

```mermaid
flowchart TB
    LB["Load Balancer"]

    LB --> API1["API 1"]
    LB --> API2["API 2"]
    LB --> API3["API 3"]

    API1 --> DB["PostgreSQL"]
    API2 --> DB
    API3 --> DB

    API1 --> Redis["Redis"]
    API2 --> Redis
    API3 --> Redis

    Redis --> Q["BullMQ"]

    Q --> W1["Worker 1"]
    Q --> W2["Worker 2"]
    Q --> W3["Worker 3"]

    W1 --> DB
    W2 --> DB
    W3 --> DB

    W1 --> Redis
    W2 --> Redis
    W3 --> Redis
```

Adding API instances must not change application semantics.

Adding workers must not change:

```text
10 req/sec
5 concurrent checks
retry limits
idempotency
```

---

# 10. Cold Batch Page

Opening:

```text
/batches/:batchId
```

in a new tab follows:

```mermaid
flowchart TD
    A["Open batch URL"] --> B["Next.js route"]
    B --> C["Fetch current batch"]
    C --> D["Render persisted state"]
    D --> E{"Batch active?"}
    E -->|Yes| F["Open SSE"]
    E -->|No| G["Render terminal state"]
    F --> H["Receive notification"]
    H --> C
```

This ensures a new tab does not depend on previous client state. 

---

# 11. Complete Architecture

```mermaid
flowchart TB
    subgraph Browser["Browser"]
        UI["Next.js / React UI"]
    end

    subgraph API["API Process"]
        Routes["Fastify Routes"]
        Validation["Runtime Validation"]
        SSE["SSE Connections"]
    end

    subgraph Data["Shared Infrastructure"]
        PG["PostgreSQL\nSource of Truth"]
        Redis["Redis"]
        Queue["BullMQ"]
    end

    subgraph Workers["Worker Processes"]
        W1["Worker"]
        W2["Worker"]
        W3["Worker"]
        Limiter["Global Rate + Concurrency Controls"]
        Checker["HTTP Health Checker"]
    end

    subgraph External["Internet"]
        URLs["Submitted URLs"]
    end

    UI --> Routes
    UI --> SSE

    Routes --> Validation
    Validation --> PG
    Routes --> Queue
    SSE --> Redis

    Queue --> W1
    Queue --> W2
    Queue --> W3

    W1 --> Limiter
    W2 --> Limiter
    W3 --> Limiter

    Limiter --> Checker
    Checker --> URLs

    W1 --> PG
    W2 --> PG
    W3 --> PG

    W1 --> Redis
    W2 --> Redis
    W3 --> Redis

    Redis --> SSE
```

---

# 12. Architecture Principles

1. PostgreSQL is the source of truth.
2. BullMQ represents asynchronous work.
3. Redis provides shared coordination.
4. API and workers are separate processes.
5. URL checks never run inside HTTP request handlers.
6. Global limits are enforced across workers.
7. State transitions are idempotent.
8. SSE is a freshness mechanism, not the source of truth.
9. Refresh and reconnect always recover from PostgreSQL.
10. Horizontal scaling must not change correctness guarantees.

---

# 13. Requirement Traceability

| System Requirement | Architecture Mechanism |
|---|---|
| URL/CSV submission | Next.js + Fastify |
| Persist before checking | PostgreSQL transaction |
| One job per URL | BullMQ |
| Separate workers | Worker process |
| 10 req/sec globally | Redis-backed limiter |
| 5 checks in flight | Distributed concurrency control |
| 3 retries | BullMQ retry/backoff |
| Live updates | SSE + Redis |
| Refresh safe | PostgreSQL state fetch |
| Multiple API instances | Stateless API + Redis |
| Cancel | DB state transition + worker checks |
| Retry failed only | Conditional failed-row claiming |
| 30 sec cache | Shared batch-list cache |
| Shared types | TypeScript shared package |
| Direct batch URL | Next.js dynamic route |

The architecture is intentionally centered on the core requirements: global rate/concurrency behavior, infrastructure justification, source of truth, idempotency, type safety, Next.js fundamentals, process separation, and live-update resilience. 
