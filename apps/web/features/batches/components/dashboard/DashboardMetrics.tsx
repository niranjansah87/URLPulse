import { AlertTriangle, Check, Clock, Layers } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import type { BatchRow } from "../../types";
import styles from "./dashboard.module.css";

/** Trend from real per-batch progress of the given rows (oldest → newest); omitted when too sparse. */
function trend(rows: BatchRow[]): number[] | undefined {
  const points = rows
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-8)
    .map((r) => r.progressPercent);
  return points.length >= 2 ? points : undefined;
}

export function DashboardMetrics({ rows, total }: { rows: BatchRow[]; total: number }) {
  const completed = rows.filter((r) => r.status === "COMPLETED");
  const inProgress = rows.filter((r) => r.status === "PROCESSING" || r.status === "PENDING");
  const failed = rows.filter((r) => r.status === "FAILED");
  const loadedNote = rows.length < total ? `of ${total} total` : rows.length === 1 ? "batch" : "batches";

  return (
    <Stagger className={styles.metrics}>
      <StaggerItem>
        <MetricCard icon={<Layers size={18} />} label="Total Batches" value={total} tone="accent" sub={rows.length < total ? `${rows.length} loaded` : undefined} trend={trend(rows)} />
      </StaggerItem>
      <StaggerItem>
        <MetricCard icon={<Check size={18} strokeWidth={2.5} />} label="Completed" value={completed.length} tone="success" sub={loadedNote} trend={trend(completed)} />
      </StaggerItem>
      <StaggerItem>
        <MetricCard icon={<Clock size={18} />} label="In Progress" value={inProgress.length} tone="accent" sub="active now" trend={trend(inProgress)} />
      </StaggerItem>
      <StaggerItem>
        <MetricCard icon={<AlertTriangle size={18} />} label="Failed" value={failed.length} tone="error" sub={loadedNote} trend={trend(failed)} />
      </StaggerItem>
    </Stagger>
  );
}
