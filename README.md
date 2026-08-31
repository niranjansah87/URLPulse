# URLPulse

A scalable bulk URL health checker that processes URLs asynchronously and provides real-time progress as checks complete.

Built as a technical take-home project using **Next.js, TypeScript, Fastify, PostgreSQL, Redis, and BullMQ**.

## Overview

URLPulse allows users to submit a list of URLs or upload a CSV file and monitor the health-checking process in real time.

For each URL, URLPulse records:

* Final HTTP status code
* Response time
* Page title, when available
* Success or failure state
* Processing status

Each URL is processed independently as a background job, allowing large batches to be handled without blocking the API.

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript

### Backend

* Node.js
* TypeScript
* Fastify

### Data & Infrastructure

* PostgreSQL — persistent application state
* Redis — distributed coordination and job infrastructure
* BullMQ — background job processing

### Live Updates

* Server-Sent Events (SSE)

### Development

* Docker / Docker Compose

## Architecture

```text
                    ┌──────────────────────┐
                    │       Next.js        │
                    │        Web UI        │
                    └──────────┬───────────┘
                               │
                               │ HTTP / SSE
                               ▼
                    ┌──────────────────────┐
                    │     Fastify API      │
                    │                      │
                    │  Batch Management    │
                    │  URL Management      │
                    │  SSE Connections     │
                    └───────┬───────┬──────┘
                            │       │
                            │       │
                            ▼       ▼
                   ┌────────────┐ ┌───────────┐
                   │ PostgreSQL │ │   Redis   │
                   │            │ │           │
                   │ Source of  │ │ BullMQ    │
                   │ truth      │ │ Queues    │
                   └────────────┘ └─────┬─────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Worker Process  │
                              │                  │
                              │ Concurrent URL   │
                              │ health checks    │
                              └────────┬─────────┘
                                       │
                                       ▼
                                 External URLs
```

The API server and worker process are intentionally separated.

PostgreSQL is the source of truth for application state, while Redis/BullMQ is responsible for background job orchestration.

## Key Design Decisions

### PostgreSQL as the source of truth

Batch and URL state is persisted in PostgreSQL before jobs are dispatched.

The UI does not treat local state or BullMQ state as authoritative.

This allows a batch page to be opened directly or refreshed at any point while still reconstructing its complete state.

### Background processing

Each URL is represented as an independent BullMQ job.

This prevents a large batch from blocking the API and allows individual URLs to succeed, fail, retry, or be cancelled independently.

### Global rate limiting

URL checks are subject to a global limit of **10 HTTP requests per second across the entire system**.

The implementation uses Redis-backed coordination so the limit is not accidentally multiplied when multiple worker processes are running.

### Concurrency

At most **5 URL checks are in flight at the same time**.

Concurrency is controlled at the worker layer and is designed separately from the global request-rate limit.

### Retries

Transient failures are retried up to three times using exponential backoff.

Permanent failures are recorded without unnecessary retries.

### Idempotency

URL processing is designed to be idempotent so that duplicate job execution does not incorrectly corrupt persisted batch state.

Database state transitions are validated before being applied.

### Live updates

URLPulse uses Server-Sent Events to stream completed URL updates to the browser.

The browser can reconnect after a dropped connection and retrieve the authoritative state from the API.

SSE was chosen because the communication pattern is primarily server-to-client progress updates and does not require a bidirectional WebSocket connection.

## Running Locally

### Prerequisites

* Node.js
* Docker
* Docker Compose

### Start the application

```bash
docker compose up --build
```

The exact command above starts the required application infrastructure and services.

## Project Structure

```text
urlpulse/
├── apps/
│   ├── web/              # Next.js application
│   └── api/              # Fastify API
│
├── worker/               # BullMQ worker process
│
├── packages/
│   └── shared/           # Shared TypeScript types
│
├── docker-compose.yml
├── package.json
├── README.md
└── LICENSE
```

## Core Features

* [x] Bulk URL submission
* [x] CSV upload
* [x] PostgreSQL persistence
* [x] Background URL processing
* [x] BullMQ job queue
* [x] Redis-backed coordination
* [x] Global 10 requests/second rate limit
* [x] Maximum 5 concurrent checks
* [x] Exponential retry/backoff
* [x] Real-time progress updates
* [x] Refresh-safe batch state
* [x] Batch cancellation
* [x] Retry failed URLs only
* [x] 30-second batch-list caching
* [x] Shared TypeScript types

## Horizontal Scaling

The API can be scaled horizontally because application state is not stored in an individual API instance.

PostgreSQL remains the source of truth for persisted state, while Redis provides shared coordination for background processing.

Multiple API instances can therefore serve clients without requiring sticky sessions.

Workers can also be scaled horizontally while maintaining the global rate-limit requirement through shared Redis coordination.

## Trade-offs

The implementation intentionally focuses on correctness and clarity over unnecessary infrastructure.

### SSE instead of WebSockets

SSE provides a simpler implementation for one-way progress updates and has built-in browser reconnection semantics.

A WebSocket architecture could be useful if the product later requires more interactive bidirectional communication.

### PostgreSQL polling vs event-driven updates

Persistent state remains in PostgreSQL, while live updates are delivered separately.

This keeps the database authoritative and prevents the live transport layer from becoming a second source of truth.

### Simplified authentication

Authentication and authorization are intentionally out of scope for this assignment.

## What I Would Improve With More Time

Potential future improvements include:

* Authentication and authorization
* More detailed monitoring and metrics
* Distributed tracing
* Better URL validation and SSRF protection
* Configurable checking policies
* More comprehensive integration/load testing
* Production deployment configuration
* More sophisticated cache invalidation
* Historical health-check data

## Testing

The most important tests focus on the requirements that can easily break under load:

* Global rate limiting
* Worker concurrency
* Retry behavior
* Idempotent job execution
* Cancellation of queued jobs
* Cancellation of in-flight jobs
* Retry-failed behavior
* SSE reconnection
* State consistency after refresh
* Multiple worker processes

## Technical Task

This project was implemented as a technical take-home exercise for a Full Stack Developer position.

The implementation follows the requirements provided in the assignment while making explicit architectural decisions where the specification leaves implementation details open.

## License

MIT License
