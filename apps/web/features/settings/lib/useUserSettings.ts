"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@urlpulse/types";
import { useToast } from "@/components/ui/Toast";
import { settingsApi } from "../api/settings-api";

const SAVE_DEBOUNCE_MS = 500;

export interface UseUserSettings {
  settings: UserSettings;
  /** Optimistically merge a patch, then persist the full object (debounced). */
  update: (patch: Partial<UserSettings>) => void;
  /** Reset all monitoring settings to defaults. */
  reset: () => void;
  loaded: boolean;
}

/**
 * Server-backed per-user monitoring settings. Loads from GET /settings, applies
 * edits optimistically, and persists the complete object with a short debounce
 * (so typing in the status-codes field coalesces into one write). PostgreSQL is
 * the source of truth; on reload/new device the settings come back from there.
 */
export function useUserSettings(): UseUserSettings {
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let active = true;
    settingsApi
      .get()
      .then((s) => {
        if (active) setSettings(s);
      })
      .catch(() => {
        /* keep defaults; save still works once the user edits */
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const persist = (next: UserSettings) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      settingsApi.save(next).catch(() => {
        toast.show({ title: "Couldn't save settings", body: "Please try again.", tone: "error" });
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const update = (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    persist(next);
  };

  const reset = () => update(DEFAULT_USER_SETTINGS);

  return { settings, update, reset, loaded };
}
