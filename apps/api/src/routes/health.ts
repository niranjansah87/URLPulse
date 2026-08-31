import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { ApiSuccess } from "@urlpulse/types";
import type { Db } from "../lib/db";

interface HealthDeps {
  db: Db;
  redis: Redis;
}

export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.get("/health", async (): Promise<ApiSuccess<{ status: string; uptime: number }>> => {
    return { data: { status: "ok", uptime: process.uptime() } };
  });

  app.get("/health/ready", async (_req, reply) => {
    const checks = { db: false, redis: false };
    try {
      await deps.db`select 1`;
      checks.db = true;
    } catch {
      checks.db = false;
    }
    try {
      checks.redis = (await deps.redis.ping()) === "PONG";
    } catch {
      checks.redis = false;
    }
    const ready = checks.db && checks.redis;
    reply.status(ready ? 200 : 503);
    const body: ApiSuccess<{ ready: boolean; checks: typeof checks }> = {
      data: { ready, checks },
    };
    return body;
  });
}
