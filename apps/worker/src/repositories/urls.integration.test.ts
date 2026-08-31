import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { createUrlRepository } from "./urls";
import type { UrlCheckResult } from "../lib/http-checker";

/**
 * Integration tests against a real PostgreSQL. Self-skip when unreachable so
 * `pnpm test` stays green without infra; run `docker compose up -d` to exercise.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";

async function reachable(): Promise<boolean> {
  try {
    const p = postgres(DATABASE_URL, { max: 1, connect_timeout: 2 });
    await p`select 1`;
    await p.end();
    return true;
  } catch {
    return false;
  }
}

const dbUp = await reachable();

const ok: UrlCheckResult = {
  status: "SUCCESS",
  httpStatus: 200,
  responseTimeMs: 10,
  pageTitle: "t",
  errorCode: null,
  errorMessage: null,
  retryable: false,
};

describe.skipIf(!dbUp)("worker url repository (integration)", () => {
  const sql = postgres(DATABASE_URL, { max: 4 });
  const repo = createUrlRepository(sql);

  async function seed(total: number): Promise<{ batchId: string; urlIds: string[] }> {
    await sql`TRUNCATE urls, batches RESTART IDENTITY CASCADE`;
    const [b] = await sql<{ id: string }[]>`
      INSERT INTO batches (status, total_count) VALUES ('PENDING', ${total}) RETURNING id
    `;
    const urlIds: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const [u] = await sql<{ id: string }[]>`
        INSERT INTO urls (batch_id, url) VALUES (${b!.id}, ${`https://x${i}.com`}) RETURNING id
      `;
      urlIds.push(u!.id);
    }
    return { batchId: b!.id, urlIds };
  }

  beforeAll(async () => {
    const initSql = await readFile(
      join(process.cwd(), "..", "api", "src", "migrations", "0001_init.sql"),
      "utf8",
    );
    await sql.unsafe(initSql);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("claims a PENDING url once and rejects a second claim", async () => {
    const { urlIds } = await seed(1);
    const first = await repo.claim(urlIds[0]!);
    const second = await repo.claim(urlIds[0]!);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("does not double-count when the same result is persisted twice", async () => {
    const { batchId, urlIds } = await seed(1);
    await repo.claim(urlIds[0]!);
    const applied = await repo.persistResult(urlIds[0]!, ok);
    const dup = await repo.persistResult(urlIds[0]!, ok);
    expect(applied).toBe("applied");
    expect(dup).toBe("skipped");
    const [b] = await sql<{ completed_count: number }[]>`
      SELECT completed_count FROM batches WHERE id = ${batchId}
    `;
    expect(b!.completed_count).toBe(1);
  });

  it("transitions the batch to COMPLETED when all urls succeed", async () => {
    const { batchId, urlIds } = await seed(2);
    for (const id of urlIds) {
      await repo.claim(id);
      await repo.persistResult(id, ok);
    }
    const [b] = await sql<{ status: string }[]>`SELECT status FROM batches WHERE id = ${batchId}`;
    expect(b!.status).toBe("COMPLETED");
  });

  it("release-for-retry returns a claimed url to PENDING so it can be re-claimed", async () => {
    const { urlIds } = await seed(1);
    await repo.claim(urlIds[0]!);
    const released = await repo.releaseForRetry(urlIds[0]!);
    const reclaim = await repo.claim(urlIds[0]!);
    expect(released).toBe("applied");
    expect(reclaim).not.toBeNull();
  });

  it("transitions the batch to FAILED when a url fails", async () => {
    const { batchId, urlIds } = await seed(1);
    await repo.claim(urlIds[0]!);
    await repo.persistResult(urlIds[0]!, { ...ok, status: "FAILED", errorCode: "HTTP_500" });
    const [b] = await sql<{ status: string }[]>`SELECT status FROM batches WHERE id = ${batchId}`;
    expect(b!.status).toBe("FAILED");
  });

  it("does not overwrite a terminal url with a stale result", async () => {
    const { urlIds } = await seed(1);
    await repo.claim(urlIds[0]!);
    await repo.persistResult(urlIds[0]!, ok);
    const stale = await repo.persistResult(urlIds[0]!, { ...ok, httpStatus: 500, status: "FAILED" });
    expect(stale).toBe("skipped");
    const [u] = await sql<{ status: string; http_status: number }[]>`
      SELECT status, http_status FROM urls WHERE id = ${urlIds[0]!}
    `;
    expect(u!.status).toBe("SUCCESS");
    expect(u!.http_status).toBe(200);
  });

  it("recovers a url stuck in PROCESSING back to PENDING", async () => {
    const { urlIds } = await seed(1);
    await repo.claim(urlIds[0]!);
    await sql`UPDATE urls SET started_at = now() - interval '10 minutes' WHERE id = ${urlIds[0]!}`;
    const recovered = await repo.recoverStuck(60_000);
    expect(recovered).toBe(1);
    const [u] = await sql<{ status: string }[]>`SELECT status FROM urls WHERE id = ${urlIds[0]!}`;
    expect(u!.status).toBe("PENDING");
  });

  it("does not recover a freshly-claimed (in-flight) url", async () => {
    const { urlIds } = await seed(1);
    await repo.claim(urlIds[0]!);
    const recovered = await repo.recoverStuck(60_000);
    expect(recovered).toBe(0);
  });
});
