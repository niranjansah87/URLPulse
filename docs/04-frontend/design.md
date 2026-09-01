# UrlPulse - Design Specification

**Status:** Source of truth for frontend visual language
**Reference:** `design_reference/dashboard.png` (see `reference/frontend/README.md`)

This is the main design document. It defines the visual language; the sibling documents
define the specifics (tokens, color, type, spacing, components, motion, responsive,
accessibility, states). Where a number is involved, `design-tokens.md` is authoritative
and the other documents reference token names rather than repeating values.

---

## Design direction

**Quiet confidence.**

UrlPulse should look like a product built by experienced product engineers and designers
- premium through spacing, typography, alignment, and restraint, not through visual
effects. It is a monitoring instrument: calm, precise, trustworthy. The interface stays
out of the way so URL status, batch progress, and actions are always the loudest thing on
screen.

It is **not** an effects showcase. No gradients everywhere, no glassmorphism, no neon, no
floating 3D, no decorative motion.

## Design goals

- **Clarity** - every screen answers "what is happening and what can I do" immediately.
- **Hierarchy** - the eye lands on status and progress first, chrome last.
- **Trust** - restrained, consistent, correct; nothing feels risky or gimmicky.
- **Speed perception** - fast paint, skeletons over spinners, motion that confirms activity.
- **Low cognitive load** - few colors, generous whitespace, predictable patterns.
- **Professional polish** - details (alignment, tabular numbers, focus rings) are correct.
- **Consistency** - one coherent product, not a collection of styles.

## Design principles

### 1. Restraint creates premium
Prefer fewer visual effects, not more. Depth comes from borders, subtle shadow, spacing,
and tonal contrast - never from glow, heavy shadow, or glass.

### 2. Content comes first
Decoration must never compete with URL status, batch progress, errors, actions, or key
metrics. Illustrations sit behind or beside content, never on top of it.

### 3. One primary accent
Blue is the brand accent and marks *interaction and attention* (links, active nav,
in-progress state, focus). It is not painted onto every surface. Green/amber/red are
**state**, not branding. Note (from the reference): the primary **button** is a neutral
near-black solid in light mode and a blue solid in dark mode - blue guides attention, the
solid button commits an action. See `color-system.md`.

### 4. Depth is subtle
Borders and soft shadows over huge shadows, glowing cards, glassmorphism, or neon.

### 5. Animation communicates state
Motion explains progress, activity, transition, and completion - "alive, not animated."
It never exists merely to impress, and it always respects `prefers-reduced-motion`. See
`motion.md`, including the signature monitoring-pulse.

### 6. Consistency over novelty
Reuse established patterns and tokens. A new component earns its place only when an
existing one genuinely cannot serve.

## What the reference establishes

Clean white sidebar + off-white canvas; compact top header with search and a dark primary
action; a calm hero band with a subtle browser/leaf illustration; four metric cards with
sparklines; and a highly scannable recent-batches table with soft status pills and colored
progress bars. Premium comes from spacing, alignment, and micro-interaction - keep it so.

## Implementation contract

**The frontend implementation should reproduce the visual intent of these specifications
rather than inventing a new visual direction.**

**When implementation and design documentation disagree, the design documentation should
be updated intentionally rather than silently diverging.**
