import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage } from "@/features/auth/components/AuthPage";
import { getServerSession } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getServerSession();
  if (session.status === "authenticated") redirect("/batches");
  return <AuthPage mode="signup" />;
}
