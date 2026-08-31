import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { config } from "./env";
import { apiConfig } from "./env";
import { emailService } from "./email";

/** Password-reset token lifetime. Kept modest so a leaked link ages out quickly. */
const RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
/** Email-verification token lifetime (matches the "24 hours" reference copy). */
const VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Better Auth instance for URLPulse.
 *
 * Placement: mounted inside the Fastify API (not Next.js) so the API natively
 * owns identity and can enforce batch ownership. Sessions are PostgreSQL-backed
 * (Better Auth's default database strategy), which means they survive process
 * restarts and are valid across every horizontally scaled API instance — no
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
     * WEB_ORIGIN — never from a request Host header — so it cannot be poisoned
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
   * Email verification is wired to Better Auth (real token + expiry), but NOT
   * auto-sent on sign-up: URLPulse does not gate sign-in on verification
   * (requireEmailVerification is false), and a welcome email already goes out on
   * account creation. The verification email is available on demand via Better
   * Auth's send-verification-email flow. Set `sendOnSignUp: true` to auto-send.
   */
  emailVerification: {
    sendOnSignUp: false,
    expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
    async sendVerificationEmail({ user, url }) {
      // `url` is assembled by Better Auth from the configured baseURL (trusted),
      // never a request Host header.
      try {
        await emailService.sendVerification({
          to: user.email,
          name: user.name,
          verifyUrl: url,
          expiresMinutes: VERIFICATION_TOKEN_TTL_SECONDS / 60,
        });
      } catch (err) {
        console.error("[auth] verification email delivery failed", {
          userId: user.id,
          error: (err as Error).message,
        });
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Fires once, after the new user row commits. Send the welcome email
        // (best-effort: a delivery failure must never fail account creation).
        after: async (user) => {
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
    },
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
    // Account deletion is surfaced in the Settings "Danger Zone". Deleting a user
    // cascades to their sessions, accounts, and batches (FK ON DELETE CASCADE).
    deleteUser: { enabled: true },
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
