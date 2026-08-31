"use client";

import { Logo } from "@/components/ui/Logo";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Bell, ChevronDown, ChevronsLeft, ChevronsRight, History, LayoutGrid, LogOut, PlusCircle, Settings, type LucideIcon } from "lucide-react";
import { Menu } from "@/components/ui/Menu";
import { authClient } from "@/features/auth/client";
import { cn } from "@/lib/cn";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { useUnreadAlertCount } from "@/features/alerts/hooks/useUnreadAlertCount";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./shell.module.css";

interface NavEntry {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV: NavEntry[] = [
  { label: "Batches", href: "/batches", icon: LayoutGrid },
  { label: "Create Batch", href: "/batches/new", icon: PlusCircle },
  { label: "History", href: "/history", icon: History },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

const COLLAPSE_KEY = "urlpulse-sidebar-collapsed";

export function Sidebar({
  onNavigate,
  collapsed,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user, status } = useCurrentUser();
  const unread = useUnreadAlertCount();

  const isActive = (entry: NavEntry) => {
    if (entry.href === "/batches") return pathname.startsWith("/batches") && !pathname.startsWith("/batches/new");
    return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
  };

  return (
    <>
      <div className={styles.brand}>
        {collapsed ? (
          <Link href="/batches" aria-label="URLPulse home" className={styles.brandLink}>
            <img className={cn(styles.mark, styles.logoLight)} src="/brand/mark/urlpulse-light.png" alt="URLPulse" />
            <img className={cn(styles.mark, styles.logoDark)} src="/brand/mark/urlpulse-dark.png" alt="URLPulse" />
          </Link>
        ) : (
          <Logo href="/batches" size="md" className={styles.brandLink} />
        )}
      </div>

      <nav className={styles.nav} aria-label="Primary">
        {NAV.map((entry) => {
          const active = isActive(entry);
          const Icon = entry.icon;
          const badge = entry.href === "/alerts" && unread > 0 ? unread : null;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? entry.label : undefined}
              className={cn(styles.navItem, active && styles.navItemActive)}
            >
              {active ? (
                <motion.span
                  layoutId="nav-active"
                  className={styles.navActiveBg}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <Icon size={18} strokeWidth={1.75} aria-hidden className={styles.navIcon} />
              {!collapsed ? <span className={styles.navLabel}>{entry.label}</span> : null}
              {badge !== null ? (
                <span className={styles.navBadge} aria-label={`${badge} unread`}>
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.profile} title={status === "unavailable" ? "Demo account (auth service unavailable)" : undefined}>
          <span className={styles.avatar} aria-hidden>
            {user?.image ? <img src={user.image} alt="" className={styles.avatarImg} /> : (user?.initials ?? "…")}
          </span>
          {!collapsed ? (
            <span className={styles.profileText}>
              <span className={styles.profileName}>{status === "loading" ? "Loading…" : (user?.name ?? "Signed out")}</span>
              <span className={styles.profileEmail}>{user?.email ?? ""}</span>
            </span>
          ) : null}
          {!collapsed ? (
            <Menu
              iconTrigger={<ChevronDown size={16} />}
              triggerLabel="Account menu"
              align="end"
              items={[
                { label: "Settings", icon: <Settings size={14} />, href: "/settings" },
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
          ) : null}
        </div>
        <div className={cn(styles.footerActions, collapsed && styles.footerActionsCollapsed)}>
          {!collapsed ? <ThemeToggle /> : null}
          <button
            type="button"
            className={styles.collapseBtn}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}

/** Persisted collapsed state for the desktop sidebar. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };
  return [collapsed, toggle];
}
