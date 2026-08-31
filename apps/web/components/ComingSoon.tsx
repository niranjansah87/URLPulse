import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/feedback";

/** Designed placeholder for navigation targets not yet implemented. */
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <div style={{ padding: "var(--space-12) var(--space-6)" }}>
          <EmptyState
            title={`${title} coming soon`}
            body="This area is part of URLPulse's roadmap and will be available in a future release."
          />
        </div>
      </Card>
    </>
  );
}
