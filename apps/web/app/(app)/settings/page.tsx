import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/components/SettingsPage";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default function Page() {
  return <SettingsPage />;
}
