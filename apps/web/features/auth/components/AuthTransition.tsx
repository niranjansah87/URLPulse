"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * Right-to-left entrance played on every auth route (login / sign-up / forgot /
 * reset). Because each screen mounts fresh on navigation, the slide replays on
 * each switch, giving the "coming in from the right" feel between auth pages.
 * Honors prefers-reduced-motion.
 */
export function AuthTransition({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
