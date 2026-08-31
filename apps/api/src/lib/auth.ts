import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { config } from "./env";
import { apiConfig } from "./env";

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
