import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import { createCsrfGuard } from "./csrf";
import { ForbiddenError } from "./errors";

const guard = createCsrfGuard(["http://localhost:3000"]);

function req(method: string, origin?: string): FastifyRequest {
  return { method, headers: origin ? { origin } : {} } as unknown as FastifyRequest;
}

describe("createCsrfGuard", () => {
  it("allows an unsafe request from an allowed origin", async () => {
    await expect(guard(req("POST", "http://localhost:3000"))).resolves.toBeUndefined();
  });

  it("blocks an unsafe request from a foreign origin", async () => {
    await expect(guard(req("POST", "https://evil.example"))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks an unsafe request with no Origin header", async () => {
    await expect(guard(req("POST"))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows safe methods regardless of origin", async () => {
    await expect(guard(req("GET"))).resolves.toBeUndefined();
    await expect(guard(req("HEAD", "https://evil.example"))).resolves.toBeUndefined();
  });
});
