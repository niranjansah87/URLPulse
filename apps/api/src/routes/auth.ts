import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "../lib/auth";

/**
 * Mount Better Auth's request handler at /api/auth/*. Better Auth speaks the Web
 * Fetch API (Request/Response); this adapter converts Fastify's Node request into
 * a Request, runs the handler, and copies the Response back - including every
 * Set-Cookie header (getSetCookie preserves multiples, which a naive header copy
 * would collapse). This is the ONLY place auth HTTP is handled; application
 * routes read the resulting session via the requireAuth boundary.
 */
export function registerAuthRoutes(app: FastifyInstance, auth: Auth): void {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    // Better Auth reads/writes the raw body itself; let it own parsing.
    async handler(req, reply) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const headers = fromNodeHeaders(req.headers);
      const request = new Request(url.toString(), {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body),
      });

      const response = await auth.handler(request);

      reply.status(response.status);
      const setCookies = response.headers.getSetCookie();
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
      });
      if (setCookies.length > 0) reply.header("set-cookie", setCookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
