import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { config } from "./env";
import { apiConfig } from "./env";
import { emailService } from "./email";

/** Password-reset token lifetime. Kept modest so a leaked link ages out quickly. */
const RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
/** Email-verification token lifetime (matches the "24 hours" reference copy). */
const VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24 hours
/**
 * Grace period: an unverified user may sign in this many times before
 * verification becomes mandatory. Enforced in the session.create.before hook.
 */
const MAX_UNVERIFIED_LOGINS = 3;
/** Wrong-password lockout: after this many consecutive failures, lock the account. */
const MAX_FAILED_LOGINS = 3;
/** How long a locked account stays locked. */
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Better Auth instance for URLPulse.
 *
 * Placement: mounted inside the Fastify API (not Next.js) so the API natively
 * owns identity and can enforce batch ownership. Sessions are PostgreSQL-backed
 * (Better Auth's default database strategy), which means they survive process
 * restarts and are valid across every horizontally scaled API instance - no
 * in-memory server state and no Redis dependency for auth (Redis stays reserved
 * for BullMQ / pub-sub). See docs/03-backend/authentication.md.
 *
 * Better Auth uses its own node-postgres Pool against the SAME database as the
 * app's postgres.js pool. Its managed tables (user/session/account/verification)
 * live alongside the app schema; see migration 0002_better_auth.sql.
 */
const isProd = config.NODE_ENV === "production";

/**
 * Dedicated small connection pool for Better Auth. Sized modestly because auth
 * queries are light (session lookups); it counts toward the same PostgreSQL
 * max_connections budget as the app pools (see @urlpulse/config DB_POOL_MAX).
 */
export const authPool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 5,
});

/**
 * Wrong-password lockout state lives in server-only columns on the user row
 * (`failedLoginCount`, `lockedUntil`; migration 0006). They are read/written via
 * raw SQL here and deliberately NOT declared as Better Auth additionalFields, so
 * they are never included in any user payload returned to the client. Failures
 * are only ever counted for an existing account, so this cannot be used to probe
 * which emails exist.
 */
interface LockState {
  id: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

async function getLockState(email: string): Promise<LockState | null> {
  const { rows } = await authPool.query<LockState>(
    'SELECT "id", "failedLoginCount", "lockedUntil" FROM "user" WHERE "email" = $1',
    [email],
  );
  return rows[0] ?? null;
}

async function setLockState(id: string, failedLoginCount: number, lockedUntil: Date | null): Promise<void> {
  await authPool.query('UPDATE "user" SET "failedLoginCount" = $2, "lockedUntil" = $3 WHERE "id" = $1', [
    id,
    failedLoginCount,
    lockedUntil,
  ]);
}

export const auth = betterAuth({
  baseURL: apiConfig.BETTER_AUTH_URL,
  secret: apiConfig.BETTER_AUTH_SECRET,
  database: authPool,
  // The Next.js web origin must be trusted for cross-origin credentialed calls.
  trustedOrigins: [apiConfig.WEB_ORIGIN],
  emailAndPassword: {
    enabled: true,
    // Email verification workflows are intentionally out of scope (minimal auth).
    requireEmailVerification: false,
    // Matches the frontend's minimum; enforced server-side regardless of the UI.
    minPasswordLength: 8,
    // Token lifetime; Better Auth stores it in the verification table, consumes
    // it atomically on reset (single-use, replay-safe), and rejects it when expired.
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    // A password change should not leave old, possibly-stolen sessions valid.
    revokeSessionsOnPasswordReset: true,
    /**
     * Send the reset email. The reset URL is built from the trusted, configured
     * WEB_ORIGIN - never from a request Host header - so it cannot be poisoned
     * into an open redirect. Failures are caught and logged safely (never the
     * token) and never rethrown, so the public forget-password response stays
     * generic and cannot be used to tell whether an account exists.
     */
    async sendResetPassword({ user, token }) {
      const resetUrl = `${apiConfig.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await emailService.sendPasswordReset({
          to: user.email,
          name: user.name,
          resetUrl,
          expiresMinutes: RESET_TOKEN_TTL_SECONDS / 60,
        });
      } catch (err) {
        console.error("[auth] password reset email delivery failed", {
          userId: user.id,
          error: (err as Error).message,
        });
      }
    },
    // Runs only after Better Auth confirms the password was changed. Confirm the
    // change with a success email; never send it on a failed reset.
    async onPasswordReset({ user }) {
      // Safe audit event: identifier only, never the token or password.
      console.info("[auth] password reset succeeded", { userId: user.id });
      // A completed reset clears any wrong-password lockout so the user can sign
      // in immediately with the new password.
      await setLockState(user.id, 0, null).catch(() => undefined);
      try {
        await emailService.sendPasswordResetSuccess({
          to: user.email,
          name: user.name,
          signInUrl: `${apiConfig.WEB_ORIGIN}/login`,
        });
      } catch (err) {
        console.error("[auth] password-changed email delivery failed", {
          userId: user.id,
          error: (err as Error).message,
        });
      }
    },
  },
  /**
   * A verification email is sent on sign-up. Sign-in is NOT hard-gated: an
   * unverified user may sign in up to MAX_UNVERIFIED_LOGINS times (with a
   * reminder), after which the session.create.before hook blocks sign-in until
   * they verify. Verifying auto-signs the user in.
   */
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
    async sendVerificationEmail({ user, url }) {
      // `url` is assembled by Better Auth from the configured baseURL (trusted),
      // never a request Host header. Override only the callbackURL so that after
      // the API verifies the token the browser lands on the web app's
      // /verify-email result page (WEB_ORIGIN is trusted, so originCheck passes).
      const verifyUrl = new URL(url);
      verifyUrl.searchParams.set("callbackURL", `${apiConfig.WEB_ORIGIN}/verify-email`);
      try {
        await emailService.sendVerification({
          to: user.email,
          name: user.name,
          verifyUrl: verifyUrl.toString(),
          expiresMinutes: VERIFICATION_TOKEN_TTL_SECONDS / 60,
        });
      } catch (err) {
        console.error("[auth] verification email delivery failed", {
          userId: user.id,
          error: (err as Error).message,
        });
      }
    },
    // The welcome email is sent once the address is confirmed (not at sign-up),
    // so it only ever reaches verified users. Best-effort.
    async afterEmailVerification(user) {
      try {
        await emailService.sendWelcome({
          to: user.email,
          name: user.name,
          dashboardUrl: `${apiConfig.WEB_ORIGIN}/batches`,
        });
      } catch (err) {
        console.error("[auth] welcome email delivery failed", {
          userId: user.id,
          error: (err as Error).message,
        });
      }
    },
  },
  databaseHooks: {
    session: {
      create: {
        /**
         * Enforce the verification grace period on every sign-in. An unverified
         * user is allowed through their first MAX_UNVERIFIED_LOGINS sign-ins
         * (the frontend shows a reminder); the next sign-in is blocked with a
         * FORBIDDEN + EMAIL_VERIFICATION_REQUIRED code until they verify. Verified
         * users are never counted or blocked.
         */
        before: async (session, ctx) => {
          if (!ctx) return;
          const user = await ctx.context.internalAdapter.findUserById(session.userId);
          if (!user || user.emailVerified) return;
          const prior = (user as { unverifiedLoginCount?: number }).unverifiedLoginCount ?? 0;
          const count = prior + 1;
          await ctx.context.internalAdapter.updateUser(session.userId, { unverifiedLoginCount: count });
          if (count > MAX_UNVERIFIED_LOGINS) {
            throw new APIError("FORBIDDEN", {
              message: "Please verify your email address to continue signing in.",
              code: "EMAIL_VERIFICATION_REQUIRED",
            });
          }
        },
      },
    },
  },
  /**
   * Wrong-password lockout (no Better Auth built-in). `before` blocks sign-in
   * while an account is locked; `after` counts consecutive failures on
   * /sign-in/email and, on the MAX_FAILED_LOGINS-th, locks the account for
   * LOCK_DURATION_MS and auto-sends a password-reset email. Only existing
   * accounts are ever counted, so this cannot be used to enumerate emails; a
   * successful sign-in clears the counter.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) return;
      const state = await getLockState(email);
      if (state?.lockedUntil && state.lockedUntil.getTime() > Date.now()) {
        throw new APIError("FORBIDDEN", {
          code: "ACCOUNT_LOCKED",
          message:
            "Too many failed sign-in attempts. Your account is locked for 30 minutes. We've emailed you a link to reset your password.",
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) return;
      const state = await getLockState(email);
      if (!state) return; // unknown email: never tracked (enumeration-safe)
      const returned = ctx.context.returned;
      if (!(returned instanceof APIError)) {
        // Genuine successful sign-in: clear any prior failures / lock.
        if (state.failedLoginCount > 0 || state.lockedUntil) await setLockState(state.id, 0, null);
        return;
      }
      // Count ONLY a genuine wrong-password failure (401). Other errors - the
      // verification-required or already-locked 403s - are correct-password or
      // pre-empted requests and must neither advance nor clear the counter.
      const wrongPassword =
        returned.status === "UNAUTHORIZED" || (returned as { statusCode?: number }).statusCode === 401;
      if (!wrongPassword) return;
      const count = state.failedLoginCount + 1;
      if (count >= MAX_FAILED_LOGINS) {
        await setLockState(state.id, 0, new Date(Date.now() + LOCK_DURATION_MS));
        // Auto-send a reset link so a legitimate user who forgot their password
        // has an immediate recovery path. Best-effort; failures are swallowed and
        // never change the sign-in response.
        try {
          await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
        } catch (err) {
          console.error("[auth] lockout reset email failed", { userId: state.id, error: (err as Error).message });
        }
      } else {
        await setLockState(state.id, count, null);
      }
    }),
  },
  /**
   * Abuse protection for the security-sensitive auth endpoints. Storage is the
   * shared PostgreSQL database, so the limit holds across every API instance
   * (no in-memory per-process limiter). Better Auth enables rate limiting in
   * production; it is enabled here in every environment except tests. Password
   * reset is tightly capped to prevent email flooding / Resend abuse.
   */
  rateLimit: {
    enabled: config.NODE_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/request-password-reset": { window: 300, max: 3 },
      "/forget-password": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 300, max: 5 },
    },
  },
  user: {
    additionalFields: {
      // Tracks how many times an unverified user has signed in (grace period).
      // input:false - clients can never set it; only the server increments it.
      unverifiedLoginCount: { type: "number", defaultValue: 0, input: false, required: false },
    },
  },
  advanced: {
    // Web (:3000) and API (:4000) are separate origins. In production they are
    // assumed to be served cross-site, which requires SameSite=None; Secure so
    // the browser sends the session cookie on credentialed cross-site requests.
    // In local dev both are localhost (same-site), so Lax works over plain HTTP.
    defaultCookieAttributes: isProd
      ? { sameSite: "none", secure: true }
      : { sameSite: "lax", secure: false },
  },
});

export type Auth = typeof auth;

/** The authenticated user shape Better Auth returns from a validated session. */
export type AuthUser = (typeof auth.$Infer.Session)["user"];
export type AuthSession = (typeof auth.$Infer.Session)["session"];
