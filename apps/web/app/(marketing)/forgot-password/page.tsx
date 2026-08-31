import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordScreen } from "@/features/auth/components/pages";
import { getServerSession } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const session = await getServerSession();
  if (session.status === "authenticated") redirect("/batches");
  return <ForgotPasswordScreen />;
}
