# Authentication

URLPulse uses [Better Auth](https://better-auth.com) for a minimal, production-shaped
user identity: email + password sign-up / sign-in / sign-out, database-backed
sessions, and per-user ownership of batches. It is intentionally small — the
foundation a user-scoped SaaS needs, nothing more.

## Why Better Auth

The product needs real user identity so application data can be owned by a user.
Better Auth gives secure password hashing, session management, and a typed client
without hand-rolling auth. It is framework-agnostic and integrates with the
existing PostgreSQL, so it adds no new infrastructure.

## Placement and topology

Better Auth is mounted **inside the Fastify API**, not in Next.js:

```
Browser ──cookie──▶ Fastify API  ── Better Auth handler  /api/auth/*
   ▲                    │         └─ requireAuth boundary ─▶ batch routes
   │ credentialed       ▼
   └── Next.js web    PostgreSQL (user/session/account/verification + batches)
```

- The API owns identity, so it natively has the authenticated user and enforces
  ownership at the data boundary.
- Sessions are **PostgreSQL-backed** (Better Auth's default), so they survive
  restarts and are valid across every horizontally scaled API instance — no
  in-memory session state, and **no Redis dependency for auth** (Redis stays
  reserved for BullMQ and pub/sub).
- The worker is untouched: it operates on persisted job/batch state and never
  needs a session.

## Sessions and cookies

- Session token in an **HTTP-only** cookie, signed with `BETTER_AUTH_SECRET`.
- Local dev: `SameSite=Lax`, `Secure=false` (web and API are both `localhost`,
  which is same-site — cookies ignore port).
- Production: `SameSite=None; Secure` for cross-site credentialed requests. CORS
  reflects only `WEB_ORIGIN` and sets `credentials: true` (never `*` with
  credentials).

## Database

Migrations (forward-only plain SQL, applied by `apps/api/src/migrate.ts`):

- `0002_better_auth.sql` — `user`, `session`, `account`, `verification`. Columns
  are camelCase (quoted) to match Better Auth's Kysely/postgres adapter exactly;
  schema captured from `getAuthTables()` for the installed version.
- `0003_batches_user_id.sql` — adds `batches.user_id text REFERENCES "user"(id)
  ON DELETE CASCADE`, plus `idx_batches_user_created (user_id, created_at DESC)`.
  Nullable by design: pre-auth batches have no owner and match no user, so they
  are invisible rather than leaking.
- `0004_rate_limit.sql` — Better Auth's `rateLimit` table, backing DB-based
  distributed rate limiting (see Abuse protection below).

Deleting a user cascades to their sessions, accounts, and batches.

## API authorization

- `apps/api/src/lib/require-auth.ts` is the single auth boundary. Every batch
  route runs it as a plugin-wide `preHandler`; it resolves the session from the
  cookies and attaches `req.user`, or throws **401**.
- Ownership is enforced in the service/repository: every batch query is scoped
  `WHERE user_id = <session user>`. A batch owned by another user is
  indistinguishable from one that does not exist → **404**, never leaking
  ownership. The client-supplied body can never set the owner; `user_id` comes
  only from the session.
- Errors: `401 UNAUTHORIZED` (no session), `403 FORBIDDEN` (reserved), `404
  NOT_FOUND` (missing or not owned).

## Cache isolation

The batch-list cache key includes the user id
(`cache:batches:list:v{ver}:u{userId}:{page}:{pageSize}`), so one user's cached
page can never satisfy another user's read. A mutation bumps a global version
counter for immediate invalidation.

## Live updates (SSE)

`GET /api/batches/:id/events` requires auth and verifies ownership before
subscribing, so a client can never subscribe to (or learn of) another user's
batch. The event carries only `{batchId, version}`; clients refetch authoritative
state through the ownership-checked endpoint.

## Frontend ↔ API

- `apps/web/lib/auth-client.ts` — Better Auth React client, `credentials:
  "include"`, base URL derived from `NEXT_PUBLIC_API_URL`.
- Sign-in / sign-up pages (`/login`, `/signup`) call the client; the API sets the
  session cookie.
- The authenticated app frame (`app/(app)/layout.tsx`) validates the session
  server-side (forwarding the request cookies to `/api/auth/get-session`) and
  redirects signed-out visitors to `/login`. An auth-service outage degrades to a
  demo view rather than a false logout; the API still enforces auth.
- Settings shows the authenticated user (name — editable, email, member-since)
  and supports sign-out and account deletion.

## Password reset

Self-service password reset uses Better Auth's built-in flow (no custom token
table or crypto) plus Resend for delivery:

```
/forgot-password → requestPasswordReset(email) → Better Auth mints a token
  → sendResetPassword() emails WEB_ORIGIN/reset-password?token=… via Resend
  → user opens the link → /reset-password reads the token → resetPassword(token, newPassword)
  → password updated, other sessions revoked → sign in at /login
```

Security properties:

- **Anti-enumeration.** `POST /api/auth/request-password-reset` returns the same
  generic `200` whether or not the email has an account; the email is only sent
  for a real account, and `sendResetPassword` swallows delivery errors so a Resend
  failure cannot change the response. The UI always shows the same "if an account
  exists…" message.
- **Trusted reset URL.** The link is built from the configured `WEB_ORIGIN`, never
  from a request `Host` header, so it cannot be poisoned into an open redirect.
  The frontend never honors a `redirect` parameter; success routes only to
  `/login`.
- **Token safety.** Better Auth stores the token in the `verification` table,
  expires it after `resetPasswordTokenExpiresIn` (**1 hour**), and consumes it
  atomically on use (single-use, replay-safe). Tokens are **never logged** — not
  by the auth callbacks, the email service, or the dev no-op path.
- **Session hygiene.** `revokeSessionsOnPasswordReset: true` — a reset revokes the
  user's other sessions, so a stolen pre-reset session cannot outlive the change.
  The user is **not** auto-logged-in; they sign in with the new password.
- **Password policy.** Minimum 8 characters, enforced by Better Auth server-side
  and mirrored in the sign-up and reset UIs.

The reset email is a small transactional template (`apps/api/src/lib/email.ts`)
behind an `emailService` abstraction; the auth config depends on the abstraction,
not the Resend SDK directly. When `RESEND_API_KEY` is unset (dev/test) the service
no-ops safely.

### Abuse protection

Better Auth rate limiting is enabled in every environment except tests, backed by
the **shared PostgreSQL** `rateLimit` table (migration `0004`) so the limit holds
across all API instances — never a per-process in-memory limiter. It is IP-based,
with tight custom caps on the sensitive endpoints (password reset: **3 requests /
5 min**; reset submit: 5 / 5 min; sign-in: 10 / min). Behind a proxy, forward the
client IP so limits key on the real address.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | prod (dev/test default) | Signs session cookies; must be fixed and shared across API instances. |
| `BETTER_AUTH_URL` | no (default `http://localhost:4000`) | Public API base URL where Better Auth is mounted. |
| `WEB_ORIGIN` | no (default `http://localhost:3000`) | Web origin trusted for credentialed CORS; also used to build the reset link. |
| `RESEND_API_KEY` | prod (dev/test no-op) | Resend API key for sending password-reset email. |
| `RESEND_FROM_EMAIL` | no (default `URLPulse <onboarding@resend.dev>`) | Verified sender for transactional email. |

## Intentionally not implemented

Out of scope: OAuth/social providers, MFA, **email verification of sign-ups**
(reset email is sent, but sign-up addresses are not verification-gated),
organizations/teams, role-based access control, and billing. The Settings UI shows
honest placeholders for billing, team, and API keys.

## Local development & tests

```bash
docker compose up -d          # PostgreSQL + Redis
pnpm db:migrate               # applies 0001..0004 (incl. rateLimit table)
pnpm dev                      # web + api + worker

pnpm --filter @urlpulse/api test   # unit always; integration when DB reachable
```

Auth coverage: `require-auth.test.ts` (401 boundary), `routes/batches.test.ts`
(unauthenticated → 401), `lib/cache.test.ts` (per-user isolation),
`repositories/batches.integration.test.ts` (cross-user ownership),
`routes/auth.integration.test.ts` (sign-up / duplicate / bad-password / sign-in /
session / authorized API call / sign-out). Integration tests self-skip without a
reachable database.
