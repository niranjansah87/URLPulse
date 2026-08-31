import { cn } from "@/lib/cn";
import { HealthWave } from "./HealthWave";
import styles from "./url-pulse-loader.module.css";

/**
 * Branded "coming online" loader: the circular health indicator with the
 * monitoring pulse traced through it, plus the wordmark echo. Fades in after a
 * short delay so fast route transitions never flash it (see url-pulse-loader
 * .module.css). Pure CSS/SVG; the visible mark is decorative and the sr-only
 * label carries the status for assistive tech.
 */
export function UrlPulseLoader({
  label = "Bringing UrlPulse online…",
  fullscreen = false,
  className,
}: {
  label?: string;
  fullscreen?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(styles.root, fullscreen && styles.fullscreen, className)}
      role="status"
      aria-live="polite"
    >
      <div className={styles.badge} aria-hidden>
        <span className={styles.ring} />
        <HealthWave state="processing" active width={140} height={36} className={styles.wave} />
      </div>
      <span className={styles.brand} aria-hidden>
        UrlPulse
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
