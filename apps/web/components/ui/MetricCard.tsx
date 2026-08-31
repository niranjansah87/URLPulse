"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import type { Tone } from "@/features/batches/lib/status";
import styles from "./ui.module.css";

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

/**
 * Dashboard/History/Alerts metric tile per the references: soft icon tile,
 * label, tabular value, a sub line (delta with direction or a note), and a
 * small trend sparkline on the right.
 */
export function MetricCard({
  icon,
  label,
  value,
  tone = "accent",
  sub,
  delta,
  trend,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: Tone;
  /** Plain note, e.g. "66.7% success rate". */
  sub?: string;
  /** Signed percentage, e.g. +12 or -25, rendered with a direction arrow. */
  delta?: { value: number; label: string };
  trend?: number[];
}) {
  return (
    <div className={styles.metricCardTile}>
      <span className={styles.metricTileIcon} style={{ background: TONE_SUBTLE[tone], color: TONE_SOLID[tone] }} aria-hidden>
        {icon}
      </span>
      <div className={styles.metricTileBody}>
        <div className={styles.metricLabel}>{label}</div>
        <div className={styles.metricValue}>{value}</div>
        {delta ? (
          <div
            className={styles.metricSub}
            style={{ color: delta.value >= 0 ? "var(--color-success-fg)" : "var(--color-error-fg)", display: "inline-flex", alignItems: "center", gap: 2 }}
          >
            {delta.value >= 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
            {Math.abs(delta.value)}% {delta.label}
          </div>
        ) : sub ? (
          <div className={styles.metricSub}>{sub}</div>
        ) : null}
      </div>
      {trend ? (
        <div className={styles.metricTileTrend}>
          <Sparkline data={trend} tone={tone} />
        </div>
      ) : null}
    </div>
  );
}
