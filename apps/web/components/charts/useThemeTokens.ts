"use client";

import { useEffect, useState } from "react";

export interface ThemeTokens {
  success: string;
  accent: string;
  warning: string;
  error: string;
  muted: string;
  border: string;
  text: string;
  surface: string;
}

const NAMES: Record<keyof ThemeTokens, string> = {
  success: "--color-success",
  accent: "--color-accent",
  warning: "--color-warning",
  error: "--color-error",
  muted: "--color-text-muted",
  border: "--color-border",
  text: "--color-text",
  surface: "--color-surface-elevated",
};

function read(): ThemeTokens {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as ThemeTokens;
  for (const key of Object.keys(NAMES) as (keyof ThemeTokens)[]) {
    out[key] = cs.getPropertyValue(NAMES[key]).trim();
  }
  return out;
}

/**
 * Resolves design-token colors to concrete values for libraries that need real
 * color strings (Recharts). Re-reads when the theme attribute or the OS color
 * scheme changes so charts follow light/dark without a remount.
 */
export function useThemeTokens(): ThemeTokens | null {
  const [tokens, setTokens] = useState<ThemeTokens | null>(null);

  useEffect(() => {
    const update = () => setTokens(read());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);

  return tokens;
}
