# Dashboard - Visual Reference

The **primary** reference screen and the source of truth for the overall visual language.

| File | Theme |
|------|-------|
| `dashboard-light.png` | Light |
| `dashboard-dark.png` | Dark |

## What it establishes

- App frame: left sidebar (logo, nav, user/profile, theme toggle) + content area.
- Compact top header: greeting/search, notifications, primary **New Batch** action.
- Hero band with the signature monitoring waveform + winding URL-path illustration.
- Four metric cards (Total, Completed, In Progress, Failed) with sparklines + deltas.
- Recent Batches table: status pills, colored progress bars, `x / total`, actions, pagination.
- Dark theme also shows an **Overall Health** donut and a **Live Activity** feed.

## Theme note (important)

- **Light mode:** primary button is a neutral near-black solid.
- **Dark mode:** primary button is **blue** (the accent).

Blue always marks interaction/state (links, active nav, in-progress, focus). See
`docs/04-frontend/color-system.md`.
