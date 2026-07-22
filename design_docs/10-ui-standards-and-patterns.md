# Canvas Power Tools — 10: UI Standards and Patterns

---

## Status

**Design language: TBD — pending Stitch redesign.**

This document previously contained the visual design language (typography, spacing tokens, color system, component ledger, interaction grammar, archetypes). Those prescriptions have been stripped. The new design language will be defined from Stitch and documented here before any UI implementation begins.

Do not implement visual decisions from a previous version of this document.

---

## Accessibility Requirements (Non-Negotiable)

Canvas Power Tools targets WCAG 2.1 AA compliance. This is a baseline requirement for educational technology software — not a post-launch enhancement.

### Keyboard Navigation

- Every interactive element reachable via keyboard alone
- Tab order follows logical reading sequence
- Focus always visually visible (via `:focus-visible`)
- Modals trap focus while open; restore focus to the trigger element on close
- `Escape` closes modals and dismisses overlays
- `Enter` / `Space` activate focused controls

### Screen Reader Support

- All icons have `aria-label` or are `aria-hidden` with a visible text alternative
- Dynamic content (toasts, loading states, table updates) announced via `aria-live` regions
- Form inputs have associated `<label>` elements
- Error messages linked to their inputs via `aria-describedby`

### Virtual Scroll Table ARIA

Required whenever the assignment table is rendered:

- `role="grid"` + `aria-label` + `aria-rowcount` + `aria-multiselectable` on `<table>`
- `aria-rowindex` on every `<tr>` (header row = 1)
- `aria-sort="ascending|descending|none"` on sortable `<th>` elements
- `aria-selected` on each data row
- Checkbox `aria-label`: `"Select {assignment name}"`; select-all: `"Select all assignments"`

### Modal Accessibility

Required on every modal (preview, confirm, PIN prompt):

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing to the modal heading
- Focus moves to the first interactive element on open
- Tab cycles only within the open modal
- Focus returns to the trigger element on close

### Toast Accessibility

- Toasts injected into a pre-existing, never-removed `aria-live` region in the shell
- Success / Info: `aria-live="polite"`
- Warning / Error: `aria-live="assertive"`

### Color and Contrast

- Minimum 4.5:1 contrast ratio for all text (WCAG AA)
- Information never conveyed by color alone — icons or text always accompany color-coded indicators

### Motion

- Respect `prefers-reduced-motion` — all animations and transitions disabled or minimized when set

### Text Size Scaling

- All text, padding, margin, and layout measurements use `rem` so the Settings text-size option scales the entire UI proportionally
- `px` only for borders (1–2px) and focus ring outlines (3px)
- Never `px` for font-size or content sizing

### Navigation Landmarks

- The primary nav uses `<nav aria-label="Canvas Power Tools navigation">`
- A visually hidden "Skip to main content" link is the first focusable element on every page; it becomes visible on focus

### Custom Dropdowns / Popovers

- Close on outside click and on `Escape`
- Use `pointerdown` + `keydown` listeners on `document`; check containment via `ref.contains(e.target)`
- Restore focus to the trigger when the panel closes
- Do not use a transparent backdrop `<div>` — it blocks other interactive elements

### Canvas Injection

- Every injected button has a descriptive `aria-label` if its visible text is not fully descriptive
- Injected elements do not alter the tab order of existing Canvas elements unexpectedly
- Injected panels that overlay Canvas content use `role="dialog"` with `aria-modal="true"`

---

## Cognitive Accessibility Principles

Behavioral requirements independent of visual design.

- **Preview before write** — no bulk operation executes without showing the teacher exactly what will change
- **Revert everything** — every write operation is recoverable from the change log
- **Explicit error messages** — every error state has a specific cause and a specific next step; generic "something went wrong" is not permitted
- **No time limits** — no interactive element expires or auto-submits based on inactivity (sole exception: the 5-second send delay in Communication Tools — a documented safety feature, see Doc 14)
- **Session recovery** — last-used Module, Tool, and sidebar state stored in `sessionState` in `chrome.storage.local`; reopening after a crash returns to the same context

---

## Error Response Matrix

| Scenario | Message | Actions |
|---|---|---|
| Network offline on load | Offline state screen | Retry |
| Canvas API 500 error | "Canvas is having issues. Try again in a moment." | Retry |
| Token expired mid-session | Token failure modal | Redo Setup |
| Single assignment fails in bulk op | Warning toast + listed in result screen | View Details |
| All assignments fail in bulk op | Error toast + full result screen | Try Again |
| Rate limit hit | Persistent banner — "Syncing at reduced speed. Resuming shortly." | Automatic |
| Fetch timeout | "Request timed out. Canvas may be slow." | Retry, Adjust timeout in Settings |
| Template deploy fails one course | Warning in deploy result screen | Retry for that course |
| Revert fails one assignment | Listed in revert summary report | Noted |
| Canvas URL unreachable | "Cannot reach your Canvas instance." | Check URL in Settings |
| Storage write fails | "Could not save your changes locally." | Retry, Export settings |
| Selector failure on inject | Fallback floating button + health notice | Report Issue |

---

## Empty State Copy

| Screen | Title | Body | Actions |
|---|---|---|---|
| Bulk Editor — no assignments | "This course has no assignments yet." | "Create your first assignment in Canvas, or deploy an assignment from a template to get started." | Open Template Library |
| Bulk Editor — no filter results | "No assignments match your filters." | "Try adjusting or clearing your active filters." | Clear All Filters |
| Template Library — first use | "Your template library is empty." | "Templates let you save assignment structures and reuse them across courses and semesters." | Create Your First Template, Save from Canvas Assignment |
| Template Library — no search results | "No templates match your search." | — | Clear Search |
| Change Log — no entries | "No changes recorded yet." | "When you apply bulk changes in the editor, they will appear here with the option to revert." | — |
| Settings — no courses found | "Could not load your Canvas courses." | "This may be a connection issue or your token may need to be refreshed." | Verify Connection, Redo Setup |

---

## Keyboard Shortcuts

### Global — Any Extension Page

| Shortcut | Action |
|---|---|
| Escape | Close modal, dismiss toast, cancel action |
| ? | Open keyboard shortcut reference |
| Ctrl + , | Open Settings |

### Bulk Editor

| Shortcut | Action |
|---|---|
| Ctrl + A | Select all visible assignments |
| Ctrl + Shift + A | Deselect all |
| Ctrl + Enter | Open Preview Changes |
| Ctrl + F | Focus search bar |
| Ctrl + Shift + F | Clear all filters |

### Template Library

| Shortcut | Action |
|---|---|
| Ctrl + N | New template |
| Ctrl + F | Focus search bar |

### Modals

| Shortcut | Action |
|---|---|
| Escape | Cancel and close |
| Enter | Confirm (when confirm button is focused) |

---

## Loading State Rules

- **Assignment table:** skeleton loading — placeholder rows in the shape of real content
- **Everything else:** spinner
- **Bulk operations:** show per-item status in real time so the teacher sees exactly where things stand
- **Long async writes (> 2s):** count indicator (e.g. "8 of 14")

---

## Toast Behavior Rules

- Maximum 3 toasts visible simultaneously; additional toasts queue
- Hovering pauses auto-dismiss countdown
- Every toast has a dismiss button
- Toasts with action buttons never auto-dismiss
- Auto-dismiss: Success and Info (default 5 seconds, configurable in Settings)
- Persistent until dismissed: Warning and Error

---

## Testing Checklist (Before Any Feature Ships)

- [ ] Keyboard-only navigation: every element reachable, focus always visible, modals trap and restore focus
- [ ] NVDA screen reader (Windows, free): labels, table relationships, toasts, modal titles, and errors all announced correctly
- [ ] axe DevTools: no critical or serious violations
- [ ] Reduced motion: all animations disabled when OS setting is enabled
- [ ] All four text sizes (Small / Medium / Large / Extra Large): no overflow, truncation, or layout breakage

---

## Internationalization

Canvas Power Tools ships in English only at launch. Localization is revisited once real user data shows demand.
