import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupScreen } from "@/features/auth/components/pages";
import { getServerSession } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getServerSession();
  if (session.status === "authenticated") redirect("/batches");
  return <SignupScreen />;
}
