import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Skeleton width={160} height={13} />
        <Skeleton width={260} height={26} />
        <Skeleton width={360} height={13} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card>
            <Skeleton width={120} height={30} />
            <Skeleton height={8} style={{ margin: "var(--space-4) 0", borderRadius: "var(--radius-pill)" }} />
            <Skeleton height={72} />
          </Card>
          <Card>
            <Skeleton width={140} height={18} />
            <Skeleton height={220} style={{ marginTop: "var(--space-4)" }} />
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card>
            <Skeleton height={200} />
          </Card>
          <Card>
            <Skeleton height={160} />
          </Card>
        </div>
      </div>
      <span className="sr-only">Loading batch…</span>
    </div>
  );
}
