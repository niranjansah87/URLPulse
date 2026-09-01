import type { Metadata } from "next";
import { AlertsPage } from "@/features/alerts/components/AlertsPage";

export const metadata: Metadata = { title: "Alerts", robots: { index: false, follow: false } };

export default function Page() {
  return <AlertsPage />;
}
