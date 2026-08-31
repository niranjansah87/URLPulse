# Contributing to URLPulse

Thanks for your interest in improving URLPulse. This guide keeps contributions consistent and the system correct.

## Project Philosophy

URLPulse favors **simple, correct, testable, and scalable** over complex and fashionable. Solve the problem in front of you, keep the diff small, and prefer deleting code over adding it. Correctness and reliability come before features and polish.

## Development Setup

> The application workspace is being scaffolded. Until then, contributions are primarily to documentation and repository structure. Once `apps/`, `worker/`, and `docker-compose.yml` exist, the setup is:

```bash
git clone https://github.com/niranjansah87/Urlpulse.git
cd Urlpulse
cp .env.example .env
docker compose up --build
```

See [`docs/05-infrastructure/local-development.md`](./docs/05-infrastructure/local-development.md).

## Branch Naming

```text
feat/<short-description>
fix/<short-description>
docs/<short-description>
refactor/<short-description>
chore/<short-description>
```

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): summary

feat, fix, docs, refactor, test, chore, perf, build, ci
```

Keep the subject focused; explain **why** in the body when it is non-obvious. One concern per commit.

## Pull Requests

- Keep PRs focused on a single concern.
- Describe what changed and why.
- Link related issues.
- Ensure lint, typecheck, and tests pass (once those scripts exist).
- Update documentation affected by the change.

## Testing Expectations

New non-trivial logic ships with a test. Prioritize the system guarantees most likely to break: global rate limit (across multiple workers), concurrency cap, retries, idempotency, cancellation, retry-failed, live-update recovery, and cache behavior. See [`docs/06-quality/testing.md`](./docs/06-quality/testing.md).

## Documentation Expectations

Documentation lives in [`docs/`](./docs/README.md). Describe behavior, invariants, and trade-offs — not line-by-line code. Never leave docs describing behavior the code no longer has.

## Architecture Changes

Do not introduce architectural changes without documenting the reasoning. Any change affecting:

- database schema or entities
- queues / BullMQ
- worker behavior
- global rate limiting
- concurrency
- live updates
- API contracts

**must** update the relevant document under `docs/` in the same PR, and record the decision in [`docs/02-architecture/decisions.md`](./docs/02-architecture/decisions.md).

## Code Quality

- TypeScript with no `any` escape hatches.
- Handle errors at trust boundaries; never swallow them.
- Comments explain **why**, not **what**.
- No dead code, no TODO placeholders left behind.
- Do not add dependencies without a clear justification.

## Security

Validate all external input. URLPulse makes outbound requests to user-supplied URLs, so treat SSRF as a first-class concern. Never commit secrets. See [`SECURITY.md`](./SECURITY.md).
