"use client";

import { Logo } from "@/components/ui/Logo";
import { useState, type ReactNode } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/Button";
import { Sidebar, useSidebarCollapsed } from "./Sidebar";
import styles from "./shell.module.css";

/**
 * Application frame: fixed (collapsible) sidebar + centered content. Matching
 * the references there is no global top bar on desktop — pages own their header
 * area and the theme toggle lives in the sidebar footer. On small screens a slim
 * bar with a menu button opens the sidebar as an off-canvas drawer.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <div className={cn(styles.shell, collapsed && styles.shellCollapsed)}>
      <aside className={cn(styles.sidebar, open && styles.sidebarOpen, collapsed && styles.sidebarCollapsed)}>
        <Sidebar onNavigate={() => setOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        className={open ? styles.backdropOpen : styles.backdrop}
        onClick={() => setOpen(false)}
      />

      <div className={styles.main}>
        <div className={styles.mobileBar}>
          <IconButton label="Open navigation" onClick={() => setOpen(true)}>
            <MenuIcon size={20} strokeWidth={1.75} />
          </IconButton>
          <Logo href="/batches" size="sm" />
        </div>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
