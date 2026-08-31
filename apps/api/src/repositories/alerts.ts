import type { Alert, AlertCounts, AlertStatus, ListAlertsQuery } from "@urlpulse/types";
import type { Db } from "../lib/db";

/**
 * Data access for alerts. Every query is scoped to a user_id so one user can
 * never read or mutate another's alerts (ownership is enforced here, exactly
 * like batches). Returns camelCase DTOs, never raw rows.
 */

interface AlertRow {
  id: string;
  type: Alert["type"];
  title: string;
  detail: string;
  batch_id: string;
  url: string;
  severity: Alert["severity"];
  status: AlertStatus;
  detected_at: Date;
}

function toAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail,
    batchId: row.batch_id,
    url: row.url,
    severity: row.severity,
    status: row.status,
    detectedAt: row.detected_at.toISOString(),
  };
}

export interface AlertRepository {
  list(userId: string, query: ListAlertsQuery): Promise<{ items: Alert[]; total: number }>;
  counts(userId: string): Promise<AlertCounts>;
  setStatus(userId: string, id: string, status: AlertStatus): Promise<Alert | null>;
}

export function createAlertRepository(db: Db): AlertRepository {
  return {
    async list(userId, query) {
      const { status, severity, page, pageSize } = query;
      const offset = (page - 1) * pageSize;
      const statusFilter = status ? db`AND status = ${status}` : db``;
      const severityFilter = severity ? db`AND severity = ${severity}` : db``;

      const rows = await db<AlertRow[]>`
        SELECT id, type, title, detail, batch_id, url, severity, status, detected_at
        FROM alerts
        WHERE user_id = ${userId} ${statusFilter} ${severityFilter}
        ORDER BY detected_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const [count] = await db<{ total: number }[]>`
        SELECT count(*)::int AS total
        FROM alerts
        WHERE user_id = ${userId} ${statusFilter} ${severityFilter}
      `;
      return { items: rows.map(toAlert), total: count?.total ?? 0 };
    },

    async counts(userId) {
      const [row] = await db<
        {
          critical: number;
          warning: number;
          info: number;
          resolved: number;
          unread: number;
          total: number;
        }[]
      >`
        SELECT
          count(*) FILTER (WHERE severity = 'critical' AND status <> 'resolved')::int AS critical,
          count(*) FILTER (WHERE severity = 'warning' AND status <> 'resolved')::int AS warning,
          count(*) FILTER (WHERE severity = 'info' AND status <> 'resolved')::int AS info,
          count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
          count(*) FILTER (WHERE status = 'new')::int AS unread,
          count(*)::int AS total
        FROM alerts
        WHERE user_id = ${userId}
      `;
      return row ?? { critical: 0, warning: 0, info: 0, resolved: 0, unread: 0, total: 0 };
    },

    /**
     * Transition one alert's status, scoped to the owner. Returns the updated
     * alert, or null when no alert with that id belongs to the user (the route
     * turns null into a 404 so ownership is never leaked).
     */
    async setStatus(userId, id, status) {
      const [row] = await db<AlertRow[]>`
        UPDATE alerts
        SET status = ${status}, updated_at = now()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id, type, title, detail, batch_id, url, severity, status, detected_at
      `;
      return row ? toAlert(row) : null;
    },
  };
}
