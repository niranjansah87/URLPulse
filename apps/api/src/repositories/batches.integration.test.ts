import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { createBatchRepository } from "./batches";

/**
 * Integration tests against a real PostgreSQL (docker-compose). They self-skip
 * when the database is unreachable so `pnpm test` stays green without infra;
 * run `docker compose up -d` to exercise them.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";

async function databaseReachable(): Promise<boolean> {
  try {
    const probe = postgres(DATABASE_URL, { max: 1, connect_timeout: 2 });
    await probe`select 1`;
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbUp = await databaseReachable();

describe.skipIf(!dbUp)("batch repository (integration)", () => {
  const sql = postgres(DATABASE_URL, { max: 4 });
  const repo = createBatchRepository(sql);

  beforeAll(async () => {
    const initSql = await readFile(
      join(dirname(fileURLToPath(import.meta.url)), "..", "migrations", "0001_init.sql"),
      "utf8",
    );
    await sql.unsafe(initSql);
    await sql`TRUNCATE urls, batches RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("persists a batch and one URL row per input inside a transaction", async () => {
    const { batch, urlIds } = await repo.createWithUrls(["https://a.com", "https://b.com"]);
    expect(batch.totalCount).toBe(2);
    expect(urlIds).toHaveLength(2);

    const detail = await repo.getById(batch.id);
    expect(detail?.urls.map((u) => u.status)).toEqual(["PENDING", "PENDING"]);
  });

  it("lists created batches newest first", async () => {
    const { batch } = await repo.createWithUrls(["https://list.com"]);
    const { items, total } = await repo.list({ page: 1, pageSize: 20 });
    expect(total).toBeGreaterThan(0);
    expect(items[0]?.id).toBe(batch.id);
  });

  it("returns pending URLs of non-terminal batches for reconciliation", async () => {
    await sql`TRUNCATE urls, batches RESTART IDENTITY CASCADE`;
    const { batch } = await repo.createWithUrls(["https://r1.com", "https://r2.com"]);
    const jobs = await repo.findReconcilableJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.batchId === batch.id)).toBe(true);
  });

  it("cancels a batch and its non-terminal urls, counting them", async () => {
    const { batch } = await repo.createWithUrls(["https://c1.com", "https://c2.com"]);
    const result = await repo.cancel(batch.id);
    const detail = await repo.getById(batch.id);
    expect(result).toBe("cancelled");
    expect(detail?.status).toBe("CANCELLED");
    expect(detail?.cancelledCount).toBe(2);
    expect(detail?.urls.every((u) => u.status === "CANCELLED")).toBe(true);
  });

  it("is a noop when cancelling an already-cancelled batch", async () => {
    const { batch } = await repo.createWithUrls(["https://c3.com"]);
    await repo.cancel(batch.id);
    const again = await repo.cancel(batch.id);
    expect(again).toBe("noop");
  });

  it("reports notfound for an unknown batch id", async () => {
    const result = await repo.cancel("00000000-0000-0000-0000-000000000000");
    expect(result).toBe("notfound");
  });

  it("rolls back the whole batch when the transaction throws", async () => {
    const countBatches = async (): Promise<number> => {
      const rows = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM batches`;
      return rows[0]?.count ?? 0;
    };
    const before = await countBatches();
    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO batches (status, total_count) VALUES ('PENDING', 1)`;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await countBatches()).toBe(before);
  });
});
