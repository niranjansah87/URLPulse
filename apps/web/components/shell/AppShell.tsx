"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Sidebar, useSidebarCollapsed } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import styles from "./shell.module.css";

/**
 * Application frame: fixed (collapsible) sidebar + a top header that owns the
 * alerts bell, theme toggle, and profile menu. Content is centered below the
 * header. On small screens the header's menu button opens the sidebar as an
 * off-canvas drawer.
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
        <AppHeader onOpenNav={() => setOpen(true)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
