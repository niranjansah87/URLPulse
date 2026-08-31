"use client";

import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

/** Accessible switch (role="switch"). Thumb slides with a short transition. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn(styles.toggle, checked && styles.toggleOn)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleThumb} aria-hidden />
    </button>
  );
}
