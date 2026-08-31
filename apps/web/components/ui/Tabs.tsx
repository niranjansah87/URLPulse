"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./ui.module.css";

export interface TabItem {
  id: string;
  label: string;
  /** Optional leading icon (e.g. lucide), rendered before the label. */
  icon?: ReactNode;
  content: ReactNode;
}

/**
 * Accessible tabs (WAI-ARIA): roving focus with arrow keys, Home/End, and
 * aria-selected/controls wiring. Panels are rendered on demand; inactive panels
 * are unmounted to keep the DOM light.
 */
export function Tabs({ items, defaultTabId }: { items: TabItem[]; defaultTabId?: string }) {
  const baseId = useId();
  const [active, setActive] = useState(defaultTabId ?? items[0]?.id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = items.findIndex((t) => t.id === active);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const nextId = items[next]!.id;
    setActive(nextId);
    tabRefs.current[nextId]?.focus();
  };

  const activeItem = items.find((t) => t.id === active);

  return (
    <div>
      <div role="tablist" aria-label="Sections" className={styles.tabs} onKeyDown={onKeyDown}>
        {items.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => setActive(t.id)}
            >
              {t.icon ? (
                <span className={styles.tabIcon} aria-hidden>
                  {t.icon}
                </span>
              ) : null}
              {t.label}
            </button>
          );
        })}
      </div>
      {activeItem ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeItem.id}`}
          aria-labelledby={`${baseId}-tab-${activeItem.id}`}
          tabIndex={0}
          style={{ paddingTop: "var(--space-6)", outline: "none" }}
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}
