"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import styles from "./shell.module.css";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "urlpulse-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

function resolvedIsDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Segmented light/dark control (sidebar footer, per the references). The active
 * pill slides between the two icons; theme tokens transition via CSS. Until a
 * choice is stored the app follows the system preference.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
  }, []);

  const dark = mounted ? resolvedIsDark(theme) : false;

  const choose = (next: "light" | "dark") => {
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable; theme still applies this session */
    }
  };

  return (
    <div role="group" aria-label="Theme" className={styles.segmented}>
      {(["light", "dark"] as const).map((opt) => {
        const active = opt === "dark" ? dark : !dark;
        const Icon = opt === "dark" ? Moon : Sun;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            aria-label={opt === "dark" ? "Dark theme" : "Light theme"}
            className={styles.segment}
            onClick={() => choose(opt)}
          >
            {active ? (
              <motion.span
                layoutId="theme-pill"
                className={styles.segmentPill}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
            <Icon size={16} strokeWidth={1.75} className={styles.segmentIcon} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
