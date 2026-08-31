import { describe, it, expect, vi } from "vitest";
import type { Job } from "bullmq";
import type { UrlCheckJobData } from "@urlpulse/types";
import { createUrlCheckProcessor } from "./url-check";
import type { UrlRepository } from "../repositories/urls";
import type { CheckOptions, UrlCheckResult } from "../lib/http-checker";

const OPTS: CheckOptions = { timeoutMs: 1000, maxRedirects: 5, maxBodyBytes: 1000 };
const noopLog = { info: () => {}, warn: () => {} };

const success: UrlCheckResult = {
  status: "SUCCESS",
  httpStatus: 200,
  responseTimeMs: 12,
  pageTitle: "x",
  errorCode: null,
  errorMessage: null,
  retryable: false,
};

function job(data: unknown): Job<UrlCheckJobData> {
  return { id: "j1", data } as unknown as Job<UrlCheckJobData>;
}

describe("urlCheckProcessor", () => {
  it("rejects an invalid job payload before any work", async () => {
    const repo = { claim: vi.fn(), persistResult: vi.fn() } as unknown as UrlRepository;
    const proc = createUrlCheckProcessor({ repo, checkUrl: vi.fn(), checkOptions: OPTS, log: noopLog });
    await expect(proc(job({}))).rejects.toThrow();
    expect(repo.claim).not.toHaveBeenCalled();
  });

  it("does not perform the HTTP check when the URL cannot be claimed", async () => {
    const repo = {
      claim: vi.fn(async () => null),
      persistResult: vi.fn(),
    } as unknown as UrlRepository;
    const checkUrl = vi.fn();
    const proc = createUrlCheckProcessor({ repo, checkUrl, checkOptions: OPTS, log: noopLog });

    await proc(job({ batchId: "11111111-1111-1111-1111-111111111111", urlId: "22222222-2222-2222-2222-222222222222" }));

    expect(checkUrl).not.toHaveBeenCalled();
    expect(repo.persistResult).not.toHaveBeenCalled();
  });

  it("checks and persists exactly once when the claim is won", async () => {
    const repo = {
      claim: vi.fn(async () => ({ url: "https://a.com" })),
      persistResult: vi.fn(async () => "applied" as const),
    } as unknown as UrlRepository;
    const checkUrl = vi.fn(async () => success);
    const proc = createUrlCheckProcessor({ repo, checkUrl, checkOptions: OPTS, log: noopLog });

    await proc(job({ batchId: "11111111-1111-1111-1111-111111111111", urlId: "22222222-2222-2222-2222-222222222222" }));

    expect(checkUrl).toHaveBeenCalledWith("https://a.com", OPTS);
    expect(repo.persistResult).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222",
      success,
    );
  });
});
