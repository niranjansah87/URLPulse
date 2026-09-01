"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu as MenuIcon } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { authClient } from "@/features/auth/client";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./shell.module.css";

/**
 * Top bar for the app frame: the alerts bell, theme toggle, and a profile pill
 * whose menu holds Sign out. On small screens it also carries the
 * button that opens the sidebar drawer. These controls live here (not the
 * sidebar) so the sidebar stays purely navigational.
 */
export function AppHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const router = useRouter();
  const { user, status } = useCurrentUser();

  return (
    <header className={styles.header}>
      <IconButton label="Open navigation" className={styles.menuBtn} onClick={onOpenNav}>
        <MenuIcon size={20} strokeWidth={1.75} />
      </IconButton>

      <div className={styles.headerRight}>
        <NotificationBell />
        <ThemeToggle />
        <Menu
          align="end"
          triggerLabel="Account menu"
          customTrigger={
            <span
              className={styles.headerProfile}
              title={status === "unavailable" ? "Demo account (auth service unavailable)" : undefined}
            >
              <span className={styles.avatar} aria-hidden>
                {user?.image ? <img src={user.image} alt="" className={styles.avatarImg} /> : (user?.initials ?? "…")}
              </span>
              <span className={styles.headerProfileName}>
                {status === "loading" ? "Loading…" : (user?.name ?? "Signed out")}
              </span>
              <ChevronDown size={16} aria-hidden />
            </span>
          }
          items={[
            {
              label: "Sign out",
              icon: <LogOut size={14} />,
              disabled: status !== "authenticated",
              onSelect: () => {
                void authClient.signOut().then(() => {
                  router.replace("/login");
                  router.refresh();
                });
              },
            },
          ]}
        />
      </div>
    </header>
  );
}
