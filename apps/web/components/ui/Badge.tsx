import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/features/batches/lib/status";
import styles from "./ui.module.css";

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(styles.badge, className)} data-tone={tone === "neutral" ? undefined : tone}>
      {children}
    </span>
  );
}

/**
 * Status pill. Carries a colored dot AND a text label, so state is never
 * communicated by color alone (accessibility.md).
 */
export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <Badge tone={tone}>
      <span className={styles.badgeDot} aria-hidden />
      {label}
    </Badge>
  );
}
