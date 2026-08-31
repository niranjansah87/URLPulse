import { describe, it, expect } from "vitest";
import type { Job } from "bullmq";
import type { UrlCheckJobData } from "@urlpulse/types";
import { urlCheckProcessor } from "./url-check";

describe("urlCheckProcessor", () => {
  it("rejects a job whose payload is not a valid url-check job", async () => {
    const badJob = { id: "1", data: {} } as unknown as Job<UrlCheckJobData>;
    await expect(urlCheckProcessor(badJob)).rejects.toThrow();
  });
});
