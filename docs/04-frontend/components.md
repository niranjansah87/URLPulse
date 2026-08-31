# UrlPulse — Components

Visual rules for core components. Colors/sizes reference token names
(`design-tokens.md`, `color-system.md`). Motion references `motion.md`. All colors below
are roles, resolved per theme.

---

## App shell

Sidebar (left, fixed) + sticky header + centered content area. See
`spacing-and-layout.md`. The shell is quiet: `--color-surface` panels, 1px borders, no
shadow between shell regions.

## Sidebar

- **Branding:** horizontal logo (mark + wordmark) at top, theme-aware variant from
  `public/brand/logo/horizontal/`. Collapses to the mark in narrow contexts.
- **Navigation:** icon + label rows (Batches, Create Batch, History, Alerts, Settings).
  - Default: `--color-text-secondary` text, muted icon, transparent bg.
  - Hover: `--color-bg` row tint.
  - **Active:** `--color-accent-subtle` row, `--color-accent` icon + text, `--radius-sm`.
    Also carry a non-color cue (e.g. medium weight) — never color alone.
- **Promo card (optional):** the quiet card near the bottom (thin blue sparkline motif).
  Subtle, dismissible, never competes with nav.
- **User/profile area:** avatar (initials, `--radius-pill`), name (`--text-sm` medium),
  email (`--text-xs` muted), `…` menu.
- Keep it visually quiet: one accent (the active row), everything else neutral.

## Buttons

Height `--control-md` (default) / `--control-lg` (primary CTA, mobile). Radius `--radius-md`.
Label = button type (`typography.md`). No all-caps. Pills are for badges, not buttons.

| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| Primary | `--color-action` | `--color-on-action` | none | the main commit (New Batch, Create) |
| Secondary | `--color-surface` | `--color-text` | 1px `--color-border` | secondary actions |
| Ghost | transparent | `--color-text-secondary` | none | tertiary / "View documentation →" |
| Destructive | `--color-error` | `#fff` | none | irreversible actions (confirmed) |
| Icon | transparent → `--color-bg` hover | `--color-text-secondary` | none | toolbar/table `…`, theme toggle |

Focus: 2px `--color-focus` ring with offset (see `accessibility.md`). Hover uses
`--color-action-hover` / tint. Disabled: reduced opacity + `not-allowed`, never color-only.

## Cards

1px `--color-border`, `--radius-md` (or `-lg` for hero), `--shadow-xs`/`-sm`, padding per
`spacing-and-layout.md`. Not floating glass; no large/glowing shadow. `--color-surface`.

### Metric card
Icon tile (soft status tint) + label (`--text-sm` secondary) + value (metric number,
tabular) + delta line (dir icon + %, status fg) + sparkline (thin stroke, matching status
solid, no axes/labels). Four across desktop.

## Status badge (pill)

`--radius-pill`, `--text-xs` medium, `--space-1`/`--space-2` padding, subtle bg + status fg,
**icon + label** (never color alone):

| State | Icon | Colors |
|---|---|---|
| Queued / Pending | ○ / clock | neutral subtle / secondary |
| Running / In Progress | ◗ (animated, see motion) | accent-subtle / accent |
| Completed | ✓ | success-subtle / success-fg |
| Failed | ✕ / ⚠ | error-subtle / error-fg |
| Cancelled | − / ⊘ | neutral subtle / muted |

## Progress

A primary UrlPulse element. Thin bar (height ~6–8px, `--radius-pill`) on a `--color-border`
track; fill = status solid (accent running / success completed / error failed). Pair with:
`%` (tabular) and `x / total` count. Optional subtle activity shimmer on the running fill
(see `motion.md` — reduced-motion disables it). No 3D, no gloss.

## Tables (batch list)

Optimize for scanning. Columns: Batch (name + `#id` muted), Status (badge), Progress (bar +
%), URLs (`x / total`), Created (date + time), Duration, Actions (`…`). Rules:
- Header row: label type; 1px bottom border.
- Row separators only (1px `--color-border`); **no vertical separators**; generous row height.
- Row hover: `--color-bg` tint. Entire row (or name) links to detail.
- Right-align numeric columns; use tabular numerals.
- Empty/loading/error variants: see `empty-loading-error-states.md`.

## URL result (batch detail)

Per URL, show: URL (mono/sans, truncated + tooltip), HTTP status (mono; colored by class —
2xx success, 3xx neutral/info, 4xx warning, 5xx error — with label, not color only), latency
(mono ms), final state (badge), error (message + code when failed), timestamp (metadata).
Attempt count shown for retried/failed rows.

## Charts / visualizations

Only where they inform: metric sparklines (trend) and progress. No decorative charts, no
gratuitous donuts/gauges. Sparklines are label-free, thin-stroke, single-color.

## Dialogs

Centered, `--color-surface-elevated`, `--radius-lg`, `--shadow-md`, backdrop `--z-overlay`
(scrim, not blur-heavy). Title + body + actions (primary right, secondary/ghost left of it).
Types: confirmation, **destructive** (destructive button + clear consequence text; require
explicit confirm), batch creation (URL textarea + CSV upload), retry-failed confirmation.
Focus trap + Escape + return focus (see `accessibility.md`).

## Toasts

Bottom or top-right, `--color-surface-elevated`, `--radius-md`, `--shadow-md`, short and
subtle. Icon + concise message (+ optional action). Auto-dismiss ~4–6s; errors persist until
dismissed. `--z-toast`. Never stack more than a few; no animation beyond a gentle fade/slide.

## Empty states

Intentional, not "missing UI": a small line/mark illustration (thin monitoring motif),
one-line explanation, and a primary action (e.g. "Create your first batch"). See
`empty-loading-error-states.md`.
