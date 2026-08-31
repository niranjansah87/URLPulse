# UrlPulse — Motion

**Alive, not animated.** Motion exists to explain state — progress, activity, transition,
completion — never to impress. Durations/easings are token names from `design-tokens.md`.
Every animation must honor `prefers-reduced-motion` (see end + `accessibility.md`).

---

## Duration & easing

- Small state (hover, press, toggle): `--dur-fast` (120ms), `--ease-standard`.
- Most transitions (nav, expand, fade): `--dur-base` (180ms).
- Larger surfaces (dialogs, drawers): `--dur-slow` (240ms), `--ease-out` on enter.
- Keep everything ≤ 240ms except deliberate looping indicators (progress shimmer, pulse).

## Where motion is allowed

- **Hover/press:** subtle bg/border/opacity change; no scale bounce.
- **Page/route transition:** quick cross-fade or 4–8px fade-up of content; no large slides.
- **Progress:** width transitions smoothly as the value changes; running fill may carry a
  slow, low-contrast shimmer to signal activity.
- **Live activity:** the running status badge and the signature pulse (below) indicate work
  in flight.
- **Success:** a brief, quiet confirmation — a check drawing in or a one-time fill; no
  confetti, no bounce.
- **Error:** a small, single settle (e.g. a 2–3px shake once, or a color settle); never
  repeated or aggressive.
- **Skeletons:** a gentle shimmer/opacity pulse while loading.

## Do not

Bouncing cards, parallax, floating objects, glow, spinning decoration, large entrance
animations, or animation on every element. If motion doesn't communicate state, remove it.

---

## Signature: the monitoring pulse

A single, restrained brand motion — a thin monitoring wave that reads like an instrument,
not a sci-fi effect. It echoes the UrlPulse logo mark.

**Concept:** a thin line traces left→right along a URL/check path, communicating
`URL → request → response → status`. The leading point moves; a short trailing segment
fades behind it.

**Look:**
- Stroke ~1.5–2px, `--color-accent` at reduced opacity (~0.5–0.7); track (if any) at
  `--color-border`.
- Precise, calm, technical. No glow, no thickness pulsing, no color cycling.

**Timing:** one traversal ~1.6s, `--ease-standard`, looping only while work is active.

**Implementation intent (SVG, no library):** a `polyline`/`path` animated via
`stroke-dasharray`/`stroke-dashoffset` (or an offset gradient mask). Example intent:

```css
@keyframes pulse-trace {
  from { stroke-dashoffset: var(--len); }
  to   { stroke-dashoffset: 0; }
}
.pulse-line { stroke: var(--color-accent); stroke-width: 1.75; opacity: .6;
  stroke-dasharray: 48 var(--len); animation: pulse-trace 1.6s var(--ease-standard) infinite; }
@media (prefers-reduced-motion: reduce) {
  .pulse-line { animation: none; stroke-dashoffset: 0; opacity: .4; } /* static wave */
}
```

**Where to use (sparingly — at most one per view):** dashboard hero, an actively-processing
batch, the processing/empty state. Do **not** repeat it across cards, nav, and background at
once — it loses meaning.

**Implemented as** `apps/web/components/motion/HealthWave.tsx` (the primitive: an SVG
heartbeat trace with a lit dash segment animated via `stroke-dashoffset`, `pathLength`
normalised to 100) and `UrlPulseLoader.tsx` (the branded "coming online" screen — the wave
traced through the circular health indicator plus wordmark). Both are pure SVG/CSS with no
animation library and are safe in server components. Current wiring:
- `HealthWave` renders in `ProgressSummaryCard` only while `batch.status === "PROCESSING"`,
  so it starts, stops on completion/cancellation, and reconstructs after refresh straight
  from the authoritative snapshot — it never holds its own state.
- `UrlPulseLoader` is the `app/(app)/loading.tsx` Suspense fallback; its 250ms delayed
  fade-in keeps fast route transitions from flashing it.

---

## Reduced motion

When `prefers-reduced-motion: reduce`:
- Disable the pulse loop, progress shimmer, success draw, and error settle — show the final
  static state instead.
- Replace transitions with instant or ≤ near-zero changes.
- Never remove information that motion was conveying (e.g. progress still shows %/count).

The app shell already applies theme without a flash; motion must degrade the same way —
correct static state first, motion as enhancement.
