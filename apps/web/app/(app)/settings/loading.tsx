import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <Skeleton width={140} height={13} />
      <Skeleton width={200} height={30} style={{ marginTop: "var(--space-3)" }} />
      <Skeleton width={420} height={14} style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-6)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card>
            <Skeleton height={180} />
          </Card>
          <Card>
            <Skeleton height={120} />
          </Card>
        </div>
        <Card>
          <Skeleton height={240} />
        </Card>
      </div>
      <span className="sr-only">Loading settings…</span>
    </div>
  );
}
