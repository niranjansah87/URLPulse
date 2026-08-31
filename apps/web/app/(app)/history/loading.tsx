import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Skeleton width={140} height={13} />
        <Skeleton width={180} height={30} />
        <Skeleton width={300} height={14} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--space-4)" }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={104} style={{ borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
          <Card>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={40} style={{ marginBottom: "var(--space-3)" }} />
            ))}
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card>
            <Skeleton height={220} />
          </Card>
          <Card>
            <Skeleton height={260} />
          </Card>
        </div>
      </div>
      <span className="sr-only">Loading history…</span>
    </div>
  );
}
