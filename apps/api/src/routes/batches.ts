import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  listBatchesQuerySchema,
  type ApiSuccess,
  type BatchDetail,
  type BatchSummary,
} from "@urlpulse/types";
import type { BatchService } from "../services/batches";
import { NotFoundError, NotImplementedError, ValidationError } from "../lib/errors";
import { parseCsvUrls } from "../lib/csv";

interface BatchRoutesOptions {
  service: BatchService;
}

/**
 * Batch HTTP surface. Endpoint names and the :batchId param follow
 * docs/03-backend/api.md exactly. Handlers are thin: parse transport, delegate
 * to the service, shape the response. Cancel / retry-failed / events remain 501
 * — they belong to later milestones and must not fake behavior.
 */
export async function registerBatchRoutes(
  app: FastifyInstance,
  opts: BatchRoutesOptions,
): Promise<void> {
  const { service } = opts;

  // POST /batches — JSON { urls: [...] } or a CSV multipart upload.
  app.post("/batches", async (req, reply) => {
    const urls = req.isMultipart() ? await readCsvUrls(req) : (req.body as { urls?: unknown })?.urls;
    const batch = await service.createBatch({ urls });
    reply.status(201);
    const body: ApiSuccess<BatchSummary> = { data: batch };
    return body;
  });

  // GET /batches — paginated list (cache is a later milestone; read live).
  app.get("/batches", async (req) => {
    const parsed = listBatchesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid list query", parsed.error.issues);
    }
    const { items, meta } = await service.listBatches(parsed.data);
    return { data: items, meta };
  });

  // GET /batches/:batchId — authoritative persisted state from PostgreSQL.
  app.get<{ Params: { batchId: string } }>("/batches/:batchId", async (req) => {
    const { batchId } = req.params;
    if (!isUuid(batchId)) throw new NotFoundError(`Batch ${batchId} not found`);
    const batch = await service.getBatch(batchId);
    const body: ApiSuccess<BatchDetail> = { data: batch };
    return body;
  });

  // POST /batches/:batchId/cancel — idempotent; returns authoritative state.
  app.post<{ Params: { batchId: string } }>("/batches/:batchId/cancel", async (req) => {
    const { batchId } = req.params;
    if (!isUuid(batchId)) throw new NotFoundError(`Batch ${batchId} not found`);
    const batch = await service.cancelBatch(batchId);
    const body: ApiSuccess<BatchDetail> = { data: batch };
    return body;
  });

  // --- Later milestones ---
  app.post("/batches/:batchId/retry-failed", async () => {
    throw new NotImplementedError("Retry failed");
  });
  app.get("/batches/:batchId/events", async () => {
    throw new NotImplementedError("Live updates (SSE)");
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
