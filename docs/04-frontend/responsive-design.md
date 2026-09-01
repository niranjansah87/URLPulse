# UrlPulse - Responsive Design

Do not merely shrink the desktop UI. Each breakpoint has intentional behavior. Spacing
tokens and layout widths come from `design-tokens.md` / `spacing-and-layout.md`.

---

## Breakpoints

| Name | Range | Frame |
|---|---|---|
| Large desktop | ≥ 1280px | fixed sidebar; content centered at `--layout-max` |
| Desktop | 1024–1279px | fixed sidebar; fluid content, `--layout-gutter` |
| Tablet | 768–1023px | sidebar collapses to icon rail or drawer; content fluid |
| Mobile | < 768px | sidebar → drawer behind a header menu button; single column |

## Element behavior

- **Sidebar:** desktop fixed (248px) → tablet icon rail (labels on hover) or drawer →
  mobile off-canvas drawer opened from a header hamburger; branding becomes the mark.
- **Header:** search collapses to a search icon that expands on tap (mobile); primary
  action stays reachable (may become an icon or move into the mobile action bar).
- **Metric cards:** 4-up desktop → 2-up tablet → 1-up (or a horizontal snap-scroll row)
  mobile. Preserve card padding; don't crush numbers.
- **Batch table → cards on mobile:** below tablet, each batch row becomes a stacked card
  showing, in priority order: **status, progress, name/id, key counts**; secondary columns
  (Created, Duration) move under a details disclosure or into the detail view.
- **Filters:** inline on desktop → a "Filter" button opening a sheet/menu on mobile.
- **Actions:** row `…` menu on desktop → explicit buttons or a bottom action bar on mobile;
  keep destructive actions clearly separated.
- **Charts/sparklines:** keep sparklines (they're tiny); drop non-essential visuals before
  cramping content.
- **Batch detail:** two-column (summary + results) on desktop → stacked on mobile with
  progress and actions pinned near the top.
- **URL result rows:** table on desktop → stacked cards on mobile (URL, status, latency,
  state, timestamp), URL truncated with tap-to-expand.

## Mobile priority order

1. Batch status
2. Progress (bar + %/count)
3. Important actions (cancel, retry-failed)
4. URL results

Secondary information (durations, timestamps, deltas) may collapse into detail views or
disclosures.

## Rules

- Touch targets ≥ 44×44 (`accessibility.md`).
- Preserve whitespace - compress the scale, don't delete it.
- Content max-width keeps line length readable on large screens; don't stretch tables edge
  to edge on ultra-wide.
- Test light and dark at every breakpoint (`color-system.md`).
