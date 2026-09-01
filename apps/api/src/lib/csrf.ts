import type { FastifyRequest } from "fastify";
import { ForbiddenError } from "./errors";

/**
 * CSRF protection for cookie-authenticated, state-changing requests.
 *
 * Session auth uses cookies, and in production those cookies are SameSite=None
 * (the web app and API are different origins), so the browser will attach them to
 * cross-site requests. CORS restricts who can READ a response but does not stop
 * the request — and thus the state change — from happening. So every unsafe
 * (non-GET) batch request must prove it came from an allowed origin.
 *
 * The `Origin` header is set by the browser and cannot be forged by page script,
 * so requiring it to match the configured web origin blocks cross-site POSTs
 * while permitting the real web app. Safe methods (GET/HEAD/OPTIONS) are exempt;
 * cross-site reads are already blocked from being read by credentialed CORS.
 *
 * Non-browser clients (no Origin header) are rejected on unsafe methods — the
 * API's mutating surface is consumed by the browser web app; server-to-server
 * callers are out of scope for this project.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type CsrfGuard = (req: FastifyRequest) => Promise<void>;

export function createCsrfGuard(allowedOrigins: readonly string[]): CsrfGuard {
  const allowed = new Set(allowedOrigins);
  return async function csrfGuard(req: FastifyRequest): Promise<void> {
    if (SAFE_METHODS.has(req.method)) return;
    const origin = req.headers.origin;
    if (typeof origin !== "string" || !allowed.has(origin)) {
      throw new ForbiddenError("Cross-site request blocked");
    }
  };
}
