import { describe, it, expect } from "vitest";
import { isBlockedIp, assertPublicUrl, BlockedTargetError } from "./ssrf";

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "fd00::1", // unique-local
    "fe80::1", // link-local
  ])("blocks the private/reserved address %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34"])("allows the public address %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("rejects a URL whose host is a literal private IP", async () => {
    await expect(assertPublicUrl(new URL("http://127.0.0.1/x"))).rejects.toBeInstanceOf(
      BlockedTargetError,
    );
  });

  it("rejects the cloud metadata endpoint", async () => {
    await expect(assertPublicUrl(new URL("http://169.254.169.254/latest/meta-data/"))).rejects.toThrow(
      /blocked address/i,
    );
  });
});
