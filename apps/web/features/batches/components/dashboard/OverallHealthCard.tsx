import { Card, SectionHeader } from "@/components/ui/Card";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import type { BatchRow } from "../../types";
import type { Tone } from "../../lib/status";
import styles from "./dashboard.module.css";

const TONE_BG: Record<Tone, string> = {
  success: "var(--color-success)",
  accent: "var(--color-accent)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  neutral: "var(--color-text-muted)",
};

/** Batch-status distribution of the loaded batches; success rate = completed / (completed + failed). */
export function OverallHealthCard({ rows }: { rows: BatchRow[] }) {
  const count = (s: BatchRow["status"][]) => rows.filter((r) => s.includes(r.status)).length;
  const completed = count(["COMPLETED"]);
  const failed = count(["FAILED"]);
  const segments: DonutSegment[] = [
    { label: "Completed", value: completed, tone: "success" },
    { label: "In Progress", value: count(["PROCESSING", "PENDING"]), tone: "accent" },
    { label: "Failed", value: failed, tone: "error" },
    { label: "Cancelled", value: count(["CANCELLED"]), tone: "neutral" },
  ];
  const finished = completed + failed;
  const rate = finished === 0 ? "—" : `${((completed / finished) * 100).toFixed(1)}%`;
  const total = rows.length;
  const pct = (v: number) => (total === 0 ? "0.0%" : `${((v / total) * 100).toFixed(1)}%`);

  return (
    <Card>
      <SectionHeader title="Overall Health" />
      <div className={styles.donutWrap}>
        <DonutChart segments={segments} centerValue={rate} centerLabel="Success Rate" />
      </div>
      <div className={styles.legend}>
        {segments
          .filter((s) => s.value > 0 || s.tone !== "neutral")
          .map((s) => (
            <div key={s.label} className={styles.legendRow}>
              <span className={styles.legendDot} style={{ background: TONE_BG[s.tone] }} aria-hidden />
              <span className={styles.legendLabel}>{s.label}</span>
              <span className={styles.legendValue}>
                {s.value} ({pct(s.value)})
              </span>
            </div>
          ))}
      </div>
    </Card>
  );
}
