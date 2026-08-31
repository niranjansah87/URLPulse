import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { ApiSuccess } from "@urlpulse/types";
import type { Db } from "../lib/db";

interface HealthDeps {
  db: Db;
  redis: Redis;
}

const READINESS_TIMEOUT_MS = 2_000;

/** Resolve false if the probe rejects or does not settle within the timeout. */
async function probe(check: () => Promise<boolean>): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), READINESS_TIMEOUT_MS);
  });
  try {
    return await Promise.race([check().catch(() => false), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  // Liveness: the process is running. Deliberately touches no external
  // dependency, so a DB/Redis outage never fails liveness or restarts the pod.
  app.get("/health", async (): Promise<ApiSuccess<{ status: string; uptime: number }>> => {
    return { data: { status: "ok", uptime: process.uptime() } };
  });

  // Readiness: can this instance serve requests? Each dependency probe is bounded
  // so a hung dependency cannot hang the health endpoint itself.
  app.get("/health/ready", async (_req, reply) => {
    const [db, redis] = await Promise.all([
      probe(async () => {
        await deps.db`select 1`;
        return true;
      }),
      probe(async () => (await deps.redis.ping()) === "PONG"),
    ]);
    const ready = db && redis;
    reply.status(ready ? 200 : 503);
    const body: ApiSuccess<{ ready: boolean; checks: { db: boolean; redis: boolean } }> = {
      data: { ready, checks: { db, redis } },
    };
    return body;
  });
}
