"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { IconButton } from "./Button";
import styles from "./Toast.module.css";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

interface ToastApi {
  show(input: { title: string; body?: string; tone?: ToastTone; durationMs?: number }): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

/** Subtle, short toasts. Errors persist until dismissed; others auto-dismiss. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const reduce = useReducedMotion();

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi["show"]>(
    ({ title, body, tone = "info", durationMs }) => {
      const id = ++idRef.current;
      setItems((list) => [...list.slice(-2), { id, title, body, tone }]);
      const ttl = durationMs ?? (tone === "error" ? 0 : 4500);
      if (ttl > 0) setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport} aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={styles.toast}
              data-tone={t.tone}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            >
              <span className={styles.icon}>{ICON[t.tone]}</span>
              <div className={styles.body}>
                <div className={styles.title}>{t.title}</div>
                {t.body ? <div className={styles.text}>{t.body}</div> : null}
              </div>
              <IconButton label="Dismiss notification" onClick={() => dismiss(t.id)}>
                <X size={14} />
              </IconButton>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
