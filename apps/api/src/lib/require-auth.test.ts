import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import { createRequireAuth, requireUser } from "./require-auth";
import { UnauthorizedError } from "./errors";
import type { AuthSession, AuthUser } from "./auth";

const user = { id: "u1", email: "u1@example.com", name: "One" } as unknown as AuthUser;
const session = { id: "s1", userId: "u1" } as unknown as AuthSession;

describe("createRequireAuth", () => {
  it("throws UnauthorizedError when there is no session", async () => {
    const requireAuth = createRequireAuth({ getSession: async () => null });
    const req = { headers: {} } as FastifyRequest;
    await expect(requireAuth(req)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("attaches the authenticated user to the request", async () => {
    const requireAuth = createRequireAuth({ getSession: async () => ({ user, session }) });
    const req = { headers: {} } as FastifyRequest;
    await requireAuth(req);
    expect(requireUser(req).id).toBe("u1");
  });
});

describe("requireUser", () => {
  it("throws when the request was never authenticated", () => {
    const req = { headers: {} } as FastifyRequest;
    expect(() => requireUser(req)).toThrow(UnauthorizedError);
  });
});
