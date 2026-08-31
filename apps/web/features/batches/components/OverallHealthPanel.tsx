import { Card, SectionHeader } from "@/components/ui/Card";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import type { BatchStatistics } from "../types";
import { sharePercent } from "../lib/derive";
import type { Tone } from "../lib/status";
import styles from "./batch-detail.module.css";

const TONE_BG: Record<Tone, string> = {
  success: "var(--color-success)",
  accent: "var(--color-accent)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  neutral: "var(--color-text-muted)",
};

/** Success rate among finished checks: completed / (completed + failed). */
function successRate(stats: BatchStatistics): string {
  const finished = stats.completed + stats.failed;
  if (finished === 0) return "—";
  return `${((stats.completed / finished) * 100).toFixed(1)}%`;
}

export function OverallHealthPanel({ stats }: { stats: BatchStatistics }) {
  const segments: DonutSegment[] = [
    { label: "Completed", value: stats.completed, tone: "success" },
    { label: "In Progress", value: stats.inProgress, tone: "accent" },
    { label: "Queued", value: stats.queued, tone: "warning" },
    { label: "Failed", value: stats.failed, tone: "error" },
  ];

  return (
    <Card>
      <SectionHeader title="Overall Health" />
      <div className={styles.donutWrap}>
        <DonutChart segments={segments} centerValue={successRate(stats)} centerLabel="Success Rate" />
      </div>
      <div className={styles.legend}>
        {segments.map((seg) => (
          <div key={seg.label} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: TONE_BG[seg.tone] }} aria-hidden />
            <span className={styles.legendLabel}>{seg.label}</span>
            <span className={styles.legendValue}>
              {seg.value} ({sharePercent(seg.value, stats.total)})
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
