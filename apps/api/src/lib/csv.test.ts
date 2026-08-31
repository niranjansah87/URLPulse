import { describe, it, expect } from "vitest";
import { parseCsvUrls } from "./csv";

describe("parseCsvUrls", () => {
  it("reads one URL per line from a headerless file", () => {
    const urls = parseCsvUrls("https://a.com\nhttps://b.com\n");
    expect(urls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("uses the 'url' column when a header row is present", () => {
    const urls = parseCsvUrls("name,url\nsite a,https://a.com\nsite b,https://b.com");
    expect(urls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("keeps commas inside quoted fields", () => {
    const urls = parseCsvUrls('url,note\n"https://a.com/?x=1,2","first, entry"');
    expect(urls).toEqual(["https://a.com/?x=1,2"]);
  });

  it("skips blank rows and trims whitespace", () => {
    const urls = parseCsvUrls("  https://a.com  \n\n\nhttps://b.com\n");
    expect(urls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("throws on an unterminated quoted field", () => {
    expect(() => parseCsvUrls('url\n"https://a.com')).toThrow(/unterminated/i);
  });
});
