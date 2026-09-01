import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { createBatchRepository } from "./batches";

/**
 * Integration tests against a real PostgreSQL (docker-compose). They self-skip
 * when the database is unreachable so `pnpm test` stays green without infra;
 * run `docker compose up -d && pnpm db:migrate` to exercise them.
 *
 * Ownership is central here: every batch belongs to a user, and a second user
 * must never see or mutate the first user's batches.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";

const USER_A = "user-a";
const USER_B = "user-b";

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
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

describe.skipIf(!dbUp)("batch repository (integration)", () => {
  const sql = postgres(DATABASE_URL, { max: 4 });
  const repo = createBatchRepository(sql);

  beforeAll(async () => {
    for (const file of ["0001_init.sql", "0002_better_auth.sql", "0003_batches_user_id.sql"]) {
      await sql.unsafe(await readFile(join(migrationsDir, file), "utf8"));
    }
    await sql`TRUNCATE urls, batches RESTART IDENTITY CASCADE`;
    // Seed the two owners. Better Auth normally inserts these; here we insert the
    // minimum a batch's FK needs.
    const seedUsers: Array<[string, string]> = [
      [USER_A, "a@example.com"],
      [USER_B, "b@example.com"],
    ];
    for (const [id, email] of seedUsers) {
      await sql`
        INSERT INTO "user" ("id", "name", "email")
        VALUES (${id}, ${id}, ${email})
        ON CONFLICT ("id") DO NOTHING
      `;
    }
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("persists a batch and one URL row per input inside a transaction", async () => {
    const { batch, urlIds } = await repo.createWithUrls(USER_A, ["https://a.com", "https://b.com"]);
    expect(batch.totalCount).toBe(2);
    expect(urlIds).toHaveLength(2);

    const detail = await repo.getById(USER_A, batch.id);
    expect(detail?.urls.map((u) => u.status)).toEqual(["PENDING", "PENDING"]);
  });

  it("lists created batches newest first", async () => {
    const { batch } = await repo.createWithUrls(USER_A, ["https://list.com"]);
    const { items, total } = await repo.list(USER_A, { page: 1, pageSize: 20 });
    expect(total).toBeGreaterThan(0);
    expect(items[0]?.id).toBe(batch.id);
  });

  it("returns pending URLs of non-terminal batches for reconciliation", async () => {
    await sql`TRUNCATE urls, batches RESTART IDENTITY CASCADE`;
    const { batch } = await repo.createWithUrls(USER_A, ["https://r1.com", "https://r2.com"]);
    const jobs = await repo.findReconcilableJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.batchId === batch.id)).toBe(true);
  });

  it("cancels a batch and its non-terminal urls, counting them", async () => {
    const { batch } = await repo.createWithUrls(USER_A, ["https://c1.com", "https://c2.com"]);
    const result = await repo.cancel(USER_A, batch.id);
    const detail = await repo.getById(USER_A, batch.id);
    expect(result).toBe("cancelled");
    expect(detail?.status).toBe("CANCELLED");
    expect(detail?.cancelledCount).toBe(2);
    expect(detail?.urls.every((u) => u.status === "CANCELLED")).toBe(true);
  });

  it("is a noop when cancelling an already-cancelled batch", async () => {
    const { batch } = await repo.createWithUrls(USER_A, ["https://c3.com"]);
    await repo.cancel(USER_A, batch.id);
    const again = await repo.cancel(USER_A, batch.id);
    expect(again).toBe("noop");
  });

  it("reports notfound for an unknown batch id", async () => {
    const result = await repo.cancel(USER_A, "00000000-0000-0000-0000-000000000000");
    expect(result).toBe("notfound");
  });

  it("retry-failed resets only FAILED urls and reactivates the batch", async () => {
    const { batch, urlIds } = await repo.createWithUrls(USER_A, ["https://r1.com", "https://r2.com"]);
    // Simulate one SUCCESS and one FAILED terminal batch.
    await sql`UPDATE urls SET status='SUCCESS' WHERE id=${urlIds[0]!}`;
    await sql`UPDATE urls SET status='FAILED', attempt_count=4 WHERE id=${urlIds[1]!}`;
    await sql`UPDATE batches SET status='FAILED', completed_count=1, failed_count=1 WHERE id=${batch.id}`;

    const result = await repo.retryFailed(USER_A, batch.id);
    expect(result).toEqual({ claimed: [urlIds[1]!] });

    const detail = await repo.getById(USER_A, batch.id);
    expect(detail?.status).toBe("PROCESSING");
    expect(detail?.failedCount).toBe(0);
    const failedUrl = detail?.urls.find((u) => u.id === urlIds[1]);
    expect(failedUrl?.status).toBe("PENDING");
    const okUrl = detail?.urls.find((u) => u.id === urlIds[0]);
    expect(okUrl?.status).toBe("SUCCESS");
  });

  it("retry-failed is idempotent under a second call (claims each row once)", async () => {
    const { batch, urlIds } = await repo.createWithUrls(USER_A, ["https://r3.com"]);
    await sql`UPDATE urls SET status='FAILED' WHERE id=${urlIds[0]!}`;
    await sql`UPDATE batches SET status='FAILED', failed_count=1 WHERE id=${batch.id}`;
    const first = await repo.retryFailed(USER_A, batch.id);
    const second = await repo.retryFailed(USER_A, batch.id);
    expect(first).toEqual({ claimed: [urlIds[0]!] });
    expect(second).toEqual({ claimed: [] });
  });

  it("retry-failed on a cancelled batch is rejected", async () => {
    const { batch } = await repo.createWithUrls(USER_A, ["https://r4.com"]);
    await repo.cancel(USER_A, batch.id);
    expect(await repo.retryFailed(USER_A, batch.id)).toBe("cancelled");
  });

  it("does not return another user's batch by id", async () => {
    const { batch } = await repo.createWithUrls(USER_A, ["https://owned.com"]);
    expect(await repo.getById(USER_B, batch.id)).toBeNull();
  });

  it("excludes another user's batches from the list", async () => {
    await sql`TRUNCATE urls, batches RESTART IDENTITY CASCADE`;
    const { batch } = await repo.createWithUrls(USER_A, ["https://onlya.com"]);
    const listB = await repo.list(USER_B, { page: 1, pageSize: 20 });
    expect(listB.items).toHaveLength(0);
    const listA = await repo.list(USER_A, { page: 1, pageSize: 20 });
    expect(listA.items.map((b) => b.id)).toContain(batch.id);
  });

  it("does not let another user cancel a batch (reports notfound)", async () => {
    const { batch } = await repo.createWithUrls(USER_A, ["https://c.com"]);
    expect(await repo.cancel(USER_B, batch.id)).toBe("notfound");
    // The batch is untouched for its real owner.
    expect((await repo.getById(USER_A, batch.id))?.status).toBe("PENDING");
  });

  it("does not let another user retry a batch's failed urls (reports notfound)", async () => {
    const { batch, urlIds } = await repo.createWithUrls(USER_A, ["https://f.com"]);
    await sql`UPDATE urls SET status='FAILED' WHERE id=${urlIds[0]!}`;
    await sql`UPDATE batches SET status='FAILED', failed_count=1 WHERE id=${batch.id}`;
    expect(await repo.retryFailed(USER_B, batch.id)).toBe("notfound");
    // Still FAILED for the owner - the foreign user's call changed nothing.
    expect((await repo.getById(USER_A, batch.id))?.failedCount).toBe(1);
  });

  it("rolls back the whole batch when the transaction throws", async () => {
    const countBatches = async (): Promise<number> => {
      const rows = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM batches`;
      return rows[0]?.count ?? 0;
    };
    const before = await countBatches();
    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO batches (status, total_count, user_id) VALUES ('PENDING', 1, ${USER_A})`;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await countBatches()).toBe(before);
  });
});
