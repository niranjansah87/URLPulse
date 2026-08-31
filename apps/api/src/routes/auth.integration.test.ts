import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import postgres from "postgres";
import type { BatchRepository } from "../repositories/batches";
import { emailService } from "../lib/email";

/**
 * End-to-end authentication against a real PostgreSQL and the real Better Auth
 * handler mounted on Fastify. No Redis is required: an in-memory service and
 * event bus are injected, so buildServer does not open BullMQ/pub-sub. Self-skips
 * when the database (with auth tables migrated) is unreachable.
 *
 * Run: docker compose up -d && pnpm db:migrate && pnpm --filter @urlpulse/api test
 */
process.env.DATABASE_URL ??= "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";
process.env.REDIS_URL ??= "redis://localhost:6379";

async function authTablesReady(): Promise<boolean> {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 2 });
    await sql`SELECT 1 FROM "user" LIMIT 1`;
    await sql.end();
    return true;
  } catch {
    return false;
  }
}

const ready = await authTablesReady();

const { buildServer } = await import("../server");
const { createBatchService } = await import("../services/batches");

function setCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((c) => String(c).split(";")[0]).join("; ");
}

describe.skipIf(!ready)("authentication flow (integration)", () => {
  let app: ReturnType<typeof buildServer>;
  const email = `flow_${Date.now()}@example.com`;
  const password = "correct horse battery";

  beforeAll(async () => {
    // A fake service so no Redis is opened; requireAuth is NOT overridden, so the
    // real Better Auth handler and session resolution are exercised.
    const listed: string[] = [];
    const repo = {
      list: async () => ({ items: [], total: 0 }),
      createWithUrls: async (userId: string) => {
        listed.push(userId);
        return { batch: { id: "b", status: "PENDING", totalCount: 0, completedCount: 0, failedCount: 0, cancelledCount: 0, createdAt: new Date().toISOString() }, urlIds: [] };
      },
      getById: async () => null,
      cancel: async () => "notfound" as const,
      retryFailed: async () => "notfound" as const,
      findReconcilableJobs: async () => [],
      recoverStuck: async () => 0,
    } as unknown as BatchRepository;
    const service = createBatchService({ repo, enqueue: async () => {}, log: { info: () => {}, warn: () => {} } });
    const eventBus = { start: async () => {}, addClient: () => () => {}, clientCount: () => 0 };
    app = buildServer({ service, eventBus });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("signs up a new user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password, name: "Flow User" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password, name: "Flow User" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects sign-in with a wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "wrong-password" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("signs in, exposes the session, and authorizes an API call; sign-out ends it", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password },
    });
    expect(signIn.statusCode).toBe(200);
    const cookie = setCookie(signIn as unknown as { headers: Record<string, unknown> });
    expect(cookie).toContain("session");

    const session = await app.inject({ method: "GET", url: "/api/auth/get-session", headers: { cookie } });
    expect(session.statusCode).toBe(200);
    expect(session.json().user.email).toBe(email);

    // Authenticated API access succeeds with the session cookie.
    const list = await app.inject({ method: "GET", url: "/api/batches", headers: { cookie } });
    expect(list.statusCode).toBe(200);

    // Unauthenticated API access is rejected.
    const denied = await app.inject({ method: "GET", url: "/api/batches" });
    expect(denied.statusCode).toBe(401);

    const signOut = await app.inject({ method: "POST", url: "/api/auth/sign-out", headers: { cookie } });
    expect(signOut.statusCode).toBe(200);
  });
});

describe.skipIf(!ready)("password reset flow (integration)", () => {
  let app: ReturnType<typeof buildServer>;
  const email = `reset_${Date.now()}@example.com`;
  const oldPassword = "old-password-123";
  const newPassword = "brand-new-password-456";

  const makeApp = (): ReturnType<typeof buildServer> => {
    const repo = {
      list: async () => ({ items: [], total: 0 }),
      getById: async () => null,
      cancel: async () => "notfound" as const,
      retryFailed: async () => "notfound" as const,
      findReconcilableJobs: async () => [],
      recoverStuck: async () => 0,
    } as unknown as BatchRepository;
    const service = createBatchService({ repo, enqueue: async () => {}, log: { info: () => {}, warn: () => {} } });
    const eventBus = { start: async () => {}, addClient: () => () => {}, clientCount: () => 0 };
    return buildServer({ service, eventBus });
  };

  beforeAll(async () => {
    app = makeApp();
    await app.ready();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: oldPassword, name: "Reset User" },
    });
    expect(res.statusCode).toBe(200);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it("requesting a reset for a KNOWN email sends the email and returns a generic 200", async () => {
    const spy = vi.spyOn(emailService, "sendPasswordReset").mockResolvedValue();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-password-reset",
      payload: { email, redirectTo: "/reset-password" },
    });
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0]![0];
    expect(arg.to).toBe(email);
    // Reset URL points at the trusted WEB_ORIGIN reset page and carries a token.
    const url = new URL(arg.resetUrl);
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("token")).toBeTruthy();
    spy.mockRestore();
  });

  it("requesting a reset for an UNKNOWN email returns the same generic 200 and sends nothing", async () => {
    const spy = vi.spyOn(emailService, "sendPasswordReset").mockResolvedValue();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-password-reset",
      payload: { email: `nobody_${Date.now()}@example.com`, redirectTo: "/reset-password" },
    });
    expect(res.statusCode).toBe(200); // indistinguishable from the known-email case
    expect(spy).not.toHaveBeenCalled(); // no account => no email
    spy.mockRestore();
  });

  it("resets the password with a valid token; old password stops working, new one works", async () => {
    const spy = vi.spyOn(emailService, "sendPasswordReset").mockResolvedValue();
    await app.inject({
      method: "POST",
      url: "/api/auth/request-password-reset",
      payload: { email, redirectTo: "/reset-password" },
    });
    const token = new URL(spy.mock.calls[0]![0].resetUrl).searchParams.get("token")!;
    spy.mockRestore();

    const reset = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { newPassword, token },
    });
    expect(reset.statusCode).toBe(200);

    const oldTry = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: oldPassword },
    });
    expect(oldTry.statusCode).toBeGreaterThanOrEqual(400);

    const newTry = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: newPassword },
    });
    expect(newTry.statusCode).toBe(200);

    // The token is single-use: replaying it fails.
    const replay = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { newPassword: "yet-another-password-789", token },
    });
    expect(replay.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects an invalid reset token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { newPassword, token: "not-a-real-token" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
