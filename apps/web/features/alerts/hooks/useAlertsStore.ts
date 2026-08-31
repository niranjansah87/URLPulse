"use client";

import { useCallback, useEffect, useState } from "react";
import type { Alert, AlertCounts, AlertStatus } from "@urlpulse/types";
import { api } from "@/lib/api";

const EMPTY_COUNTS: AlertCounts = { critical: 0, warning: 0, info: 0, resolved: 0, unread: 0, total: 0 };

/**
 * API-backed alert state. Loads the user's alerts and authoritative counts, and
 * acknowledges / resolves through the API. Mutations are optimistic, then
 * reconciled against the server (counts come from the backend, not the page).
 */
export function useAlertsStore() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState<AlertCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, c] = await Promise.all([
        api.get<Alert[]>("/alerts?pageSize=100"),
        api.get<AlertCounts>("/alerts/counts"),
      ]);
      setAlerts(list.data);
      setCounts(c.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const transition = useCallback(
    (id: string, status: AlertStatus, path: "acknowledge" | "resolve") => {
      setAlerts((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
      void api
        .post(`/alerts/${id}/${path}`)
        .then(() => refresh())
        .catch(() => refresh());
    },
    [refresh],
  );

  return {
    alerts,
    counts,
    loading,
    error,
    acknowledge: (id: string) => transition(id, "acknowledged", "acknowledge"),
    resolve: (id: string) => transition(id, "resolved", "resolve"),
    refresh,
  };
}
