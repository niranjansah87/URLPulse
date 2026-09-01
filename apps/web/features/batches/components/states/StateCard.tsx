import Link from "next/link";
import type { ReactNode } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/feedback";
import { DonutChart } from "@/components/charts/DonutChart";
import { formatDateTime } from "@/lib/format";
import type { Tone } from "../../lib/status";
import type { BatchRow } from "../../types";
import styles from "./states.module.css";

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

export function StateCard({
  title,
  badge,
  tone,
  batch,
  caption,
  footLeft,
  actions,
}: {
  title: string;
  badge: string;
  tone: Tone;
  batch: BatchRow | null;
  /** Text under the ring, e.g. "Checking URLs…". */
  caption: string;
  footLeft: (b: BatchRow) => string;
  actions: ReactNode;
}) {
  return (
    <Card>
      <div className={styles.cardHead}>
        <span>{title}</span>
        <StatusBadge tone={tone} label={badge} />
      </div>

      {batch === null ? (
        <div className={styles.inner}>
          <EmptyState title="No batch in this state yet" body="Cards fill in from your real batches as they reach this state." />
        </div>
      ) : (
        <>
          <div className={styles.inner}>
            <div className={styles.innerHead}>
              <span className={styles.iconTile} style={{ background: TONE_SUBTLE[tone], color: TONE_SOLID[tone] }} aria-hidden>
                <Calendar size={18} strokeWidth={1.75} />
              </span>
              <div>
                <div className={styles.name}>{batch.name}</div>
                <div className={styles.created}>Created {formatDateTime(batch.createdAt)}</div>
              </div>
              <Link href={`/batches/${batch.id}`} className={styles.viewBtn}>
                <Button variant="secondary" size="sm">
                  View Batch <ChevronRight size={14} aria-hidden />
                </Button>
              </Link>
            </div>

            <div className={styles.body}>
              <div className={styles.ring}>
                <DonutChart
                  size={96}
                  thickness={9}
                  segments={[
                    { label: "Done", value: batch.done, tone },
                    { label: "Remaining", value: Math.max(0, batch.total - batch.done), tone: "neutral" },
                  ]}
                  centerValue={`${batch.progressPercent}%`}
                  centerLabel=""
                />
                <span>{caption}</span>
              </div>
              <div className={styles.stats}>
                <div className={styles.statRow}>
                  <div>
                    <div className={styles.statVal}>{batch.total}</div>
                    <div className={styles.statLbl}>Total URLs</div>
                  </div>
                  <div>
                    <div className={styles.statVal}>{batch.done}</div>
                    <div className={styles.statLbl}>Checked</div>
                  </div>
                  <div>
                    <div className={styles.statVal} style={batch.failed > 0 ? { color: "var(--color-error-fg)" } : undefined}>
                      {batch.status === "CANCELLED" ? "–" : batch.failed}
                    </div>
                    <div className={styles.statLbl}>Errors</div>
                  </div>
                </div>
                <div
                  className={styles.bar}
                  role="progressbar"
                  aria-valuenow={batch.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${batch.progressPercent}% checked`}
                >
                  {batch.total > 0 ? (
                    <>
                      <span style={{ width: `${(batch.completed / batch.total) * 100}%`, background: TONE_SOLID[tone === "error" ? "success" : tone] }} />
                      {batch.failed > 0 ? <span style={{ width: `${(batch.failed / batch.total) * 100}%`, background: TONE_SOLID.error }} /> : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={styles.foot}>
              <span>{footLeft(batch)}</span>
              <span>
                {batch.done} / {batch.total} checked
              </span>
            </div>
          </div>
          <div className={styles.actions}>{actions}</div>
        </>
      )}
    </Card>
  );
}
