import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF protection for outbound URL checks. A public-looking hostname can resolve
 * to a private address, so the hostname is resolved and every resolved IP is
 * checked against loopback / private / link-local / cloud-metadata ranges. This
 * runs for the initial URL and every redirect target.
 *
 * FIXME(niranjansah87): this is a verbatim copy of apps/worker/src/lib/ssrf.ts.
 * Extract both into a shared @urlpulse/net-guard package so the guard has a
 * single source of truth (tracked as the demo-check follow-up).
 *
 * Residual risk: a full DNS-rebinding defense would pin the validated IP for the
 * actual socket connection; with fetch that is not straightforward, so a narrow
 * TOCTOU window remains between validation and connect. Acceptable for this
 * project's scope and documented here rather than silently ignored.
 */
export class BlockedTargetError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BlockedTargetError";
  }
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedV4(ip);
  if (version === 6) return isBlockedV6(ip.toLowerCase());
  return true; // unparseable → block
}

function isBlockedV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a = 0, b = 0] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 special-use
  if (a >= 224) return true; // multicast / reserved / broadcast
  return false;
}

function isBlockedV6(ip: string): boolean {
  if (ip === "::1" || ip === "::") return true; // loopback / unspecified
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (mapped?.[1]) return isBlockedV4(mapped[1]); // IPv4-mapped
  const head = ip.split(":")[0] ?? "";
  if (/^f[cd]/.test(head)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(head)) return true; // fe80::/10 link-local
  return false;
}

/** Resolve `url`'s host and throw BlockedTargetError if any resolved IP is private. */
export async function assertPublicUrl(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  let ips: string[];
  if (isIP(host)) {
    ips = [host];
  } else {
    const results = await lookup(host, { all: true }).catch(() => []);
    if (results.length === 0) {
      throw new BlockedTargetError("DNS_ERROR", `Cannot resolve host ${host}`);
    }
    ips = results.map((r) => r.address);
  }
  for (const ip of ips) {
    if (isBlockedIp(ip)) {
      throw new BlockedTargetError("BLOCKED_ADDRESS", `Target resolves to a blocked address (${ip})`);
    }
  }
}
