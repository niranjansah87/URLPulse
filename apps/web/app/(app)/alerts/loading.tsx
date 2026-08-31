import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Skeleton width={140} height={13} />
        <Skeleton width={160} height={30} />
        <Skeleton width={320} height={13} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton height={64} />
              </Card>
            ))}
          </div>
          <Card>
            <Skeleton width={320} height={18} />
            <Skeleton height={440} style={{ marginTop: "var(--space-4)" }} />
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card><Skeleton height={280} /></Card>
          <Card><Skeleton height={300} /></Card>
        </div>
      </div>
      <span className="sr-only">Loading alerts…</span>
    </div>
  );
}
