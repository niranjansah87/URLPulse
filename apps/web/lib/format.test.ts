import { describe, expect, it } from "vitest";
import { formatDuration, formatRelativeTime, truncateMiddle } from "./format";

const NOW = new Date("2026-08-31T12:00:00Z");

describe("formatDuration", () => {
  it("renders sub-second values in milliseconds", () => {
    expect(formatDuration(183)).toBe("183 ms");
  });
  it("renders values of a second or more in seconds with two decimals", () => {
    expect(formatDuration(1420)).toBe("1.42 s");
  });
  it("renders a missing value as an em dash", () => {
    expect(formatDuration(null)).toBe("-");
  });
});

describe("formatRelativeTime", () => {
  it("says 'just now' within a second", () => {
    expect(formatRelativeTime("2026-08-31T11:59:59.500Z", NOW)).toBe("just now");
  });
  it("uses singular units", () => {
    expect(formatRelativeTime("2026-08-31T11:59:00Z", NOW)).toBe("1 minute ago");
  });
  it("rolls over to days", () => {
    expect(formatRelativeTime("2026-08-29T12:00:00Z", NOW)).toBe("2 days ago");
  });
  it("never reports a future timestamp as negative", () => {
    expect(formatRelativeTime("2026-08-31T12:05:00Z", NOW)).toBe("just now");
  });
});

describe("truncateMiddle", () => {
  it("keeps head and tail around an ellipsis", () => {
    expect(truncateMiddle("0123456789abcdefghij")).toBe("01234567…efghij");
  });
  it("returns short values untouched", () => {
    expect(truncateMiddle("short-id")).toBe("short-id");
  });
});
