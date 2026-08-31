"use client";

import { Logo } from "@/components/ui/Logo";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ChevronsLeft, ChevronsRight, History, LayoutGrid, PlusCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./shell.module.css";

interface NavEntry {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV: NavEntry[] = [
  { label: "Dashboard", href: "/batches", icon: LayoutGrid },
  { label: "Create Batch", href: "/batches/new", icon: PlusCircle },
  { label: "History", href: "/history", icon: History },
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
  const reduce = useReducedMotion();

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
          <Logo href="/batches" size="lg" className={styles.brandLink} />
        )}
      </div>

      <nav className={styles.nav} aria-label="Primary">
        {NAV.map((entry) => {
          const active = isActive(entry);
          const Icon = entry.icon;
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
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={cn(styles.footerActions, collapsed && styles.footerActionsCollapsed)}>
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
