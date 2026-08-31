"use client";

import { useEffect, useState } from "react";
import type { AlertCounts } from "@urlpulse/types";
import { api } from "@/lib/api";

/**
 * Unread (new) alert count for the bell/sidebar badge, from the authoritative
 * counts endpoint. Best-effort: a failed fetch leaves the badge at 0.
 */
export function useUnreadAlertCount(): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .get<AlertCounts>("/alerts/counts")
      .then((r) => {
        if (active) setUnread(r.data.unread);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return unread;
}
