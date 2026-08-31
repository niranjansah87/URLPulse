import type { Metadata } from "next";
import { HistoryView } from "@/features/history/components/HistoryView";

export const metadata: Metadata = {
  title: "History",
  description: "View and manage all your past URLPulse batches.",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return <HistoryView />;
}
