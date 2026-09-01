# Component References

Component-level visual references extracted from the dashboard reference
(`../dashboard/dashboard-light.png`, `../dashboard/dashboard-dark.png`). Full component
rules live in [`docs/04-frontend/components.md`](../../../docs/04-frontend/components.md);
this file records what the reference shows so implementers can cross-check.

## Observed in the reference

- **Sidebar** - ~248px; logo (mark + wordmark) top; nav items icon+label with the active
  item as a soft blue-tinted row (blue icon/text); user/profile row and a theme toggle at
  the bottom.
- **Top header** - greeting/search; a notification bell (with unread badge); a primary
  **New Batch** button.
- **Hero band** - bold two-line headline, supporting text, and a subtle browser-window +
  monitoring-waveform + winding URL-path illustration.
- **Metric cards** - soft-tinted icon tile, large tabular number, label, delta line
  (green up / red down), and a thin sparkline. Four across on desktop.
- **Status badges** - small soft-tinted pills: In Progress (blue), Completed (green),
  Failed (red).
- **Progress bars** - thin rounded bar on a track, colored by state, with `%` to the right;
  `x / total` shown separately.
- **Recent batches table** - column headers, generous row height, subtle row separators,
  **no vertical separators**, a `…` actions menu, and pagination.
- **Dark-only panels** - an **Overall Health** donut (success-rate breakdown) and a
  **Live Activity** feed (recent checks with status + relative time). Both are
  informational, not decorative.

## Theme-dependent

- **Primary button:** near-black in light mode, **blue in dark mode**.
- Canvas/surfaces/borders invert per `docs/04-frontend/color-system.md`; blue accent stays
  the interaction/state color in both themes.

Standalone per-component reference crops can be added to this folder as they are produced.
Do not fabricate them.
