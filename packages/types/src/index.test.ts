import { describe, it, expect } from "vitest";
import { batchStatusSchema, createBatchRequestSchema } from "./index";

describe("batchStatusSchema", () => {
  it("rejects an unknown status", () => {
    expect(batchStatusSchema.safeParse("RUNNING").success).toBe(false);
  });
});

describe("createBatchRequestSchema", () => {
  it("rejects an empty url list", () => {
    expect(createBatchRequestSchema.safeParse({ urls: [] }).success).toBe(false);
  });
});
