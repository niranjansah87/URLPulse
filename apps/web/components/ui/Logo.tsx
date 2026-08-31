import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Logo.module.css";

type Size = "sm" | "md" | "lg";

interface LogoProps {
  /** Wrap in a link. Pass `null` to render a non-interactive logo (no animation trigger). */
  href?: string | null;
  size?: Size;
  className?: string;
  /** Overrides the accessible name; defaults to "URLPulse". */
  label?: string;
}

/**
 * URLPulse brand logo, used everywhere the brand appears.
 *
 * Composition: the mark (icon) is a fixed anchor; the wordmark sits beside it and,
 * on hover/focus, retracts INTO the mark and fades — then slides back out on
 * un-hover. Pure CSS (no JS/re-render), theme-aware (light/dark assets swap with
 * the active theme), and reduced-motion safe. Both mark and wordmark ship as
 * light+dark images toggled by CSS so the correct pair shows in either theme.
 */
export function Logo({ href = "/", size = "md", className, label = "URLPulse" }: LogoProps) {
  const inner: ReactNode = (
    <>
      <span className={styles.markWrap} aria-hidden>
        <img className={cn(styles.mark, styles.light)} src="/brand/mark/urlpulse-light.png" alt="" />
        <img className={cn(styles.mark, styles.dark)} src="/brand/mark/urlpulse-dark.png" alt="" />
      </span>
      <span className={styles.textWrap} aria-hidden>
        <img className={cn(styles.text, styles.light)} src="/brand/logo_text/urlpulse-text-light.png" alt="" />
        <img className={cn(styles.text, styles.dark)} src="/brand/logo_text/urlpulse-text-dark.png" alt="" />
      </span>
    </>
  );

  const cls = cn(styles.logo, styles[size], className);

  if (href === null) {
    return (
      <span className={cls} role="img" aria-label={label}>
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={label}>
      {inner}
    </Link>
  );
}
