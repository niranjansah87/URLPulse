"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

/**
 * Site favicon for a URL, resolved from its host via DuckDuckGo's icon service
 * (no key, cached at the edge). Falls back to a globe glyph for an invalid host
 * or a failed load, so a row never shows a broken image.
 */
export function Favicon({ url, size = 16 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* invalid URL — fall through to the globe */
  }

  if (failed || !host) {
    return <Globe size={size} aria-hidden style={{ color: "var(--color-text-muted)", flex: "none" }} />;
  }
  return (
    <img
      src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ flex: "none", borderRadius: 3, display: "block" }}
    />
  );
}
