"use client";

import { useEffect, useState } from "react";

/**
 * Cosmetic, device-local UI preferences. These have no server-side meaning, so
 * they persist to localStorage under one namespaced key. Monitoring settings
 * (interval, timeout, retries, redirects, SSL) are NOT here — they are
 * authoritative per-user state served by the API (see useUserSettings).
 */
export interface Preferences {
  timezone: string;
  language: string;
  compactDashboard: boolean;
  autoRefreshDashboard: boolean;
  exportWithTitle: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  timezone: "Asia/Kathmandu",
  language: "en-US",
  compactDashboard: false,
  autoRefreshDashboard: true,
  exportWithTitle: true,
};

const KEY = "urlpulse-preferences";

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void, () => void] {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) });
    } catch {
      /* corrupt or unavailable storage: keep defaults */
    }
  }, []);

  const persist = (next: Preferences) => {
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable; state still updates for this session */
    }
  };

  return [prefs, (patch) => persist({ ...prefs, ...patch }), () => persist(DEFAULT_PREFERENCES)];
}
