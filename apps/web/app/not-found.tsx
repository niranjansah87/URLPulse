import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";

/** Root not-found (outside any frame): centered, minimal, on-brand. */
export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)" }}>
      <EmptyState
        icon={<Compass size={28} strokeWidth={1.5} />}
        title="Page not found"
        body="The page you're looking for doesn't exist or has moved."
        action={
          <Link href="/batches">
            <Button variant="secondary">Back to batches</Button>
          </Link>
        }
      />
    </div>
  );
}
