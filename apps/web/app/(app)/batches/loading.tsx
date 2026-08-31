import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/feedback";
import styles from "@/features/batches/components/dashboard/dashboard.module.css";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Skeleton width={140} height={30} />
          <Skeleton width={300} height={14} />
        </div>
        <Skeleton width={120} height={36} />
      </div>
      <Card padded={false} className={styles.hero}>
        <div>
          <Skeleton width={120} height={12} />
          <Skeleton width={360} height={36} style={{ marginTop: "var(--space-3)" }} />
          <Skeleton width={320} height={36} style={{ marginTop: "var(--space-2)" }} />
          <Skeleton width={280} height={16} style={{ marginTop: "var(--space-4)" }} />
        </div>
        <div className={styles.heroArt}>
          <Skeleton height={200} style={{ borderRadius: "var(--radius-lg)" }} />
        </div>
      </Card>
      <div className={styles.metrics}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={96} style={{ borderRadius: "var(--radius-lg)" }} />
        ))}
      </div>
      <div className={styles.layout}>
        <Card>
          <Skeleton width={160} height={20} />
          <Skeleton height={280} style={{ marginTop: "var(--space-4)" }} />
        </Card>
        <div className={styles.rightCol}>
          <Card>
            <Skeleton height={260} />
          </Card>
        </div>
      </div>
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
