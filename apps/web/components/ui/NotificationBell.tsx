"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadAlertCount } from "@/features/alerts/hooks/useUnreadAlertCount";
import styles from "./ui.module.css";

/** Header bell linking to Alerts, with an unread badge (count is text, not color-only). */
export function NotificationBell() {
  const count = useUnreadAlertCount();
  const label = count > 0 ? `Alerts, ${count} unread` : "Alerts";
  return (
    <Link href="/alerts" aria-label={label} className={styles.bell}>
      <Bell size={18} strokeWidth={1.75} aria-hidden />
      {count > 0 ? <span className={styles.bellBadge}>{count > 9 ? "9+" : count}</span> : null}
    </Link>
  );
}
