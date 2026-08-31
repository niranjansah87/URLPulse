"use client";

import { useCallback, useState } from "react";
import type { Alert, AlertStatus } from "../types";
import { MOCK_ALERTS } from "../mocks/alerts";

/**
 * Session-local alert state over the mock seed. Mutations are real for the
 * session (acknowledge / resolve / delete) but nothing is sent to a server —
 * there is no alerts backend yet. ponytail: in-memory only; persist via API later.
 */
export function useAlertsStore() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);

  const setStatus = useCallback((id: string, status: AlertStatus) => {
    setAlerts((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);
  const remove = useCallback((id: string) => {
    setAlerts((list) => list.filter((a) => a.id !== id));
  }, []);

  return { alerts, acknowledge: (id: string) => setStatus(id, "acknowledged"), resolve: (id: string) => setStatus(id, "resolved"), remove };
}
