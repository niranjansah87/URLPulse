"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import styles from "./ui.module.css";

/**
 * Search field with a ⌘/Ctrl-K focus shortcut. Presentational for now (no
 * results wiring) - the shortcut and clear affordance are real so it behaves
 * correctly once search lands.
 */
export function SearchInput({
  placeholder = "Search…",
  shortcut = true,
  defaultValue = "",
  value,
  onChange,
  ariaLabel,
}: {
  placeholder?: string;
  shortcut?: boolean;
  defaultValue?: string;
  /** Controlled value; pair with `onChange`. Omit for uncontrolled use. */
  value?: string;
  onChange?: (value: string) => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <div className={styles.inputWrap} style={{ width: "100%" }}>
      <Search size={16} aria-hidden />
      <input
        ref={ref}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        {...(value !== undefined ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue })}
        aria-label={ariaLabel ?? placeholder}
      />
      {shortcut ? (
        <kbd className={styles.kbd} aria-hidden>
          {mac ? "⌘" : "Ctrl"} K
        </kbd>
      ) : null}
    </div>
  );
}
