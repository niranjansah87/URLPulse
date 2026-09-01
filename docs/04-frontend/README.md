# Frontend Documentation

Design and architecture docs for the UrlPulse frontend. The **visual source of truth** is
the reference at `reference/frontend/README.md` (image: `design_reference/dashboard.png`);
these documents encode the rules extracted from it.

## Design system

- [Design](./design.md) - visual language, direction ("quiet confidence"), goals, principles
- [Design Tokens](./design-tokens.md) - **authoritative numeric values** (colors, type, spacing, radius, shadow, motion, z-index, layout, controls)
- [Color System](./color-system.md) - light/dark palettes and status mapping
- [Typography](./typography.md) - type hierarchy, URLs, metrics
- [Spacing & Layout](./spacing-and-layout.md) - frame, cards, grids, tables, whitespace
- [Components](./components.md) - shell, sidebar, buttons, cards, badges, progress, tables, URL results, dialogs, toasts
- [Motion](./motion.md) - restrained motion + the signature monitoring pulse
- [Responsive Design](./responsive-design.md) - desktop → mobile behavior and priority
- [Accessibility](./accessibility.md) - WCAG 2.1 AA; status never by color alone; reduced motion
- [Empty / Loading / Error States](./empty-loading-error-states.md) - deliberate state language
- [Frontend Design Principles](./frontend-design-principles.md) - DO/DON'T implementation checklist

## Architecture

- [Frontend Architecture](./frontend-architecture.md) - app structure, Server/Client boundaries, data flow
- [Live Updates](./live-updates.md) - SSE transport, reconnection, refresh-safe state

## Conventions

`design-tokens.md` is the single source for numeric values; other documents reference token
names, never raw values. When implementation and these docs disagree, update the docs
intentionally - do not diverge silently. Values align with `apps/web/app/globals.css`.
