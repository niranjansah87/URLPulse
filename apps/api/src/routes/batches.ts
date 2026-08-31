import type { FastifyInstance } from "fastify";
import { createBatchRequestSchema, type ApiError } from "@urlpulse/types";

/**
 * Batch route surface. Endpoint names and the `:batchId` param follow
 * docs/03-backend/api.md exactly. Handlers are scaffolded placeholders that
 * return 501 until the processing logic lands in the next phase; POST /batches
 * already wires runtime validation to show where it belongs.
 */
const notImplemented = (message: string): ApiError => ({
  error: { code: "NOT_IMPLEMENTED", message: `${message} is not implemented yet` },
});

export async function registerBatchRoutes(app: FastifyInstance): Promise<void> {
  app.post("/batches", async (req, reply) => {
    const parsed = createBatchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.status(400);
      const body: ApiError = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.issues,
        },
      };
      return body;
    }
    reply.status(501);
    return notImplemented("Batch creation");
  });

  app.get("/batches", async (_req, reply) => {
    reply.status(501);
    return notImplemented("Batch listing");
  });

  app.get("/batches/:batchId", async (_req, reply) => {
    reply.status(501);
    return notImplemented("Batch detail");
  });

  app.post("/batches/:batchId/cancel", async (_req, reply) => {
    reply.status(501);
    return notImplemented("Batch cancellation");
  });

  app.post("/batches/:batchId/retry-failed", async (_req, reply) => {
    reply.status(501);
    return notImplemented("Retry failed");
  });

  app.get("/batches/:batchId/events", async (_req, reply) => {
    reply.status(501);
    return notImplemented("Live updates (SSE)");
  });
}
