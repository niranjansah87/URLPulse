"use client";

import { useEffect, useState } from "react";

/**
 * On-device preferences. The backend has no per-user settings yet, so these
 * persist to localStorage under one namespaced key; swap the storage for an API
 * call when the settings endpoint exists.
 */
export interface Preferences {
  timezone: string;
  language: string;
  checkIntervalMinutes: number;
  timeoutSeconds: number;
  retryAttempts: number;
  userAgent: string;
  compactDashboard: boolean;
  autoRefreshDashboard: boolean;
  exportWithTitle: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  timezone: "Asia/Kathmandu",
  language: "en-US",
  checkIntervalMinutes: 5,
  timeoutSeconds: 10,
  retryAttempts: 2,
  userAgent: "URLPulse Bot",
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
