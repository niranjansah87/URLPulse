import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { BatchStatesGrid } from "@/features/batches/components/states/BatchStatesGrid";

export const metadata: Metadata = { title: "Batch States", robots: { index: false, follow: false } };

export default function BatchStatesPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Batches", href: "/batches" }, { label: "Batch States" }]}
        title="Batch States"
        description="Different states a batch can be in and how they are displayed."
        actions={<NotificationBell />}
      />
      <BatchStatesGrid />
    </>
  );
}
