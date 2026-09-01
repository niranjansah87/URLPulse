# UrlPulse - Spacing & Layout

Values are token names from `design-tokens.md` (4-based scale, layout widths, control
heights). Desktop should feel spacious; nothing touches the edges.

---

## App frame

```
┌───────────────────────────────────────────────────────────┐
│ sidebar │  header (sticky)                                 │
│ 248px   ├──────────────────────────────────────────────── │
│         │  content: max --layout-max (1280), centered,     │
│         │  padding --layout-gutter (32)                    │
└───────────────────────────────────────────────────────────┘
```

- **Sidebar:** `--layout-sidebar` (248px), full height, `--color-surface`, 1px right border.
  Internal padding `--space-4`–`--space-6`. Fixed on desktop.
- **Header:** sticky (`--z-sticky`), height ~`--control-lg`+padding (~64px), `--color-surface`,
  1px bottom border, horizontal padding `--layout-gutter`.
- **Content area:** centered, `max-width: --layout-max`, padding `--layout-gutter` (32) on
  desktop, `--layout-gutter-sm` (16) on mobile. Vertical rhythm between major sections:
  `--space-8` (32).

## Cards

- Padding `--space-6` (24); large/hero cards `--space-8` (32).
- Radius `--radius-md` (cards) / `--radius-lg` (hero, dialogs).
- Border `1px --color-border` + `--shadow-xs`/`--shadow-sm`. Never heavy shadow.
- Metric cards: internal gap `--space-3`; icon tile 36–40px, `--radius-sm`.

## Grids & gaps

- Metric row: 4 columns desktop, gap `--space-6` (24).
- General grid gap `--space-6`; tight groups `--space-3`/`--space-4`.

## Tables

- Row vertical padding `--space-4` (16) - generous, scannable.
- Cell horizontal padding `--space-4`; first/last cell align to card padding.
- Column header row: label type (see `typography.md`), `--space-3` vertical padding.
- Separators: 1px `--color-border` **between rows only**; no vertical rules.

## Section spacing

- Between page title and first section: `--space-6`.
- Between stacked sections/cards: `--space-8`.
- Inside a section (heading → content): `--space-4`.

## Mobile spacing

- Content padding `--layout-gutter-sm` (16).
- Card padding `--space-4`.
- Section spacing `--space-6`.
- Preserve whitespace - compress scale, don't remove it. Touch targets ≥ 44px.

## Whitespace rules

- Let the canvas breathe; avoid edge-to-edge density.
- Group related items with proximity; separate groups with space before reaching for borders.
- Alignment is a feature: everything sits on the spacing scale and a shared left edge.
