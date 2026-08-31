import type { Metadata } from "next";
import { VerifyEmailScreen } from "@/features/auth/components/pages";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return <VerifyEmailScreen />;
}
