import { CheckCircle2, Clock, LoaderCircle, XCircle, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { HealthWave } from "@/components/motion/HealthWave";
import { formatDateTime } from "@/lib/format";
import type { Batch } from "../types";
import type { Tone } from "../lib/status";
import { progressCount, progressPercent, sharePercent } from "../lib/derive";
import styles from "./batch-detail.module.css";

const TONE_SOLID: Record<Tone, string> = {
  success: "var(--color-success)",
  accent: "var(--color-accent)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  neutral: "var(--color-text-muted)",
};
const TONE_SUBTLE: Record<Tone, string> = {
  success: "var(--color-success-subtle)",
  accent: "var(--color-accent-subtle)",
  warning: "var(--color-warning-subtle)",
  error: "var(--color-error-subtle)",
  neutral: "var(--color-bg)",
};

export function ProgressSummaryCard({ batch }: { batch: Batch }) {
  const s = batch.statistics;
  const pct = progressPercent(s);

  const metrics: { label: string; value: number; tone: Tone; Icon: LucideIcon }[] = [
    { label: "Completed", value: s.completed, tone: "success", Icon: CheckCircle2 },
    { label: "In Progress", value: s.inProgress, tone: "accent", Icon: LoaderCircle },
    { label: "Queued", value: s.queued, tone: "warning", Icon: Clock },
    { label: "Failed", value: s.failed, tone: "error", Icon: XCircle },
  ];

  return (
    <Card>
      <div className={styles.metaLabel}>Progress</div>
      <div className={styles.progressHeadRow}>
        <span className={styles.progressPct}>{pct}%</span>
        <div style={{ flex: 1 }}>
          <ProgressBar value={pct} tone="accent" label={`Batch progress ${pct}%`} />
        </div>
      </div>
      <div className={styles.progressCount}>
        {progressCount(s)} / {s.total} URLs
      </div>

      {batch.status === "PROCESSING" && (
        <div className={styles.pulseRow} aria-hidden>
          <HealthWave state="processing" active height={26} width="100%" />
        </div>
      )}

      <div className={styles.metricGrid}>
        {metrics.map((m) => {
          const share = (m.value / s.total) * 100;
          return (
            <div key={m.label} className={styles.metricCard}>
              <div className={styles.metricCardHead}>
                <span className={styles.metricIcon} style={{ background: TONE_SUBTLE[m.tone], color: TONE_SOLID[m.tone] }} aria-hidden>
                  <m.Icon size={16} strokeWidth={2} />
                </span>
                <span className={styles.metaLabel}>{m.label}</span>
              </div>
              <div className={styles.metricValue}>{m.value}</div>
              <div className={styles.metricSub}>{sharePercent(m.value, s.total)}</div>
              <div className={styles.metricMini}>
                <div className={styles.metricMiniFill} style={{ width: `${share}%`, background: TONE_SOLID[m.tone] }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.metaGrid}>
        <MetaItem
          label="Check Interval"
          value={batch.config.checkIntervalMinutes === null ? "One-time check" : `${batch.config.checkIntervalMinutes} minutes`}
        />
        <MetaItem label="Timeout" value={batch.config.timeoutSeconds === null ? "—" : `${batch.config.timeoutSeconds} seconds`} />
        <MetaItem label="Retry Attempts" value={batch.config.retryAttempts === null ? "—" : `${batch.config.retryAttempts} attempts`} />
        <MetaItem label="Started At" value={batch.startedAt ? formatDateTime(batch.startedAt) : "—"} />
        <MetaItem label="Completed At" value={batch.completedAt ? formatDateTime(batch.completedAt) : "—"} />
        <MetaItem label="Created By" value={batch.createdBy ?? "—"} />
      </div>
    </Card>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </div>
  );
}
