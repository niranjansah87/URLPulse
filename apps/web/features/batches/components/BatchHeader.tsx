import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/ui/Badge";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { formatRelativeTime } from "@/lib/format";
import type { Batch } from "../types";
import { batchStatusView } from "../lib/status";
import { progressCount } from "../lib/derive";
import { BatchHeaderActions } from "./BatchHeaderActions";
import styles from "./batch-detail.module.css";

interface HeaderActionHandlers {
  busy: "cancel" | "retry" | null;
  onCancel: () => Promise<boolean>;
  onRetryFailed: () => Promise<boolean>;
  onRefresh: () => Promise<void>;
}

export function BatchHeader({ batch, actions }: { batch: Batch; actions: HeaderActionHandlers }) {
  const view = batchStatusView(batch.status);
  const started = batch.startedAt ? formatRelativeTime(batch.startedAt, new Date(batch.updatedAt)) : "Not started";

  return (
    <div className={styles.pageHeader}>
      <Breadcrumbs items={[{ label: "Batches", href: "/batches" }, { label: "Batch Details" }]} />
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{batch.name}</h1>
        <StatusBadge tone={view.tone} label={view.label} />
        <div className={styles.headerActions}>
          <BatchHeaderActions
            status={batch.status}
            failedCount={batch.statistics.failed}
            busy={actions.busy}
            onCancel={actions.onCancel}
            onRetryFailed={actions.onRetryFailed}
            onRefresh={actions.onRefresh}
          />
          <NotificationBell />
        </div>
      </div>
      <div className={styles.metaRow}>
        <span>{started}</span>
        <span className={styles.metaSep}>•</span>
        <span>
          {progressCount(batch.statistics)} / {batch.statistics.total} URLs
        </span>
        <span className={styles.metaSep}>•</span>
        <span>{batch.config.checkIntervalMinutes === null ? "One-time check" : `Check interval ${batch.config.checkIntervalMinutes}m`}</span>
      </div>
    </div>
  );
}
