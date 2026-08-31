import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./auth.module.css";

/**
 * Shared auth page shell (brand + heading + body slot), mirroring AuthPage so the
 * forgot/reset screens match login/signup exactly — same card, logo, typography,
 * spacing, and light/dark behavior. Reuses auth.module.css; adds no new styling.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Link href="/" aria-label="URLPulse home">
            <img className={`${styles.logo} ${styles.logoLight}`} src="/brand/logo/horizontal/urlpulse-dark.png" alt="URLPulse" />
            <img className={`${styles.logo} ${styles.logoDark}`} src="/brand/logo/horizontal/urlpulse-light.png" alt="URLPulse" />
          </Link>
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
