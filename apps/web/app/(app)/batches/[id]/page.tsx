import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { batchRepository } from "@/features/batches/lib/repository";
import { serverAuthHeaders } from "@/lib/server-auth";
import { BatchDetailView } from "@/features/batches/components/BatchDetailView";

export const metadata: Metadata = {
  title: "Batch Details",
  description: "Monitor a URLPulse batch: progress, per-URL results, and live activity.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Server-fetches the authoritative snapshot (refresh-safe, works cold in a new
 * tab), then hands off to the live client view which subscribes to SSE.
 */
export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await batchRepository.getBatchDetail(id, { headers: await serverAuthHeaders() });
  if (!data) notFound();
  return <BatchDetailView initial={data} />;
}
