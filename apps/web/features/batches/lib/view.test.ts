import { describe, expect, it } from "vitest";
import type { BatchDetail, UrlResult } from "@urlpulse/types";
import { toBatchDetailData, toBatchRow } from "./view";

function url(over: Partial<UrlResult>): UrlResult {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    url: "https://example.com",
    status: "PENDING",
    httpStatus: null,
    responseTimeMs: null,
    pageTitle: null,
    error: null,
    startedAt: null,
    completedAt: null,
    ...over,
  };
}

const DETAIL: BatchDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PROCESSING",
  totalCount: 4,
  completedCount: 1,
  failedCount: 1,
  cancelledCount: 0,
  createdAt: "2026-08-31T10:00:00.000Z",
  startedAt: "2026-08-31T10:00:01.000Z",
  completedAt: null,
  updatedAt: "2026-08-31T10:00:05.000Z",
  urls: [
    url({ id: "a", status: "SUCCESS", httpStatus: 200, responseTimeMs: 120, completedAt: "2026-08-31T10:00:02.000Z" }),
    url({ id: "b", status: "FAILED", httpStatus: 503, error: "Service Unavailable", completedAt: "2026-08-31T10:00:03.000Z" }),
    url({ id: "c", status: "PROCESSING", startedAt: "2026-08-31T10:00:04.000Z" }),
    url({ id: "d" }),
  ],
};

describe("toBatchRow", () => {
  it("derives progress from every terminal count, not just successes", () => {
    expect(toBatchRow(DETAIL).progressPercent).toBe(50);
  });
  it("does not divide by zero for an empty batch", () => {
    expect(toBatchRow({ ...DETAIL, totalCount: 0 }).progressPercent).toBe(0);
  });
});

describe("toBatchDetailData", () => {
  it("passes persisted timestamps through instead of deriving them from createdAt", () => {
    const { batch } = toBatchDetailData(DETAIL);
    expect([batch.startedAt, batch.completedAt, batch.updatedAt]).toEqual([DETAIL.startedAt, null, DETAIL.updatedAt]);
  });
  it("counts in-flight and queued URLs from the rows", () => {
    const { batch } = toBatchDetailData(DETAIL);
    expect([batch.statistics.inProgress, batch.statistics.queued]).toEqual([1, 1]);
  });
  it("projects activity with the moment each URL was checked", () => {
    const { activity } = toBatchDetailData(DETAIL);
    expect(activity.map((e) => [e.kind, e.at])).toEqual([
      ["checked", "2026-08-31T10:00:02.000Z"],
      ["failed", "2026-08-31T10:00:03.000Z"],
      ["checking", "2026-08-31T10:00:04.000Z"],
    ]);
  });
});
