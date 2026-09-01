# UrlPulse Frontend Visual Reference

These images are the **primary visual source of truth** for the UrlPulse frontend.

## Canonical reference — Dashboard

Both themes are present:

```
reference/frontend/dashboard/dashboard-light.png
reference/frontend/dashboard/dashboard-dark.png
```

They define the app frame (sidebar, header, content), the hero with the signature
monitoring waveform, the metric cards, and the scannable recent-batches table. The dark
render additionally shows an Overall Health donut and a Live Activity feed. See
[`dashboard/README.md`](./dashboard/README.md).

> Theme note: the primary button is **near-black in light mode** and **blue in dark mode**;
> blue always marks interaction/state. Details in `docs/04-frontend/color-system.md`.

## Page reference folders

Each page has a folder for its light/dark reference renders. **Do not fabricate screenshots** —
add real renders as they are produced.

| Folder | Page | Route |
|--------|------|-------|
| [`landing_page/`](./landing_page) | Public landing page | `/` |
| [`login/`](./login) | Sign in (two-column auth family) | `/login` |
| [`sign-up/`](./sign-up) | Create account | `/signup` |
| [`forgot_password/`](./forgot_password) | Request a password-reset link | `/forgot-password` |
| [`reset-password/`](./reset-password) | Set a new password from a reset link | `/reset-password?token=…` |
| [`notfound/`](./notfound) | Public 404 | any unknown route |
| [`dashboard/`](./dashboard/README.md) | Dashboard / batch list | `/batches` |
| [`create-batch/`](./create-batch/README.md) | Batch creation (manual + CSV) | `/batches/new` |
| [`batch-detail/`](./batch-detail/README.md) | Single batch: progress, results, actions | `/batches/[id]` |
| [`history/`](./history/README.md) | Historical batches | `/history` |
| [`alerts/`](./alerts/README.md) | Alerts | `/alerts` |
| [`settings/`](./settings/README.md) | Settings | `/settings` |
| [`states/`](./states/README.md) | Empty / loading / error / completion states | `/batches/states` (showcase) |
| [`components/`](./components/README.md) | Component-level reference notes | — |

Illustrations used by these pages live in [`public/illustration/`](../../public/illustration)
(`urlpulse-dashboard-illustration-{light,dark}`, `login-light`, `signup-{light,dark}`,
`forgot-password-{light,dark}`, `reset-password-{light,dark}`, `reset-password-success-dark`,
`not-found-dark`). Where only one theme variant exists, the page falls back to the dashboard
illustration for the other theme.

## How to use this reference

- Implementation should match the reference's **layout, hierarchy, spacing, color,
  typography, and interaction intent** — not just approximate it.
- The reference is **more authoritative than generic UI conventions**. When a common SaaS
  pattern conflicts with the reference, follow the reference.
- The written specs in `docs/04-frontend/` encode the rules extracted from these images.
  Read them alongside the reference.
- **Changes to the visual direction must be documented** in `docs/04-frontend/` (and noted
  here if a reference image changes) — never diverge silently.

## Related

- Design system: [`docs/04-frontend/`](../../docs/04-frontend/README.md)
- Component notes: [`components/README.md`](./components/README.md)
- Brand assets (source of truth): [`public/brand/`](../../public/brand)
