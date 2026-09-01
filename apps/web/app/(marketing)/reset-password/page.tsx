import type { Metadata } from "next";
import { ResetPasswordScreen } from "@/features/auth/components/pages";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
