import { cn } from "@/lib/cn";
import styles from "./url-pulse-loader.module.css";

/** Heartbeat trace (center spike, ECG shape) and the ring arc - the same clean
 *  geometry the logo reveal draws, recreated as animatable UI primitives rather
 *  than the raster-derived logo paths. Both normalise pathLength to 100. */
const WAVE_PATH = "M12 64 H42 L48 64 L52 56 L57 68 L63 26 L70 100 L76 58 L82 64 H100";
/** Ring with a ~32° gap at the lower-right where the link bridges it (like the
 *  brand mark). Drawn via stroke-dashoffset. */
const RING_PATH = "M109.5 89.2 A52 52 0 1 0 89.2 109.5";

/**
 * The application loader as a small, continuous, living version of the UrlPulse
 * logo reveal (public/brand/urlpulse-logo-reveal.mp4). One seamless CSS/SVG
 * timeline recreates the brand sequence - signal → health ring → heartbeat →
 * URL link → synchronising pulse → wordmark - then recedes and reconstructs, so
 * it can hold for any duration without a visible restart. Pure SVG + CSS: no
 * library, no JS animation loop, no React state; server-component safe,
 * theme-aware via tokens, and static under reduced motion.
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
    <div className={cn(styles.root, fullscreen && styles.fullscreen, className)} role="status" aria-live="polite">
      <div className={styles.mark} aria-hidden>
        <svg viewBox="0 0 128 128" className={styles.icon} fill="none">
          <circle className={styles.halo} cx="104" cy="64" r="10" />
          <path className={styles.ring} d={RING_PATH} pathLength={100} />
          <path className={styles.wave} d={WAVE_PATH} pathLength={100} />
          <path className={styles.trace} d={WAVE_PATH} pathLength={100} />
          <circle className={styles.node} cx="104" cy="64" r="5" />
          {/* Outer <g> holds the static placement (SVG transform attribute); the
              inner <g> is what the CSS animates, so the scale composes within the
              placement instead of overriding it. */}
          <g transform="translate(101 101) rotate(-45)">
            <g className={styles.link}>
              <rect x="-17" y="-7.5" width="21" height="15" rx="7.5" />
              <rect x="-4" y="-7.5" width="21" height="15" rx="7.5" />
            </g>
          </g>
        </svg>
      </div>

      <div className={styles.wordmark} aria-hidden>
        <span className={styles.wmUrl}>Url</span>
        <span className={styles.wmPulse}>Pulse</span>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
