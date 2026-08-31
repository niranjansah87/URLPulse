import Link from "next/link";
import { Download, Link2, Radar } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/format";
import type { BatchRow } from "../../types";
import { batchStatusView } from "../../lib/status";
import styles from "./create.module.css";

const STEPS = [
  { icon: Link2, label: "Add URLs", text: "Add URLs manually or upload a CSV file" },
  { icon: Radar, label: "We monitor", text: "Our system checks your URLs in real-time" },
  { icon: Download, label: "Get results", text: "View results, alerts and export data" },
];

export function CreateSidebar({ recent, recentFailed }: { recent: BatchRow[]; recentFailed: boolean }) {
  return (
    <div className={styles.rightCol}>
      <Card>
        <h2 className={styles.howTitle}>How it works</h2>
        <ol className={styles.howList}>
          {STEPS.map(({ icon: Icon, label, text }) => (
            <li key={label} className={styles.howItem}>
              <span className={styles.howIcon} aria-hidden>
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <div>
                <div className={styles.howLabel}>{label}</div>
                <div className={styles.howText}>{text}</div>
              </div>
            </li>
          ))}
        </ol>
        <img className={`${styles.illo} ${styles.illoLight}`} src="/illustration/urlpulse-dashboard-illustration-light.png" alt="" />
        <img className={`${styles.illo} ${styles.illoDark}`} src="/illustration/urlpulse-dashboard-illustration-dark.png" alt="" />
      </Card>

      <Card>
        <div className={styles.recentHead}>
          <h2 className={styles.recentTitle}>Recent Batches</h2>
          <Link href="/batches" style={{ fontSize: "var(--text-sm)" }}>
            View all
          </Link>
        </div>
        {recentFailed ? (
          <p className={styles.recentMeta}>Couldn&apos;t load recent batches.</p>
        ) : recent.length === 0 ? (
          <p className={styles.recentMeta}>No batches yet — your first one will appear here.</p>
        ) : (
          recent.map((b) => {
            const view = batchStatusView(b.status);
            return (
              <Link key={b.id} href={`/batches/${b.id}`} className={styles.recentRow}>
                <div className={styles.recentBody}>
                  <div className={styles.recentName}>{b.name}</div>
                  <div className={styles.recentMeta}>
                    {b.done} / {b.total} URLs
                  </div>
                </div>
                <StatusBadge tone={view.tone} label={view.label} />
                <span className={styles.recentTime}>{formatRelativeTime(b.createdAt)}</span>
              </Link>
            );
          })
        )}
      </Card>
    </div>
  );
}
