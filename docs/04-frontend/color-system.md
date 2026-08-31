# UrlPulse — Color System

Light and dark themes. Values here are authoritative for color; token *names* are defined
in `design-tokens.md`. Aligns with `apps/web/app/globals.css`.

Theme selection: default follows `prefers-color-scheme`; an explicit choice is stamped as
`data-theme="light" | "dark"` on `:root` (see `motion.md`/`accessibility.md` for the
no-flash + reduced-motion handling already in the app shell).

---

## Principles

- **Blue guides attention; it does not coat the UI.** Use it for links, active nav,
  in-progress state, focus rings, and the brand mark — not for backgrounds, headings, or
  every icon.
- **The primary button is neutral near-black in light mode and blue in dark mode**, per the
  reference. The solid button *commits*; blue *points*. This keeps the canvas calm.
- **Green/amber/red are state, never branding.** Keep them restrained (muted, not neon)
  and always pair them with an icon/label (see `accessibility.md` — never color alone).
- **Few colored backgrounds.** Tinted "subtle" fills are reserved for status pills, the
  active nav row, and metric icon tiles.

## Neutrals & surfaces

| Role | Light | Dark |
|---|---|---|
| `--color-bg` (app canvas) | `#f7f8fa` | `#0b0b0e` |
| `--color-surface` (cards, sidebar, header) | `#ffffff` | `#16161a` |
| `--color-surface-elevated` (popovers, dialogs) | `#ffffff` | `#1c1c21` |
| `--color-border` | `#e4e4e7` | `#27272a` |
| `--color-border-strong` | `#d4d4d8` | `#3f3f46` |
| `--color-text` (primary) | `#18181b` | `#fafafa` |
| `--color-text-secondary` | `#52525b` | `#d4d4d8` |
| `--color-text-muted` | `#71717a` | `#a1a1aa` |

## Accent (blue)

| Role | Light | Dark |
|---|---|---|
| `--color-accent` | `#2563eb` | `#60a5fa` |
| `--color-accent-hover` | `#1d4ed8` | `#93c5fd` |
| `--color-accent-subtle` (tint bg: active nav, info tile, in-progress pill) | `#eff4ff` | `rgba(96,165,250,.14)` |
| `--color-info` | = `--color-accent` | = `--color-accent` |
| `--color-focus` | = `--color-accent` | = `--color-accent` |

## Action (primary button)

| Role | Light | Dark |
|---|---|---|
| `--color-action` | `#18181b` | `#2563eb` |
| `--color-action-hover` | `#000000` | `#1d4ed8` |
| `--color-on-action` (text/icon on action) | `#ffffff` | `#ffffff` |

> Reference-driven: the primary button is a neutral near-black solid in **light** mode and
> a **blue** solid in **dark** mode (`dashboard-dark.png`). Blue remains the accent for
> interaction/state in both themes.

## Status

Each status has a solid (bar/dot/icon), a foreground (text on subtle bg), and a subtle
background (pill/tile). Muted, not saturated.

| Status | Role | Light solid / fg / subtle | Dark solid / fg / subtle |
|---|---|---|---|
| Success (completed) | `--color-success` / `-fg` / `-subtle` | `#16a34a` / `#15803d` / `#ecfdf3` | `#22c55e` / `#4ade80` / `rgba(34,197,94,.14)` |
| Warning | `--color-warning` / `-fg` / `-subtle` | `#d97706` / `#b45309` / `#fffbeb` | `#f59e0b` / `#fbbf24` / `rgba(245,158,11,.14)` |
| Error (failed) | `--color-error` / `-fg` / `-subtle` | `#dc2626` / `#b91c1c` / `#fef2f2` | `#ef4444` / `#f87171` / `rgba(239,68,68,.14)` |
| Info / running | `--color-accent` / `-hover` / `-subtle` | see Accent | see Accent |

## Status → UI mapping

| Batch/URL state | Solid (bar, dot) | Pill bg / text |
|---|---|---|
| Queued / Pending | `--color-text-muted` | neutral subtle / secondary text |
| Running / In Progress | `--color-accent` | `--color-accent-subtle` / accent |
| Completed / Success | `--color-success` | `--color-success-subtle` / success-fg |
| Failed / Error | `--color-error` | `--color-error-subtle` / error-fg |
| Cancelled | `--color-text-muted` | neutral subtle / muted (with a str*ike/− icon) |

## Metric card icon tiles (reference)

Soft tinted square behind the icon: Total → accent-subtle; Completed → success-subtle;
In Progress → accent-subtle; Failed → error-subtle. Delta text uses success-fg (up) or
error-fg (down); sparkline stroke uses the matching status solid.

## Contrast

All text/background pairings must meet WCAG 2.1 AA (4.5:1 body, 3:1 large text and UI
component boundaries). Muted text is for non-essential metadata only. Status pills must
pass contrast for their foreground on their subtle background in both themes. See
`accessibility.md`.

## Dark-mode shadows

Reuse `--shadow-*` with higher opacity (≈1.5×); dark depth leans on `--color-border` and
`--color-surface-elevated` tonal steps more than on shadow.

## Do not

Rainbow dashboards, purple gradients, neon, glassmorphism tints, or arbitrary colors
outside these roles. New colors require a documented decision.
