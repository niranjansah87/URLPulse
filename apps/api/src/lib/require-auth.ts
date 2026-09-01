import type { FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthSession, AuthUser } from "./auth";
import { UnauthorizedError } from "./errors";

/**
 * The single Fastify authentication boundary. Every protected route runs
 * `requireAuth` as a preHandler; it resolves the Better Auth session from the
 * request cookies and attaches the authenticated user to the request. Session
 * lookups are database-backed, so this works unchanged across restarts and
 * across multiple API instances (no in-memory session state).
 *
 * The resolver is injected (rather than importing the auth singleton directly)
 * so routes stay unit-testable without a database or real cookies.
 */
export interface SessionApi {
  getSession(args: { headers: Headers }): Promise<{ user: AuthUser; session: AuthSession } | null>;
}

export type RequireAuth = (req: FastifyRequest) => Promise<void>;

export function createRequireAuth(api: SessionApi): RequireAuth {
  return async function requireAuth(req: FastifyRequest): Promise<void> {
    const session = await api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedError();
    req.user = session.user;
    req.session = session.session;
  };
}

/**
 * Read the authenticated user off a request inside a protected handler. Throws
 * (401) if called on a request that did not pass `requireAuth` - a guard against
 * wiring a handler without its preHandler, never expected at runtime.
 */
export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    session?: AuthSession;
  }
}
