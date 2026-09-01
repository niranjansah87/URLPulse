# UrlPulse - Design Tokens

**Authoritative numeric source of truth.** Every other design document references these
token *names*; it must not restate raw values. Values align with the existing
`apps/web/app/globals.css` and refine it. Tokens are expressed as CSS custom properties;
exact color values (light + dark) live in `color-system.md`, referenced here by name.

---

## Naming

`--<category>-<role>[-<variant>]`, e.g. `--color-accent`, `--space-4`, `--radius-md`.
Semantic names (role) over literal names (`--color-blue-500`) so themes can swap values.

## Color (roles)

Full palette + light/dark values: `color-system.md`. Roles:

`--color-bg`, `--color-surface`, `--color-surface-elevated`, `--color-border`,
`--color-border-strong`, `--color-text`, `--color-text-secondary`, `--color-text-muted`,
`--color-accent`, `--color-accent-hover`, `--color-accent-subtle`,
`--color-action`, `--color-action-hover`, `--color-on-action`,
`--color-success`, `--color-success-fg`, `--color-success-subtle`,
`--color-warning`, `--color-warning-fg`, `--color-warning-subtle`,
`--color-error`, `--color-error-fg`, `--color-error-subtle`,
`--color-info` (= `--color-accent`), `--color-focus` (= `--color-accent`).

## Typography (roles)

Families, sizes, weights, line-heights: `typography.md`. Scale tokens:
`--font-sans`, `--font-mono`; sizes `--text-xs 12` `--text-sm 13` `--text-base 14`
`--text-md 15` `--text-lg 18` `--text-xl 20` `--text-2xl 24` `--text-3xl 30`
`--text-4xl 36` (px); weights `--fw-regular 400` `--fw-medium 500` `--fw-semibold 600`
`--fw-bold 700`; line-heights `--lh-tight 1.2` `--lh-snug 1.35` `--lh-normal 1.5`.

## Spacing

One 4-based scale. Do not introduce off-scale values.

| Token | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 20 |
| `--space-6` | 24 |
| `--space-8` | 32 |
| `--space-10` | 40 |
| `--space-12` | 48 |
| `--space-16` | 64 |

## Radius

Restrained; pills only for badges/avatars. No blanket rounding.

| Token | px | Use |
|---|---|---|
| `--radius-sm` | 6 | inputs, small controls, badges |
| `--radius-md` | 8 | buttons, cards |
| `--radius-lg` | 12 | large cards, dialogs, hero panels |
| `--radius-pill` | 9999 | status pills, avatars only |

## Borders

`--border-width: 1px`. Default border color `--color-border`; emphasized `--color-border-strong`.
Prefer a 1px border over a shadow for separation.

## Shadows

Soft and small. Never glow.

| Token | Value (intent) | Use |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,.04)` | subtle card lift |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)` | cards, dropdowns |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.08)` | dialogs, popovers |

Dark mode uses the same tokens with slightly higher opacity (see `color-system.md`).

## Transitions

See `motion.md` for usage and reduced-motion.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | hover/press, small state |
| `--dur-base` | 180ms | most transitions |
| `--dur-slow` | 240ms | dialogs, larger surfaces |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | default |
| `--ease-out` | `cubic-bezier(0,0,.2,1)` | enter |

## Z-index

| Token | Value | Use |
|---|---|---|
| `--z-base` | 0 | content |
| `--z-sticky` | 100 | sticky header |
| `--z-dropdown` | 200 | menus, popovers |
| `--z-overlay` | 300 | dialog backdrop |
| `--z-dialog` | 310 | dialog surface |
| `--z-toast` | 400 | toasts |

## Layout widths

See `spacing-and-layout.md`.

| Token | Value | Use |
|---|---|---|
| `--layout-sidebar` | 248px | desktop sidebar |
| `--layout-max` | 1280px | content max width |
| `--layout-gutter` | `--space-8` (32) | desktop content padding |
| `--layout-gutter-sm` | `--space-4` (16) | mobile content padding |

## Control heights

| Token | px | Use |
|---|---|---|
| `--control-sm` | 32 | compact buttons, table actions |
| `--control-md` | 36 | default buttons, inputs |
| `--control-lg` | 44 | primary CTAs, mobile touch targets |

Mobile interactive targets are at least 44×44 (see `accessibility.md`).
