import { Card, SectionHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatDateTime, truncateMiddle } from "@/lib/format";
import type { Batch } from "../types";
import { batchStatusView } from "../lib/status";
import ui from "@/components/ui/ui.module.css";
import styles from "./batch-detail.module.css";

export function BatchDetailsPanel({ batch }: { batch: Batch }) {
  const view = batchStatusView(batch.status);
  return (
    <Card>
      <SectionHeader title="Batch Details" />
      <div className={styles.detailsList}>
        <Row label="Batch ID">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span className={ui.mono} title={batch.id}>
              {truncateMiddle(batch.id, 10, 6)}
            </span>
            <CopyButton value={batch.id} label="Copy batch ID" />
          </span>
        </Row>
        <Row label="Total URLs">
          <span className={styles.detailVal}>{batch.statistics.total}</span>
        </Row>
        <Row label="Created At">
          <span className={styles.detailVal}>{formatDateTime(batch.createdAt)}</span>
        </Row>
        <Row label="Last Updated">
          <span className={styles.detailVal}>{formatDateTime(batch.updatedAt)}</span>
        </Row>
        <Row label="Status">
          <StatusBadge tone={view.tone} label={view.label} />
        </Row>
      </div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailKey}>{label}</span>
      {children}
    </div>
  );
}
