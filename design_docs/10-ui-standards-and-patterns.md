# Canvas Power Tools — 10: UI Standards and Patterns

---

## Status

**Design language: Adopted — selectable full-palette themes (`canvas-power-tools-l0l`).**

This replaces the prior "TBD — pending Stitch redesign" placeholder (see doc 17, superseded). Rollout is per-tool via the "Full UI overhaul" Beads epic (`canvas-power-tools-1yr` and its `Rebuild <Tool> UI` subtasks) — a shipped Tool only matches this spec once its rebuild task is closed. Do not assume the rest of this codebase matches this section until then.

The prior single runtime-customizable brand accent (`--cpt-color`, hue-rotated by the old `applyTheme(hex)`) is retired in favor of complete, hand-tuned theme packages — no per-color user customization. This resolves the shadow/domain-accent tension previously noted here: each theme owns its own complete token set (colors, shadows, radii), swapped via a `data-theme` attribute the same way `html.dark` already overrides tokens today. `canvas-power-tools-4of` (pre-paint FOUC fix) is superseded — there is no runtime ramp generation left to flash.

**Mechanism — implemented:** `applyPalette(name)` (`src/utils/color.js`) sets `data-theme` on `<html>` and persists to `localStorage`; `public/theme-init.js` applies it pre-paint. Settings > Style writes `prefs.palette`. `[data-theme="bauhaus"]` in `global.css` overrides the semantic/structural tokens (`--color-bg-page`, `--color-border`, `--cpt-color`, `--shadow-*`, `--radius-control`, `--radius-card`) that the shared component layer (`.btn`, `.input`, `.card`, `.segmented-control`) reads. **Not yet done:** any tool whose JSX uses raw Tailwind utility classes (`rounded-lg`, `shadow-sm`, etc.) directly instead of those shared classes won't visually respond to the theme switch until its own rebuild (`canvas-power-tools-1yr.4`) migrates it onto the tokens.

**Pattern for Bauhaus-only visual mechanics:** several rules in this doc (domain accent strips, data-table header/toolbar treatment, bordered badges) apply under Bauhaus only and are explicitly a no-op under Default. These are implemented the same way each time — a base class in `global.css` with an inert default (`border-width: 0`, `background: transparent`, etc.), then a `[data-theme="bauhaus"] .the-class { ... }` override that turns it on. See `.domain-accent`, `.table-header-cell`, `.table-toolbar`, `.badge-pill`. Per-tool rebuilds should reuse this pattern rather than branching on theme in JS.

### Themes

| Theme | Settings value | Status |
|---|---|---|
| Bauhaus | `palette: "bauhaus"` | **Shipped default.** Flat, no shadows, fixed per-Module domain accent colors. |
| Default | `palette: "default"` | Accessible & Ethical style (see below). Existing warm-grey/primary token system, formalized as the second theme option. |

Both themes keep the same behavioral rules (accessibility, error copy, empty states, keyboard shortcuts, loading/toast behavior) documented later in this file — those are theme-independent.

---

## Typography (cross-theme)

- **Status: heading face deferred.** `h1`–`h6` currently render in **Inter** — same as body — via `--font-heading: var(--font-body)`. This is a placeholder, not a decision: a distinct heading face is still wanted, just not picked yet. Two options were tried and reverted — Oswald (condensed display sans, read too far from Inter) and IBM Plex Mono (monospace-leaning, didn't land visually) — Courier New was considered and rejected outright (system-fallback typewriter face, low x-height, clashes with Inter's grotesque body). Revisit later; swapping the pairing in is a one-line change to `--font-heading` in `global.css`.
- **Body copy, controls, table cells:** **Inter**, with `font-optical-sizing: auto` and stylistic sets `cv02`/`cv03`/`cv04` enabled.
- Self-hosted via `@fontsource/inter` (bundled at build time — no runtime font CDN, per the project's security rules). Weights loaded: 400/500/600/700/900.

## Categorical Color Coding (cross-theme)

Distinct from the per-Module **domain** colors (§2 below, Bauhaus-only, fixed meaning) — this is for coloring items from an *open-ended, teacher-defined* set, e.g. Canvas Assignment Groups, where there's no fixed palette to hand-assign. Same mechanism should be reused for any future "arbitrary category → consistent color" need (Modules-by-course, custom tags, etc.), not just assignment groups.

- **Palette:** `--color-cat-1` … `--color-cat-8` in `global.css`. Eight hues, theme-independent (unlike Bauhaus mechanics, category color coding stays on under Default too).
- **Assignment:** `getGroupColor(id)` (`src/utils/groupColors.js`) — a djb2 string hash of the item's own id, modulo palette length. Same id always resolves to the same color regardless of fetch order, filtering, or reload. Not cryptographic; used only for display.
- **Usage:** a small color tick/swatch next to the item's name — decorative (`aria-hidden`), since the name text already carries the meaning (WCAG 1.4.1 — color is never the only signal). See `AssignmentTable`'s Group column for the reference implementation.

---

## Theme: Bauhaus (v2.4.0)

All colors below are defined as CSS custom properties in `src/styles/global.css` (Bauhaus token block) — components reference them via `var(--token-name)`, never raw hex, per the project's standing token convention.

### 1. Zero Shadow & Flat Surfaces

- Strictly ban all drop-shadows, glow filters, blur backdrops, ambient radial gradients, and glassmorphism.
- Containers, cards, dialogs, popups, and inputs sit flat on a 1px border: `border border-[var(--color-stroke)]` or `border border-[var(--color-stroke-soft)]`.
- Corner radii restricted to `rounded-[var(--radius-none)]`, `rounded-[var(--radius-xs)]`, or `rounded-[var(--radius-sm)]`. Never use `rounded-lg`, `rounded-xl`, or `rounded-2xl`.

### 2. Canvas Grid & Domain Accent Strips

- Canvas background: `bg-[var(--color-canvas-paper)]`
- Secondary container fill: `bg-[var(--color-container-inset)]`
- Interior input fill: `bg-[var(--color-bg-surface)]` (white)
- A 4px solid top border (`border-t-4`) denotes the Module a surface belongs to:

| Module | Token |
|---|---|
| Assignments / Core | `var(--color-domain-assignments)` (Cobalt Blue) |
| Grading / Analytics | `var(--color-domain-grading)` (Emerald Green) |
| Communication | `var(--color-domain-communication)` (Purple) |
| People | `var(--color-domain-people)` (Orange) |
| Content | `var(--color-domain-content)` (Teal) |
| Setup / System | `var(--color-domain-setup)` (Dark Slate) |
| Alerts / destructive | `var(--color-domain-alert)` (Bauhaus Red) |

### 3. Color Tokens

| Token | Hex | Purpose |
|---|---|---|
| `--color-canvas-paper` | `#FAF9F5` | page background |
| `--color-container-inset` | `#EFEEEA` | secondary container fill |
| `--color-bg-surface` | `#FFFFFF` | surface / input fill (existing token, reused) |
| `--color-stroke` | `#1B1C1A` | primary 1px border, high-contrast text |
| `--color-stroke-soft` | `#4A4E69` | alternate 1px border |
| `--color-grid-divider` | `#E3E2DF` | interior table dividers |
| `--color-bauhaus-red` | `#B7102A` | primary triad — red |
| `--color-bauhaus-blue` | `#485F84` | primary triad — blue |
| `--color-bauhaus-blue-bright` | `#2563EB` | primary triad — bright blue accent |
| `--color-bauhaus-ochre` | `#7A5500` | primary triad — ochre |
| `--color-bauhaus-ochre-light` | `#FEF08A` | primary triad — ochre fill (warnings, switches) |
| `--color-domain-*` | see §2 | per-Module accent strips |

### 4. Typography & Button Labels

- Font family: Inter / system sans, paired with monospace (`font-mono`) for metadata, codes, and specs.
- Action buttons and badges: uppercase, bold, tracked letter-spacing (`uppercase font-bold tracking-wider text-xs`).
- Metadata tags: monospace for dates, IDs, specs (`font-mono text-xs uppercase`, `text-[var(--color-text-secondary)]`).
- Paragraph body: `text-xs` or `text-sm`, line-height 1.5, on `var(--color-bg-surface)` or `var(--color-canvas-paper)`.

### 5. Component Taxonomy

**Input controls**
- Standard input: `bg-[var(--color-bg-surface)] border border-[var(--color-stroke)] text-xs font-mono p-2 rounded-[var(--radius-sm)] focus:ring-1 focus:ring-[var(--color-bauhaus-blue-bright)] outline-none`
- Range slider: inset track (`bg-[var(--color-container-inset)] border border-[var(--color-stroke)]`), squared thumb (`accent-[var(--color-bauhaus-red)]`, `rounded-[var(--radius-none)]`)
- Stepper: 1px-border button group `[-] [ VALUE ] [+]`, monospace numeric readout
- Date/time picker: inset field, calendar glyph trigger button
- Dropdown: inset select, monospace options, down-arrow glyph
- Switch: squared toggle (`w-10 h-5 bg-[var(--color-container-inset)] border border-[var(--color-stroke)]`) with `var(--color-bauhaus-ochre-light)` thumb

**Navigation**
- Header navbar: 1px-border sticky bar, brand square (`w-4 h-4 bg-[var(--color-bauhaus-red)] border border-[var(--color-stroke)]`)
- Menu triggers: 1px-boxed, expandable list popups
- App grid: 2D bento cards, 1px dark borders, hover color state
- Kebab / overflow menus: dropdown popovers, 1px border, `hover:bg-[var(--color-container-inset)]`
- Breadcrumbs / pagination: monospace path (`HOME / MODULES / GRADING`), stepped counters `[1] [2] [3]`
- Sub-tabs: monospace, active state `bg-[var(--color-stroke)] text-white`

**Feedback**
- Notification badges: `bg-[var(--color-bauhaus-red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--radius-xs)]`
- Activity feed: 1px vertical guide line, status-dot milestones
- Comment thread: threaded blocks, author metadata tag, timestamp, action buttons
- Tooltip: 1px-border popover, dark/light/yellow/red variants, 120ms cubic-bezier transition
- Status dots: green (published), yellow (pending), red (alert), gray (archived) — always paired with text, never color alone (see Accessibility below)

**Containers & overlays**
- Modal: titlebar (`bg-[var(--color-stroke)]` or `bg-[var(--color-container-inset)]`), `[✕]` close control, no minimize/maximize
- Destructive dialog: `border-t-4 border-t-[var(--color-domain-alert)]`, alert glyph
- Slide-over drawer: `border-l-4 border-l-[var(--color-domain-assignments)]`
- Accordion: 1px-border expandable headers, `[+]` / `[-]` toggle states

**Data tables**
- Grid frame: `.card` + `.domain-accent` (top-level container, not per-row — see §2), no shadow. Implemented on Bulk Editor's table `Card` with `--domain-color: var(--color-domain-assignments)`.
- Toolbar: `.table-toolbar` class → `bg-[var(--color-container-inset)]` + monospace, applied to `FilterBar`'s wrapper. Search, filters, and bulk-selection metrics come from the existing `FilterBar`/`BulkActionBar` — no separate density switcher exists (not in this tool's spec).
- Column headers: `.table-header-cell` class → uppercase monospace tracking-wider + `border-r border-[var(--color-grid-divider)]` (last column excluded), applied per `<th>` in `AssignmentTable`. Background already correct via the existing `--color-bg-page` token. Sort glyphs are Lucide chevrons, not `▲`/`▼` glyphs — consistent with the rest of the app's iconography.
- Rows: **not** a repeated per-row Module strip (that would just be the same color on every row, since a tool's rows all belong to one Module) — instead, per-row color coding uses the Categorical Color Coding mechanism above, keyed by Canvas Assignment Group. Bottom divider already correct via the existing `--color-border-subtle` → `--color-grid-divider` mapping under Bauhaus.
- Status cells: `Badge` atom + `.badge-pill` class — flat `--radius-sm` + 1px `currentColor` border under Bauhaus (soft tinted pill, no border, under Default). Used for Published/Unpublished in `AssignmentTable`.
- Pagination footer: **not implemented** — deliberate, not a gap. `AssignmentTable` is virtualized (`@tanstack/react-virtual`, per doc 02/06), which the project chose over paginating; a stepped pagination footer would contradict that. Row-count context instead comes from the FilterBar/toolbar area.

### 6. Mechanical Animation

- Stepped spinner: 8-tick rotation (`steps(8, end)`) — never a smooth fluid gradient spinner
- Progress meters: discrete block segments (`[■■■■■□□□]`) or 4-step fills
- Pulse indicators: discrete status dots, hairline rings
- Skeleton loaders: `bg-[var(--color-container-inset)] border border-[var(--color-stroke)] animate-pulse rounded-[var(--radius-sm)]`
- All motion still respects `prefers-reduced-motion` (see Accessibility below — non-negotiable).

### 7. Iconography

- Frame utility icons in a 1px border box: `w-8 h-8 bg-[var(--color-bg-surface)] border border-[var(--color-stroke)] rounded-[var(--radius-sm)]`
- Destructive icons: `hover:bg-[color-mix(in_srgb,var(--color-domain-alert)_15%,white)] hover:text-[var(--color-domain-alert)]`
- Settings gears rotate on hover (`group-hover:rotate-90 duration-200`)
- Sizing: micro/table `w-3.5 h-3.5`, standard `w-4 h-4`, section titles `w-5 h-5`; always `strokeWidth={2}`

### 8. Toasts & Notification Banners

- 1px border frame, 4px top color bar: success `var(--color-success)`, warning `var(--color-bauhaus-ochre-light)` fill, destructive `var(--color-domain-alert)`, info `var(--color-bauhaus-blue-bright)`
- Dismiss: top-right `[✕]`, instant unmount (no fade/shadow transition)
- All other toast behavior (max 3 visible, hover-pause, auto-dismiss timing) is unchanged — see "Toast Behavior Rules" below.

---

## Theme: Default (Accessible & Ethical)

Source: `ui-ux-pro-max:ui-styling` style database, "Accessible & Ethical" (category 8). Reuses the existing warm-grey/primary token system already in `src/styles/global.css` — no new hex values — formalized against this style's specific bar rather than replaced with a new palette.

This theme targets WCAG **AAA** (7:1 contrast), one level above the AA/4.5:1 floor required of every theme regardless of which one is active (see Accessibility Requirements below).

- **Contrast 7:1+.** The existing ramp already clears this for most text tiers: `--grey-900` (body, 16.40:1), `--grey-700` (strong, 10.58:1), `--grey-600` (secondary, 7.03:1) all pass AAA. `--grey-500` / `--color-text-muted` (4.85:1) is AA only — do not use it for body copy under this theme; reserve it for large text or decorative use per the WCAG AAA large-text exception.
- **Focus rings 3–4px.** Already matches: `:focus-visible { outline: 3px solid var(--cpt-color); }` in global.css.
- **Touch targets 44×44px minimum.** Not yet a token — add `--touch-target-min: 2.75rem` (44px at the 16px root) and apply to every tappable control (buttons, checkboxes, row actions). New requirement, not currently enforced anywhere in the codebase.
- **Base font size 16px+.** Open conflict, not resolved here: `data-text-size="medium"` (the default) is 15px, `"small"` is 13px — both under this style's floor. Text size is a user-controlled, theme-independent setting (doc 08), and letting people choose smaller text is itself an accessibility preference some users want, so this isn't a simple fix. Needs an explicit decision before this theme can claim full 16px+ compliance out of the box.
- **Reduced motion, skip links, ARIA labels, semantic HTML, color never used alone** — already standing project-wide rules (see below); this theme adds nothing new here, it just can't regress them.

**Not applicable:** Bauhaus-specific visual mechanics (flat/no-shadow surfaces, fixed corner-radius ceiling, per-Module domain accent strips, monospace metadata, Windows-98-style component taxonomy) do not carry over — Default keeps its existing rounded corners, `--shadow-*` elevation, and single warm-primary accent look.

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
