"use client";

import { useEffect, useState } from "react";
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
 * Single light/dark toggle button. Shows the current theme's icon and flips it
 * on click. Until a choice is stored the app follows the system preference.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
  }, []);

  const dark = mounted ? resolvedIsDark(theme) : false;

  const toggle = () => {
    const next: Theme = dark ? "light" : "dark";
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable; theme still applies this session */
    }
  };

  const Icon = dark ? Moon : Sun;
  return (
    <button
      type="button"
      className={styles.themeToggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={dark}
      onClick={toggle}
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
