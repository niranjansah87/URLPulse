"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AlertCounts } from "@urlpulse/types";
import { api } from "@/lib/api";

/** How often to re-poll the unread count while the app sits open on one page. */
const POLL_MS = 60_000;

/**
 * Dispatched on `window` after an alert is acknowledged/resolved so the header
 * bell (a separate hook instance from the Alerts page) refetches its unread count
 * immediately, instead of waiting for the next poll/route change.
 */
export const ALERTS_CHANGED_EVENT = "urlpulse:alerts-changed";

/**
 * Unread (new) alert count for the header bell, from the authoritative counts
 * endpoint. The header lives in the persistent app layout, so a once-on-mount
 * fetch would go stale as alerts are raised or acknowledged. Instead it refreshes
 * on mount, on route change (e.g. returning from /alerts after ack/resolve), when
 * the tab regains focus, and on a slow interval. Best-effort: a failed fetch
 * leaves the last known value.
 */
export function useUnreadAlertCount(): number {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  const fetchCount = useCallback(async () => {
    try {
      const r = await api.get<AlertCounts>("/alerts/counts");
      setUnread(r.data.unread);
    } catch {
      /* best-effort; keep the last known count */
    }
  }, []);

  useEffect(() => {
    void fetchCount();
    const onFocus = () => void fetchCount();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(ALERTS_CHANGED_EVENT, onFocus);
    const timer = setInterval(() => void fetchCount(), POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(ALERTS_CHANGED_EVENT, onFocus);
      clearInterval(timer);
    };
  }, [fetchCount]);

  // Re-check whenever the route changes so the badge reflects actions taken on
  // the Alerts page as soon as the user navigates.
  useEffect(() => {
    void fetchCount();
  }, [pathname, fetchCount]);

  return unread;
}
