# UrlPulse — Empty, Loading & Error States

These states are deliberate parts of the product, not afterthoughts. Each gives context and
a next step. Visuals use tokens (`design-tokens.md`, `color-system.md`); motion per
`motion.md`; all states meet `accessibility.md`.

Structure of a state block: **icon/illustration (subtle) · title · one-line explanation ·
action (when one exists)**.

---

## Loading

- **Initial page load:** layout-aware **skeletons** (gray blocks matching the real
  sidebar/cards/table), gentle shimmer. Prefer skeletons over spinners so the shape of the
  page is predictable. Announce "Loading…" for SR.
- **Skeleton detail:** skeletons mirror final layout (metric cards, table rows) to avoid
  layout shift.
- **In-place refresh:** a subtle top progress/activity hint, not a full-screen spinner.

## Empty

- **Empty batch list (first run):** thin monitoring-line illustration, "No batches yet",
  "Submit a list of URLs and UrlPulse will start checking them.", primary **Create your
  first batch**. Intentional, not "missing UI".
- **No URL results (in a batch):** explain the batch has no results yet or none match the
  current filter; offer to clear the filter.
- **No search/filter matches:** "No batches match your filters." + Clear filters.

## Processing / live

- **Batch processing:** show live progress (bar + `%` + `x / total`), a running badge, and
  the signature pulse (one instance). Convey activity via state, not a spinner.
- **Reconnecting live updates:** a quiet inline banner "Reconnecting…" (polite live region);
  data stays visible and is reconciled from the API on reconnect — the UI never claims to be
  live when it isn't. State remains readable if updates pause.

## Completion states

- **Batch completed:** success badge + brief, quiet confirmation (see `motion.md`); results
  remain; offer download/export.
- **Batch failed (all/most):** error badge, a plain-language summary (e.g. "12 of 12 URLs
  failed"), the dominant error class if clear, and **Retry failed** as the primary action.
- **Partial failure:** neutral/mixed framing ("85% completed · 15 failed"); make **Retry
  failed** obvious and scoped to failed URLs only; successes are not re-run.
- **Cancellation:** cancelled badge, "Batch cancelled", show what completed before cancel;
  no alarming red — cancellation is a normal outcome (muted, not error styling).

## Error states

Every error: **what happened · why (if useful) · what to do next**. Never a bare
"Something went wrong!"; never leak stack traces or internal details.

- **Network error:** "Can't reach UrlPulse. Check your connection." + Retry.
- **API error (4xx/5xx):** human message mapped from the API `error.code` (see
  `docs/03-backend/api.md`), plus Retry or a corrective action; keep the user's input.
- **Validation error (batch creation/CSV):** inline, per-field, text + icon; summarize
  multiple; focus the first (see `accessibility.md`).
- **Not found (batch id):** "This batch doesn't exist." + link back to Batches.
- **Toasts** carry transient errors; **inline** carries contextual/blocking errors.

## Consistency

- One illustration language across empty/error states (thin technical line motifs; see
  background rules in `frontend-design-principles.md`) — no stock "oops" graphics.
- Same title/explanation/action rhythm everywhere so states feel like one product.
