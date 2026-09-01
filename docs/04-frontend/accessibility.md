# UrlPulse - Accessibility

Target: **WCAG 2.1 AA**. Accessibility is part of "premium" - it is not optional polish.

---

## Keyboard navigation

- Every interactive element is reachable and operable by keyboard in a logical order.
- Visible focus on all focusable elements (see Focus states). No positive `tabindex`.
- Skip-to-content link at the top of the page.
- Dialogs trap focus, close on `Escape`, and return focus to the trigger.
- Menus (`…`, filter, profile) are arrow-key navigable; `Enter`/`Space` activate.
- The search shortcut (`Ctrl/⌘ K`) is discoverable and has a non-shortcut path.

## Focus states

- 2px `--color-focus` ring with a 2px offset, visible in both themes; never remove outlines
  without an equivalent visible replacement.
- Use `:focus-visible` so mouse users aren't distracted but keyboard users always see focus.

## Color & contrast

- Body text ≥ 4.5:1; large text and UI component boundaries ≥ 3:1 - light and dark.
- Muted text is for non-essential metadata only and must still meet contrast.
- Verify status pill foreground on its subtle background in both themes.

## Status is never color alone

Always pair state with a text label and/or icon/shape:

- **Do not:** green fill = completed.
- **Do:** `✓ Completed` (green as supporting cue); `✕ Failed`; `◗ In Progress`;
  `− Cancelled`. Progress conveys value via `%` and `x / total`, not just bar color.
- HTTP status classes carry a label/number, not only a color.

## Semantic HTML

- Real landmarks: `header`, `nav`, `main`, `aside`, `footer`.
- One `h1` per page; headings nested in order (no skipping levels for style).
- Tables use `table`/`thead`/`th[scope]`; if a "table" becomes cards on mobile, preserve
  semantic labels per field.
- Buttons are `<button>`; links are `<a>`. Never a `div` with a click handler for actions.

## Screen-reader support

- Icon-only buttons (`…`, theme toggle, close) have `aria-label`.
- Live regions: batch progress and status updates announce via `aria-live="polite"`;
  connection-state changes (reconnecting) announce politely; errors use `role="alert"`.
- Decorative illustrations (hero browser/leaf, background motifs, sparklines that duplicate
  a visible number) are `aria-hidden`; informative visuals have text alternatives.
- Loading skeletons expose an accessible "Loading…" state; don't leave SR users in silence.

## Accessible status indicators

The signature pulse and running badge are decorative reinforcements; the authoritative
state is always available as text (label + %/count) for assistive tech.

## Reduced motion

- Honor `prefers-reduced-motion: reduce`: disable the pulse loop, shimmer, success draw,
  and transitions; present the correct static state (see `motion.md`).
- A user-facing motion toggle may supplement the OS setting but never overrides "reduce".

## Forms & validation

- Every input has a visible, programmatically associated `<label>`.
- Errors: `aria-invalid`, an `aria-describedby` message, text + icon (not color only),
  placed next to the field; summarize multiple errors and move focus to the first.
- CSV upload states (selected file, parse errors) are announced and shown as text.
- Required fields and constraints are stated, not implied.

## Error messaging

Errors explain what happened and what to do next (see `empty-loading-error-states.md`),
never a bare "Something went wrong". Infrastructure detail/stack traces are never shown.
