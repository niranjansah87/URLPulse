import { fileURLToPath } from "node:url";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import type { ApiError } from "@urlpulse/types";
import { config } from "./lib/env";
import { createDb } from "./lib/db";
import { createRedis } from "./lib/redis";
import { registerHealthRoutes } from "./routes/health";
import { registerBatchRoutes } from "./routes/batches";

export function buildServer() {
  const app = Fastify({ logger: true });
  const db = createDb();
  const redis = createRedis();

  app.register(cors, { origin: true });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error(err);
    const status = typeof err.statusCode === "number" && err.statusCode >= 400 ? err.statusCode : 500;
    const body: ApiError = {
      error: {
        code: status === 500 ? "INTERNAL_ERROR" : (err.code ?? "ERROR"),
        message: status === 500 ? "Internal server error" : err.message,
      },
    };
    reply.status(status).send(body);
  });

  app.setNotFoundHandler((_req, reply) => {
    const body: ApiError = { error: { code: "NOT_FOUND", message: "Route not found" } };
    reply.status(404).send(body);
  });

  registerHealthRoutes(app, { db, redis });
  app.register(registerBatchRoutes, { prefix: "/api" });

  app.addHook("onClose", async () => {
    await redis.quit().catch(() => undefined);
    await db.end({ timeout: 5 }).catch(() => undefined);
  });

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const app = buildServer();
  const shutdown = () => {
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  app.listen({ port: config.API_PORT, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
