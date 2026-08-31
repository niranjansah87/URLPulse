import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  listBatchesQuerySchema,
  SSE_EVENT_BATCH_UPDATED,
  type ApiSuccess,
  type BatchDetail,
  type BatchSummary,
} from "@urlpulse/types";
import type { BatchService } from "../services/batches";
import type { EventBus } from "../lib/events";
import type { RequireAuth } from "../lib/require-auth";
import { requireUser } from "../lib/require-auth";
import { NotFoundError, ValidationError } from "../lib/errors";
import { parseCsvUrls } from "../lib/csv";

interface BatchRoutesOptions {
  service: BatchService;
  eventBus: EventBus;
  requireAuth: RequireAuth;
}

const SSE_HEARTBEAT_MS = 15_000;

/**
 * Batch HTTP surface. Endpoint names and the :batchId param follow
 * docs/03-backend/api.md exactly. Every route is authenticated (the plugin-wide
 * preHandler below) and every operation is scoped to the session user's id,
 * which comes from the session — never from the client. Ownership is enforced in
 * the service/repository: a batch owned by another user is indistinguishable
 * from one that does not exist (404), so ownership is never leaked.
 */
export async function registerBatchRoutes(
  app: FastifyInstance,
  opts: BatchRoutesOptions,
): Promise<void> {
  const { service, eventBus, requireAuth } = opts;

  // Authenticate every batch route. Runs before each handler; on failure it
  // throws 401 (via the error handler) before any batch logic executes.
  app.addHook("preHandler", requireAuth);

  // POST /batches — JSON { urls: [...] } or a CSV multipart upload.
  app.post("/batches", async (req, reply) => {
    const userId = requireUser(req).id;
    const urls = req.isMultipart() ? await readCsvUrls(req) : (req.body as { urls?: unknown })?.urls;
    const batch = await service.createBatch(userId, { urls });
    reply.status(201);
    const body: ApiSuccess<BatchSummary> = { data: batch };
    return body;
  });

  // GET /batches — the session user's batches only, paginated.
  app.get("/batches", async (req) => {
    const userId = requireUser(req).id;
    const parsed = listBatchesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid list query", parsed.error.issues);
    }
    const { items, meta } = await service.listBatches(userId, parsed.data);
    return { data: items, meta };
  });

  // GET /batches/:batchId — authoritative persisted state from PostgreSQL.
  app.get<{ Params: { batchId: string } }>("/batches/:batchId", async (req) => {
    const userId = requireUser(req).id;
    const { batchId } = req.params;
    if (!isUuid(batchId)) throw new NotFoundError(`Batch ${batchId} not found`);
    const batch = await service.getBatch(userId, batchId);
    const body: ApiSuccess<BatchDetail> = { data: batch };
    return body;
  });

  // POST /batches/:batchId/cancel — idempotent; returns authoritative state.
  app.post<{ Params: { batchId: string } }>("/batches/:batchId/cancel", async (req) => {
    const userId = requireUser(req).id;
    const { batchId } = req.params;
    if (!isUuid(batchId)) throw new NotFoundError(`Batch ${batchId} not found`);
    const batch = await service.cancelBatch(userId, batchId);
    const body: ApiSuccess<BatchDetail> = { data: batch };
    return body;
  });

  // POST /batches/:batchId/retry-failed — resets only FAILED URLs and requeues.
  app.post<{ Params: { batchId: string } }>("/batches/:batchId/retry-failed", async (req) => {
    const userId = requireUser(req).id;
    const { batchId } = req.params;
    if (!isUuid(batchId)) throw new NotFoundError(`Batch ${batchId} not found`);
    const batch = await service.retryFailed(userId, batchId);
    const body: ApiSuccess<BatchDetail> = { data: batch };
    return body;
  });

  // GET /batches/:batchId/events — SSE stream of batch.updated notifications.
  // Notifications only; the client refetches authoritative state (ADR-005).
  app.get<{ Params: { batchId: string } }>("/batches/:batchId/events", async (req, reply) => {
    const userId = requireUser(req).id;
    const { batchId } = req.params;
    if (!isUuid(batchId)) throw new NotFoundError(`Batch ${batchId} not found`);
    // Only subscribe a client to a batch it owns; throws 404 otherwise so a
    // subscriber can never learn that another user's batch exists.
    await service.getBatch(userId, batchId);

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    raw.write(": connected\n\n");

    const remove = eventBus.addClient(batchId, (payload) => {
      raw.write(`event: ${SSE_EVENT_BATCH_UPDATED}\ndata: ${JSON.stringify(payload)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      try {
        raw.write(": hb\n\n");
      } catch {
        // stream gone; close handler will clean up
      }
    }, SSE_HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      remove(); // deregister so we never leak client references
    };
    req.raw.on("close", cleanup);
    req.raw.on("error", cleanup);
  });
}

async function readCsvUrls(req: FastifyRequest): Promise<string[]> {
  const file = await req.file();
  if (!file) throw new ValidationError("Expected a CSV file upload");
  const buffer = await file.toBuffer();
  return parseCsvUrls(buffer.toString("utf8"));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
