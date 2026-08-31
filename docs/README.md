# URLPulse Documentation

The complete product and engineering documentation for URLPulse. PostgreSQL is the authoritative source of truth throughout; Redis and BullMQ are infrastructure for coordination and background work.

## Product

- [PRD](./01-product/PRD.md) — product goals, users, and behavior
- [Requirements](./01-product/requirements.md) — functional and non-functional requirements
- [Scope](./01-product/scope.md) — current scope and future considerations

## Architecture

- [Architecture](./02-architecture/architecture.md) — system architecture and component responsibilities
- [Decisions](./02-architecture/decisions.md) — key architectural decisions and trade-offs
- [Architecture Diagram](./02-architecture/architecture-diagram.md) — component relationships and data flow

## Backend

- [API](./03-backend/api.md) — HTTP API contracts and endpoints
- [Database](./03-backend/database.md) — schema, entities, indexes, and invariants
- [Job Lifecycle](./03-backend/job-lifecycle.md) — batch and URL state machines
- [Rate Limiting](./03-backend/rate-limiting.md) — global 10 req/s limit across all workers
- [Retries & Idempotency](./03-backend/retries-and-idempotency.md) — retry policy and at-least-once safety
- [Cancellation](./03-backend/cancellation.md) — cancelling queued and in-flight work safely

## Frontend

- [Frontend Architecture](./04-frontend/frontend-architecture.md) — UI structure and state model
- [Live Updates](./04-frontend/live-updates.md) — SSE transport and reconnection strategy

## Infrastructure

- [Local Development](./05-infrastructure/local-development.md) — running the stack locally
- [Scaling](./05-infrastructure/scaling.md) — horizontal scaling and distributed guarantees

## Quality

- [Testing](./06-quality/testing.md) — testing strategy and priority guarantees
- [Edge Cases](./06-quality/edge-cases.md) — enumerated risks and expected handling

## Conventions

Each technical document describes **behavior, invariants, decisions, and trade-offs** — not line-by-line code. When a change affects the database, queues, workers, rate limiting, concurrency, live updates, or API contracts, update the relevant document in the same change. See [`../CLAUDE.md`](../CLAUDE.md) for engineering guardrails.
