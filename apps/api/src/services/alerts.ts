import type { Alert, AlertCounts, BatchListMeta, ListAlertsQuery } from "@urlpulse/types";
import type { AlertRepository } from "../repositories/alerts";
import { NotFoundError } from "../lib/errors";

/**
 * Application logic for alerts. Thin over the repository: every call is scoped to
 * the session user's id (never the client's), and a missing/other-user alert is
 * reported as 404 so ownership is never leaked.
 */
export interface AlertService {
  listAlerts(userId: string, query: ListAlertsQuery): Promise<{ items: Alert[]; meta: BatchListMeta }>;
  getCounts(userId: string): Promise<AlertCounts>;
  acknowledge(userId: string, id: string): Promise<Alert>;
  resolve(userId: string, id: string): Promise<Alert>;
}

export function createAlertService(repo: AlertRepository): AlertService {
  async function transition(userId: string, id: string, status: "acknowledged" | "resolved"): Promise<Alert> {
    const alert = await repo.setStatus(userId, id, status);
    if (!alert) throw new NotFoundError(`Alert ${id} not found`);
    return alert;
  }

  return {
    async listAlerts(userId, query) {
      const { items, total } = await repo.list(userId, query);
      return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
    },
    getCounts(userId) {
      return repo.counts(userId);
    },
    acknowledge(userId, id) {
      return transition(userId, id, "acknowledged");
    },
    resolve(userId, id) {
      return transition(userId, id, "resolved");
    },
  };
}
