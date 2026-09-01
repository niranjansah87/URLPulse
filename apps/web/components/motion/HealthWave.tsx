import { cn } from "@/lib/cn";
import styles from "./health-wave.module.css";

export type HealthWaveState = "processing" | "success" | "failed" | "idle";

/**
 * Heartbeat trace: flat baseline, one monitoring spike, flat out. Echoes the
 * UrlPulse logo mark without tracing its (raster-derived) artwork. `pathLength`
 * is normalised to 100 so the dash math is geometry-independent.
 */
const WAVE_PATH = "M8 20 H60 L66 20 L71 26 L77 6 L83 34 L89 15 L94 20 H156";

/**
 * The signature monitoring pulse (docs/04-frontend/motion.md). A thin lit
 * segment travels left→right along the wave — URL → request → response → health
 * — over a faint static track, while `active` and `processing`. Decorative:
 * status is conveyed in adjacent text/badges, so this is aria-hidden. Pure
 * SVG + CSS (no library), compositor-only, and static under reduced motion.
 */
export function HealthWave({
  state = "processing",
  active = true,
  width = 160,
  height = 40,
  className,
}: {
  state?: HealthWaveState;
  active?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return (
    <svg
      className={cn(styles.wave, styles[state], active && styles.active, className)}
      viewBox="0 0 164 40"
      width={width}
      height={height}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* origin (the URL) and health node (the response) bracket the trace */}
      <circle className={styles.origin} cx="8" cy="20" r="3" />
      <path className={styles.track} d={WAVE_PATH} pathLength={100} />
      <path className={styles.pulse} d={WAVE_PATH} pathLength={100} />
      <circle className={styles.node} cx="156" cy="20" r="3.2" />
    </svg>
  );
}
