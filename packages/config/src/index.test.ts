import { describe, it, expect } from "vitest";
import { loadServerConfig } from "./index";

const validEnv = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/urlpulse",
  REDIS_URL: "redis://localhost:6379",
};

describe("loadServerConfig", () => {
  it("applies documented defaults for the rate limit and concurrency", () => {
    const config = loadServerConfig(validEnv);
    expect(config.RATE_LIMIT_RPS).toBe(10);
    expect(config.MAX_CONCURRENCY).toBe(5);
  });

  it("throws when a required variable is missing", () => {
    expect(() => loadServerConfig({ REDIS_URL: "redis://localhost:6379" })).toThrow(/DATABASE_URL/);
  });
});
