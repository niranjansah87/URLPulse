import type { FastifyInstance } from "fastify";
import { userSettingsSchema, type ApiSuccess, type UserSettings } from "@urlpulse/types";
import type { SettingsRepository } from "../repositories/settings";
import type { RequireAuth } from "../lib/require-auth";
import { requireUser } from "../lib/require-auth";
import type { CsrfGuard } from "../lib/csrf";
import { ValidationError } from "../lib/errors";

interface SettingsRoutesOptions {
  repo: SettingsRepository;
  requireAuth: RequireAuth;
  csrfGuard: CsrfGuard;
}

/**
 * User settings HTTP surface. Both routes are authenticated and scoped to the
 * session user's id (from the session, never the client). Settings are the
 * per-user monitoring defaults; PostgreSQL is authoritative.
 */
export async function registerSettingsRoutes(app: FastifyInstance, opts: SettingsRoutesOptions): Promise<void> {
  const { repo, requireAuth, csrfGuard } = opts;

  app.addHook("preHandler", csrfGuard);
  app.addHook("preHandler", requireAuth);

  // GET /settings — the session user's monitoring settings (defaults if unset).
  app.get("/settings", async (req) => {
    const userId = requireUser(req).id;
    const body: ApiSuccess<UserSettings> = { data: await repo.get(userId) };
    return body;
  });

  // POST /settings — replace the session user's settings with the full object.
  app.post("/settings", async (req) => {
    const userId = requireUser(req).id;
    const parsed = userSettingsSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid settings", parsed.error.issues);
    const body: ApiSuccess<UserSettings> = { data: await repo.upsert(userId, parsed.data) };
    return body;
  });
}
