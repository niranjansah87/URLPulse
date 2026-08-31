import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getServerSession } from "@/lib/server-auth";

/** Authenticated application frame. App pages are never indexed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Server-side gate: a signed-out visitor is redirected to /login before any app
  // chrome renders. An unreachable auth service degrades to the app view rather
  // than forcing a false logout; the API still enforces auth on every data
  // request, so this is defense in depth, not the only boundary.
  const session = await getServerSession();
  if (session.status === "unauthenticated") redirect("/login");

  return (
    <AppShell>
      <div id="main-content">{children}</div>
    </AppShell>
  );
}
