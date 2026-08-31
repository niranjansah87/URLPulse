import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

export function Card({
  children,
  padded = true,
  className,
}: {
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return <section className={cn(styles.card, padded && styles.cardPad, className)}>{children}</section>;
}

export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: "var(--space-2)" }}>{actions}</div> : null}
    </div>
  );
}
