import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Create a new password" subtitle="Choose a new password for your account.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
