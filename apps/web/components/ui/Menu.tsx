"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { IconButton } from "./Button";
import styles from "./Menu.module.css";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  align?: "start" | "end";
  /** Text trigger (Button). */
  label?: string;
  leftIcon?: ReactNode;
  trailingIcon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  /** Icon-only trigger (IconButton) — provide an accessible name. */
  iconTrigger?: ReactNode;
  triggerLabel?: string;
}

export function Menu({
  items,
  align = "end",
  label,
  leftIcon,
  trailingIcon,
  variant = "secondary",
  size = "md",
  iconTrigger,
  triggerLabel,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      {iconTrigger ? (
        <IconButton
          label={triggerLabel ?? "Open menu"}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {iconTrigger}
        </IconButton>
      ) : (
        <Button
          variant={variant}
          size={size}
          leftIcon={leftIcon}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {label}
          {trailingIcon}
        </Button>
      )}
      {open ? (
        <div role="menu" className={cn(styles.menu, align === "start" ? styles.start : styles.end)}>
          {items.map((item) => {
            const inner = (
              <>
                {item.icon ? <span className={styles.itemIcon}>{item.icon}</span> : null}
                {item.label}
              </>
            );
            const className = cn(styles.item, item.destructive && styles.destructive);
            if (item.href && !item.disabled) {
              return (
                <Link key={item.label} role="menuitem" href={item.href} className={className} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                className={className}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
