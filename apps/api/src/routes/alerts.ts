import type { FastifyInstance } from "fastify";
import { listAlertsQuerySchema, type Alert, type AlertCounts, type ApiSuccess } from "@urlpulse/types";
import type { AlertService } from "../services/alerts";
import type { RequireAuth } from "../lib/require-auth";
import { requireUser } from "../lib/require-auth";
import type { CsrfGuard } from "../lib/csrf";
import { NotFoundError, ValidationError } from "../lib/errors";

interface AlertRoutesOptions {
  service: AlertService;
  requireAuth: RequireAuth;
  csrfGuard: CsrfGuard;
}

/**
 * Alert HTTP surface. Every route is authenticated and scoped to the session
 * user's id (from the session, never the client). An alert owned by another user
 * is indistinguishable from one that does not exist (404).
 */
export async function registerAlertRoutes(app: FastifyInstance, opts: AlertRoutesOptions): Promise<void> {
  const { service, requireAuth, csrfGuard } = opts;

  app.addHook("preHandler", csrfGuard);
  app.addHook("preHandler", requireAuth);

  // GET /alerts — the session user's alerts, filterable and paginated.
  app.get("/alerts", async (req) => {
    const userId = requireUser(req).id;
    const parsed = listAlertsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid alert query", parsed.error.issues);
    const { items, meta } = await service.listAlerts(userId, parsed.data);
    return { data: items, meta };
  });

  // GET /alerts/counts — dashboard tiles + unread bell badge.
  app.get("/alerts/counts", async (req) => {
    const userId = requireUser(req).id;
    const body: ApiSuccess<AlertCounts> = { data: await service.getCounts(userId) };
    return body;
  });

  // POST /alerts/:id/acknowledge
  app.post<{ Params: { id: string } }>("/alerts/:id/acknowledge", async (req) => {
    const userId = requireUser(req).id;
    const { id } = req.params;
    if (!isUuid(id)) throw new NotFoundError(`Alert ${id} not found`);
    const body: ApiSuccess<Alert> = { data: await service.acknowledge(userId, id) };
    return body;
  });

  // POST /alerts/:id/resolve
  app.post<{ Params: { id: string } }>("/alerts/:id/resolve", async (req) => {
    const userId = requireUser(req).id;
    const { id } = req.params;
    if (!isUuid(id)) throw new NotFoundError(`Alert ${id} not found`);
    const body: ApiSuccess<Alert> = { data: await service.resolve(userId, id) };
    return body;
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
