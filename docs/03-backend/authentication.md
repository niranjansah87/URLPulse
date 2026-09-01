# Authentication

URLPulse uses [Better Auth](https://better-auth.com) for a minimal, production-shaped
user identity: email + password sign-up / sign-in / sign-out, database-backed
sessions, and per-user ownership of batches. It is intentionally small - the
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
  restarts and are valid across every horizontally scaled API instance - no
  in-memory session state, and **no Redis dependency for auth** (Redis stays
  reserved for BullMQ and pub/sub).
- The worker is untouched: it operates on persisted job/batch state and never
  needs a session.

## Sessions and cookies

- Session token in an **HTTP-only** cookie, signed with `BETTER_AUTH_SECRET`.
- Local dev: `SameSite=Lax`, `Secure=false` (web and API are both `localhost`,
  which is same-site - cookies ignore port).
- Production: `SameSite=None; Secure` for cross-site credentialed requests. CORS
  reflects only `WEB_ORIGIN` and sets `credentials: true` (never `*` with
  credentials).

## Database

Migrations (forward-only plain SQL, applied by `apps/api/src/migrate.ts`):

- `0002_better_auth.sql` - `user`, `session`, `account`, `verification`. Columns
  are camelCase (quoted) to match Better Auth's Kysely/postgres adapter exactly;
  schema captured from `getAuthTables()` for the installed version.
- `0003_batches_user_id.sql` - adds `batches.user_id text REFERENCES "user"(id)
  ON DELETE CASCADE`, plus `idx_batches_user_created (user_id, created_at DESC)`.
  Nullable by design: pre-auth batches have no owner and match no user, so they
  are invisible rather than leaking.
- `0004_rate_limit.sql` - Better Auth's `rateLimit` table, backing DB-based
  distributed rate limiting (see Abuse protection below).
- `0005_user_unverified_login_count.sql` - `user.unverifiedLoginCount`, backing
  the email-verification grace period (see Transactional email).
- `0006_user_login_lockout.sql` - `user.failedLoginCount` / `user.lockedUntil`,
  backing the wrong-password lockout (see Transactional email → Wrong-password lockout).

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

- `apps/web/lib/auth-client.ts` - Better Auth React client, `credentials:
  "include"`, base URL derived from `NEXT_PUBLIC_API_URL`.
- Sign-in / sign-up pages (`/login`, `/signup`) call the client; the API sets the
  session cookie.
- The authenticated app frame (`app/(app)/layout.tsx`) validates the session
  server-side (forwarding the request cookies to `/api/auth/get-session`) and
  redirects signed-out visitors to `/login`. An auth-service outage degrades to a
  demo view rather than a false logout; the API still enforces auth.
- The profile menu in the app header shows the authenticated user and supports
  sign-out.

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
  atomically on use (single-use, replay-safe). Tokens are **never logged** - not
  by the auth callbacks, the email service, or the dev no-op path.
- **Session hygiene.** `revokeSessionsOnPasswordReset: true` - a reset revokes the
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
across all API instances - never a per-process in-memory limiter. It is IP-based,
with tight custom caps on the sensitive endpoints (password reset: **3 requests /
5 min**; reset submit: 5 / 5 min; sign-in: 10 / min). Behind a proxy, forward the
client IP so limits key on the real address.

## Transactional email

All account email is one reusable system in `apps/api/src/lib/email.ts`: a shared
layout (`renderEmail`) + four templates + a Resend-backed `emailService`. Every
template shares the header, card, CTA button, security notice, and footer, so they
read as one product (light card, URLPulse-blue CTA, navy headings - matching the
brand references) while staying email-client safe (tables + inline CSS, no JS/web
fonts, an emoji hero rather than heavy images). Every email ships **HTML and a
deliberate plain-text version**.

| Email | Subject | Trigger (Better Auth) |
| --- | --- | --- |
| Welcome | `Welcome to URLPulse` | `emailVerification.afterEmailVerification` - once, after the user verifies their email |
| Verification | `Verify your URLPulse email` | `emailVerification.sendVerificationEmail` - **on sign-up** (`sendOnSignUp: true`) and on the grace-period resend |
| Password reset | `Reset your URLPulse password` | `emailAndPassword.sendResetPassword` |
| Password changed | `Your URLPulse password was changed` | `emailAndPassword.onPasswordReset` - only after a confirmed change |

Boundaries: **Resend delivers; Better Auth owns tokens, expiry, hashing, and
sessions; PostgreSQL holds the state.** Callers pass already-built, trusted URLs
(from `WEB_ORIGIN` / Better Auth's config-derived verify URL - never a request
Host header). Dynamic values (name, URLs) are HTML-escaped; recipients are
stripped of CR/LF (defense-in-depth against header injection). Tokens, keys, and
recipients are never logged, and every delivery failure is caught so it never
fails account creation or changes the anti-enumeration reset response.

**Verification stance (soft gate).** A verification email is sent on sign-up
(Better Auth's real token, 24-hour expiry, `autoSignInAfterVerification`). Sign-in
is **not hard-gated**: an unverified user may sign in up to **3 times** - each
sign-in shows a reminder toast - after which `databaseHooks.session.create.before`
blocks sign-in with `403 EMAIL_VERIFICATION_REQUIRED` until they verify. The
grace count (`user.unverifiedLoginCount`, migration `0005`) is server-owned
(`input:false`, never client-settable) and increments only for unverified users;
verified users are never counted or blocked. On the block, the frontend resends
the link via `authClient.sendVerificationEmail`. Verifying auto-signs the user in
and, at that point, the **welcome email is sent** (not at sign-up), so it only
ever reaches a confirmed address.

**Wrong-password lockout.** Better Auth has no per-account lockout, so it is added
with request hooks: after **3 consecutive wrong passwords** the account is locked
for **30 minutes** (`before` hook rejects sign-in with `403 ACCOUNT_LOCKED`) and a
password-reset email is sent automatically so a genuine user has an immediate
recovery path. State lives in server-only columns (`failedLoginCount`,
`lockedUntil`; migration `0006`) that are **not** additionalFields, so they never
appear in any client payload. Only existing accounts are ever counted (no
enumeration); a successful sign-in or a completed reset clears the lock. The
frontend shows a distinct toast for `ACCOUNT_LOCKED` vs `EMAIL_VERIFICATION_REQUIRED`.

**Sender:** `RESEND_FROM_EMAIL` (default `URLPulse <onboarding@resend.dev>`, the
Resend shared test sender). Production requires a **Resend-verified domain**
sender - set `RESEND_FROM_EMAIL` to a mailbox on a verified domain, or Resend
rejects the send.

**Local dev / tests:** when `RESEND_API_KEY` is unset the service no-ops safely
(never printing the URL/token). Automated tests mock Resend or stub the service -
no real email is ever sent. Manual smoke test (sends ONE real email; never commit
a key): with a real `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`, use the
Better Auth flow (e.g. request a password reset for your own verified address).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | prod (dev/test default) | Signs session cookies; must be fixed and shared across API instances. |
| `BETTER_AUTH_URL` | no (default `http://localhost:4000`) | Public API base URL where Better Auth is mounted. |
| `WEB_ORIGIN` | no (default `http://localhost:3000`) | Web origin trusted for credentialed CORS; also used to build the reset link. |
| `RESEND_API_KEY` | prod (dev/test no-op) | Resend API key for all transactional email (welcome, verification, reset, password-changed). |
| `RESEND_FROM_EMAIL` | no (default `URLPulse <onboarding@resend.dev>`) | Sender; production needs a Resend-verified domain mailbox. |

## Intentionally not implemented

Out of scope: OAuth/social providers, MFA, organizations/teams, role-based access
control, and billing. (Email verification IS implemented as a soft gate - see
Transactional email.)

## Local development & tests

```bash
docker compose up -d          # PostgreSQL + Redis
pnpm db:migrate               # applies 0001..0006
pnpm dev                      # web + api + worker

pnpm --filter @urlpulse/api test   # unit always; integration when DB reachable
```

Auth coverage: `require-auth.test.ts` (401 boundary), `routes/batches.test.ts`
(unauthenticated → 401), `lib/cache.test.ts` (per-user isolation),
`repositories/batches.integration.test.ts` (cross-user ownership),
`routes/auth.integration.test.ts` (sign-up / duplicate / bad-password / sign-in /
session / authorized API call / sign-out). Integration tests self-skip without a
reachable database.
