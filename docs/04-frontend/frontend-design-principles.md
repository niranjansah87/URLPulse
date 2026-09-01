# UrlPulse - Frontend Design Principles (Implementation Checklist)

A short, practical checklist for the agent implementing the frontend. Read alongside the
reference (`reference/frontend/README.md`) and the specs in this folder. This is a
gut-check, not the full spec.

---

## DO

- Use whitespace intentionally; let the canvas breathe.
- Maintain a clear hierarchy - status and progress are the loudest things on screen.
- Use the brand blue **sparingly** (links, active nav, in-progress, focus); primary buttons
  are the neutral near-black/near-white action color.
- Prefer subtle 1px borders for separation.
- Use restrained shadows (`--shadow-xs`/`-sm`) only.
- Keep status colors semantic and always paired with a label/icon.
- Make tables highly scannable (row separators only, tabular numbers, no vertical rules).
- Make progress visually clear (bar + `%` + `x / total`).
- Use meaningful motion only; ship the signature pulse once per view, reduced-motion safe.
- Keep light/dark consistent; test both at every breakpoint.
- Use existing UrlPulse brand assets and theme-correct variants.
- Make responsive behavior intentional (reflow, don't just shrink).
- Pull every value from tokens (`design-tokens.md`); no magic numbers.

## DON'T

- Add gradients everywhere.
- Use neon colors.
- Use glassmorphism.
- Add random blobs.
- Add excessive background illustrations.
- Use huge in-app marketing typography.
- Use excessive rounded pills (pills = badges/avatars only).
- Animate everything.
- Create generic AI-SaaS visuals.
- Add decorative charts with no purpose.
- Introduce arbitrary colors outside the defined roles.
- Redesign the logo.
- Create new brand assets without approval.

## Background & illustration rules

Allowed, but **subtle** and supporting the monitoring concept: thin monitoring lines,
abstract URL paths, a subtle waveform, a barely-visible technical grid, tiny data points, a
gentle system diagram. Never the focal point.

**Never:** giant 3D objects, glowing planets, futuristic cities, AI brains, robots,
holograms, heavy gradients, or blobs covering the screen.

## Brand assets (source of truth: `public/`)

- Horizontal logo → desktop sidebar/header.
- Logo mark → compact/mobile, favicon, small nav.
- Respect light/dark variants per theme.
- OG image → social sharing.
- Do not generate replacements or redesign the mark.

## Implementation contract

**The frontend implementation should reproduce the visual intent of these specifications
rather than inventing a new visual direction.**

**When implementation and design documentation disagree, the design documentation should be
updated intentionally rather than silently diverging.**
