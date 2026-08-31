import type { ReactNode } from "react";
import type { Tone } from "@/features/batches/lib/status";
import styles from "./ui.module.css";

export function ProgressBar({
  value,
  tone = "accent",
  label,
}: {
  /** 0–100 */
  value: number;
  tone?: Tone;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={styles.progressTrack}
    >
      <div className={styles.progressFill} data-tone={tone} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {sub ? <div className={styles.metricSub}>{sub}</div> : null}
    </div>
  );
}
