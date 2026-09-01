import { CheckCircle2, Loader, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { httpStatusText } from "../lib/status";
import type { ActivityEvent } from "../types";
import type { LiveState } from "../hooks/useBatchDetail";
import styles from "./batch-detail.module.css";

const KIND = {
  checked: { verb: "Checked", color: "var(--color-success)", Icon: CheckCircle2 },
  checking: { verb: "Checking", color: "var(--color-accent)", Icon: Loader },
  failed: { verb: "Failed", color: "var(--color-error)", Icon: XCircle },
} as const;

const LIVE_LABEL: Record<LiveState, string> = {
  live: "Live",
  reconnecting: "Reconnecting…",
  offline: "Final",
};

function metaFor(e: ActivityEvent): string {
  if (e.kind === "checking") return "In Progress";
  const parts = [httpStatusText(e.httpStatus)];
  if (e.responseTimeMs !== null) parts.push(`${e.responseTimeMs} ms`);
  return parts.join(" • ");
}

export function LiveActivityPanel({ activity, live }: { activity: ActivityEvent[]; live: LiveState }) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)" }}>Live Activity</h2>
        <span className={cn(styles.liveTag, live !== "live" && styles.liveTagMuted)} role="status" aria-live="polite">
          <span className={cn(styles.liveDot, live !== "live" && styles.liveDotMuted)} aria-hidden />
          {LIVE_LABEL[live]}
        </span>
      </div>
      {activity.length === 0 ? (
        <EmptyState title="No activity yet" body="Checks will appear here as they run." />
      ) : (
        <div className={styles.activityList}>
          {activity.map((e) => {
            const k = KIND[e.kind];
            const Icon = k.Icon;
            return (
              <div key={e.id} className={styles.activityItem}>
                <span className={styles.activityIcon} style={{ color: k.color }} aria-hidden>
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <div className={styles.activityBody}>
                  <div className={styles.activityText} title={e.url}>
                    {k.verb} {e.url}
                  </div>
                  <div className={styles.activityMeta}>{e.message ?? metaFor(e)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
