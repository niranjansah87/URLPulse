# UrlPulse — Typography

Sizes/weights/line-heights are token names from `design-tokens.md`. Typography should feel
modern, technical, highly readable, and understated — restraint over marketing scale.

---

## Families

- **`--font-sans`** — a modern grotesque/geometric UI sans (Inter, Geist, or the system
  stack already in `globals.css`). Used for essentially all UI text.
- **`--font-mono`** — a readable monospace (e.g. `ui-monospace, "SF Mono", "JetBrains Mono"`).
  Used for HTTP status codes, latency values, batch ids (`#batch_24`), and anywhere digit
  alignment matters. Enable `font-variant-numeric: tabular-nums` for all metrics, table
  numbers, progress %, and durations.
- A decorative script face appears in the reference only for the single hero flourish
  ("A healthier web, together."). It is optional, cosmetic, and must never be used for UI
  or content text.

## Hierarchy

| Role | Size | Weight | LH | Notes |
|---|---|---|---|---|
| Display / hero | `--text-4xl` (36) | bold | tight | hero headline only; two lines max |
| Page title | `--text-2xl` (24) | semibold | snug | one per page |
| Section heading | `--text-lg` (18)–`--text-xl` (20) | semibold | snug | e.g. "Recent Batches" |
| Card heading | `--text-md` (15)–`--text-lg` (18) | semibold | snug | metric label is separate (below) |
| Body | `--text-base` (14) | regular | normal | default |
| Secondary text | `--text-sm` (13) | regular | normal | supporting copy, subtitles |
| Metadata | `--text-xs` (12) | regular | normal | timestamps, counts, "from last 7 days" |
| Table text | `--text-base` (14) | regular | snug | cells |
| Label / overline | `--text-xs` (12) | medium | — | UPPERCASE, letter-spacing ~.06em (e.g. "WELCOME BACK", column headers) |
| Button | `--text-base` (14) | medium | — | no all-caps |
| Status text (pill) | `--text-xs` (12) | medium | — | paired with icon |
| Code / URL | `--text-sm` (13) | regular | snug | `--font-mono` for status codes/ids; URLs may be sans but must wrap/truncate cleanly |
| Metric number | `--text-3xl` (30) | semibold | tight | tabular-nums; strong but not oversized |

## URLs

URLs must be easy to scan: single line with middle/end truncation (`text-overflow: ellipsis`)
and the full value in a tooltip/`title`. Keep left-aligned, do not wrap mid-token in tables;
allow wrapping in detail views. Never rely on color alone to mark a URL's state.

## Numbers & metrics

Metric values (24, 16, 5, 3), progress %, `x / total`, latency, and durations use
`tabular-nums` so columns align. Give the metric number clear hierarchy via weight/size —
not by making it huge. Deltas ("+2%", "-25%") use `--text-xs` with a direction icon and the
matching status foreground color.

## Rules

- No oversized in-app marketing type; the hero headline is the single large moment.
- Prefer weight and color over size to signal hierarchy.
- Line length for reading copy ≤ ~72ch.
- Respect the user's font-size settings; use `rem`-based sizing in implementation.
