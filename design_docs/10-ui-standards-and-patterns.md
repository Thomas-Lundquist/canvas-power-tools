# Canvas Power Tools — 10: UI Standards and Patterns

---

## Overview

This document defines the UI standards that apply across every Module and
Tool in Canvas Power Tools. Any developer working on any part of the
codebase should read this document before writing a line of UI code.
These patterns are built once as shared Components and reused everywhere.

Standards are not suggestions. Deviation from them requires a documented
reason and a decision recorded in the relevant design document.

---

## Loading States

Every API call takes time. These states are shown while data is being
fetched. There are two loading patterns — skeleton loading for the main
content table and spinners for everything else.

### Rule: Skeleton for the Assignment Table

The assignment table uses skeleton loading — animated gray placeholder rows
in the shape of real content. This is more polished than a spinner for the
main content area and makes the wait feel shorter.

```
┌────┬──────────────────────┬────────┬──────────┬──────┐
│    │ ████████████████     │ ██████ │ ████████ │ ████ │
│    │ ████████████         │ ██████ │ ████████ │ ████ │
│    │ ██████████████████   │ ██████ │ ████████ │ ████ │
│    │ ████████             │ ██████ │ ████████ │ ████ │
└────┴──────────────────────┴────────┴──────────┴──────┘
```

For large courses, a count indicator accompanies the skeleton:

```
Loading assignments... 47 of 200
[████████░░░░░░░░░░░░]
```

### Rule: Spinner for Everything Else

All other loading states use a consistent spinner component.

**Course dropdown loading:**
```
[Loading courses...  ▼]
```
Dropdown is disabled until getCourses() resolves.

**After applying bulk changes — per-item progress:**
```
Applying changes to Canvas...

  Quiz 1          [Spinner]  Updating...
  Homework 3      [Check]    Updated
  Midterm         [Check]    Updated
  Quiz 2          [Spinner]  Updating...

Do not close this window until complete.
```

Each assignment shows its own status in real time. The teacher can see
exactly where things stand rather than staring at one generic indicator.

**Template deploy — multi-course:**
```
Creating assignments...

  Biology 101 — Fall 2025       [Check]    Created
  Biology 101 — Spring 2026     [Spinner]  Creating...
  Chemistry 202 — Fall 2025     [Spinner]  Waiting...
```

**Progress toast for long operations:**
Used when an operation takes more than 2 seconds. Replaces the standard
success toast during the operation.

```
┌──────────────────────────────────────────┐
│  Applying changes...                     │
│  [████████████░░░░░░░░]  8 of 14         │
└──────────────────────────────────────────┘
```
Converts to a success or warning toast on completion.

---

## Empty States

Every screen that can be empty has a specific helpful message — not a blank
white box. Each empty state is tailored to the situation and always tells
the teacher what to do next.

### Bulk Editor — No Assignments in Course

```
                    [Assignments icon]

            This course has no assignments yet.

    Create your first assignment in Canvas, or deploy
    an assignment from a template to get started.

              [Open Template Library]
```

### Bulk Editor — No Results Match Filter

```
                    [Filter icon]

            No assignments match your filters.

    Try adjusting or clearing your active filters.

         [Clear All Filters]
```

### Template Library — First Use

```
                    [Templates icon]

            Your template library is empty.

    Templates let you save assignment structures and
    reuse them across courses and semesters.

    [Create Your First Template]    [Save from Canvas Assignment]
```

### Template Library — No Search Results

```
                    [Search icon]

          No templates match your search.

    [Clear Search]
```

### Change Log — No Entries

```
                    [Clock icon]

            No changes recorded yet.

    When you apply bulk changes in the editor,
    they will appear here with the option to revert.
```

### Settings — No Courses Found

```
                    [Warning icon]

        Could not load your Canvas courses.

    This may be a connection issue or your token
    may need to be refreshed.

         [Verify Connection]    [Redo Setup]
```

---

## Notification and Toast System

A single reusable notification system used by every feature. Toasts appear
in the top right corner of the extension shell and stack if multiple fire at once.

### Four Toast Types

**Success — auto-dismisses (duration configurable in Settings, default 5s)**
```
┌──────────────────────────────────────────────────┐
│  [Check icon]  Changes applied to Canvas    [x]  │
└──────────────────────────────────────────────────┘
```

**Warning — stays until dismissed**
```
┌──────────────────────────────────────────────────┐
│  [Warning icon]  1 assignment could not be updated  [x] │
│  [View Details]                                  │
└──────────────────────────────────────────────────┘
```

**Error — stays until dismissed**
```
┌──────────────────────────────────────────────────┐
│  [Error icon]  Connection to Canvas failed  [x]  │
│  [Try Again]   [Go to Settings]                  │
└──────────────────────────────────────────────────┘
```

**Info — auto-dismisses (5 seconds)**
```
┌──────────────────────────────────────────────────┐
│  [Info icon]  3 assignments created from template  [x] │
└──────────────────────────────────────────────────┘
```

### Toast Behavior Rules

- Maximum 3 toasts visible simultaneously. Additional toasts queue.
- Toasts stack vertically from top right, newest on top.
- Hovering pauses the auto-dismiss countdown.
- Each toast has an x button for manual dismissal.
- Toasts with action buttons never auto-dismiss.
- The rate limit banner (see Error Handling section) is not a toast —
  it is a persistent page-level banner while rate limiting is active.

---

## Error Handling

Every failure has a specific designed response. No screen ever shows a vague
"something went wrong" message.

### Error Response Matrix

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

### Offline State Screen

Shown on any Tool in the extension when the browser detects no network connection.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Canvas Power Tools                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                   [Offline icon]                                │
│                                                                 │
│               You appear to be offline.                        │
│                                                                 │
│   Canvas Power Tools needs a connection to your Canvas         │
│   instance to load assignments and apply changes.              │
│                                                                 │
│   Your settings, templates, and change log are safe.           │
│                                                                 │
│                      [Try Again]                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rate Limit Banner

Not a blocking state — the teacher can continue reading the page while the
queue processes. Shown as a subtle banner at the top of the page.

```
[Hourglass icon]  Syncing with Canvas at reduced speed to avoid limits.
                  This will complete shortly.                    [x]
```

Dismissing the banner does not cancel the queue — it just hides the notice.

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
| Tab | Move between bulk action fields |
| Shift + Tab | Move backwards between fields |

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
| Tab | Move between buttons |

### Shortcut Reference Panel

Pressing ? on any page opens a modal listing all shortcuts available in
the current page context.

```
┌────────────────────────────────────────────────────┐
│  Keyboard Shortcuts                    [Close]     │
├────────────────────────────────────────────────────┤
│  GLOBAL                                            │
│  ?              Open this reference                │
│  Escape         Close / cancel                     │
│  Ctrl + ,       Open Settings                      │
│                                                    │
│  BULK EDITOR                                       │
│  Ctrl + A       Select all                         │
│  Ctrl + Shift + A   Deselect all                   │
│  Ctrl + Enter   Preview changes                    │
│  Ctrl + F       Search assignments                 │
│  Ctrl + Shift + F   Clear all filters              │
└────────────────────────────────────────────────────┘
```

---

## Accessibility

Canvas Power Tools targets WCAG 2.1 AA compliance. This is the standard
expected of educational technology software. It is a baseline requirement,
not a stretch goal.

### Required Practices

**Keyboard Navigation**
Every interactive element is reachable via keyboard alone. Tab order follows
logical reading sequence. Focus is always visually visible. Modals trap focus
while open and return focus to the trigger element on close.

**Screen Reader Support**
All icons have aria-label attributes. Dynamic content changes — toasts,
table updates, loading states — are announced via aria-live regions. Form
inputs have associated label elements. Error messages are linked to their
input fields via aria-describedby.

**Color and Contrast**
Text meets a minimum contrast ratio of 4.5:1. Information is never conveyed
by color alone — icons and text always accompany color-coded indicators.

**Motion**
Respect the prefers-reduced-motion media query. Animations and transitions
are disabled or minimized when the teacher has reduced motion enabled in
their OS settings.

**Focus Management**
When a modal opens, focus moves to the first interactive element inside it.
When it closes, focus returns to the element that opened it.

### Component Foundation Recommendation

Radix UI or shadcn/ui are accessibility-first component libraries for React.
Using one of these as the foundation for interactive components (modals,
dropdowns, popovers, toasts) significantly reduces the accessibility
implementation burden. Both are well-maintained and free.

### Testing Requirements

Before any feature ships, manually test with:
- Keyboard only (no mouse)
- NVDA screen reader on Windows (free download)
- Chrome's built-in Accessibility inspector (DevTools > Accessibility tab)

---

## Help System

Two layers working together: embedded tooltips for immediate contextual help
and full documentation on GitHub for deep reference.

### Embedded Tooltips

Every non-obvious UI element has a small info icon next to its label.
Hovering or focusing the icon shows a short explanation.

```
Date Shifting    [?]
                  ┌─────────────────────────────────────┐
                  │ Shift moves due dates forward or     │
                  │ backward by the number of days you   │
                  │ enter. Set assigns an exact date.    │
                  │                          [Learn more]│
                  └─────────────────────────────────────┘
```

Tooltips: 2-3 sentences maximum. Learn more links to the relevant docs page.

### First-Run Hint Banners

The first time a teacher opens each extension page, a hint banner appears
pointing out the key action. It is dismissible and never appears again.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Lightbulb icon]  Select assignments using the checkboxes,     │
│  then use the action bar below to make bulk changes.   [Got it] │
└─────────────────────────────────────────────────────────────────┘
```

### GitHub Documentation Structure

```
docs/
├── index.md                Getting started overview
├── installation.md         How to install the extension
├── setup.md                Generating and entering your API token
├── bulk-editor.md          Full bulk editor guide
├── templates.md            Template library and deploy guide
├── change-log.md           Change log and revert guide
├── settings.md             Settings reference
├── keyboard-shortcuts.md   Full shortcut list
└── troubleshooting.md      Common problems and solutions
```

### Help Access Points

| Location | Help Available |
|---|---|
| Every non-obvious form field | Info icon tooltip |
| Every major page | First-run hint banner (once) |
| Settings > About | Help link to docs |
| Health dashboard | Tooltip per status indicator |
| Error messages | Link to troubleshooting doc |
| Onboarding | Embedded step-by-step tutorial |
| Any page | ? key opens shortcut reference |

---

## First-Run Feature Hints — Content Reference

| Page | Hint Text |
|---|---|
| Bulk Editor | "Select assignments using the checkboxes, then use the action bar below to make bulk changes." |
| Template Library | "Click Use on any template to deploy it to one or more courses. Click + New Template to create one from scratch." |
| Settings | "Your API token is stored encrypted on this device and never sent anywhere outside your Canvas instance." |
| Change Log | "Click Revert on any entry to restore the previous values for those assignments in Canvas." |

---

## Accessibility

Canvas Power Tools targets WCAG 2.1 AA compliance. This is the standard
expected of educational technology software and is a legal consideration
for schools. It is treated as a baseline requirement, not a post-launch
enhancement. Retrofitting accessibility is significantly more expensive
than building it in from the start.

This section defines specific requirements for the UI patterns used in
Canvas Power Tools. General WCAG guidance is available at w3.org. This
section covers only what is specific to this application.

---

### Internationalization

Canvas Power Tools ships in English only for V1. The application will not
support multiple languages at launch. All strings are written in English.

This decision is revisited after V1 has real users. If a significant
portion of the user base works in a non-English language, localization
becomes a priority.

---

### Navigation Shell Accessibility

The sidebar is a navigation landmark. It must be marked accordingly.

```jsx
<nav aria-label="Canvas Power Tools navigation">
  <ul role="list">
    <li>
      <button
        aria-expanded={assignmentsOpen}
        aria-controls="assignments-tools"
      >
        Assignments
      </button>
      <ul id="assignments-tools" role="list">
        <li>
          <a
            href="/assignments/bulk-edit"
            aria-current={activeTool === 'bulk-edit' ? 'page' : undefined}
          >
            Bulk Edit
          </a>
        </li>
      </ul>
    </li>
  </ul>
</nav>
```

**Keyboard behavior requirements:**
- Tab moves focus between Module headers
- Enter or Space expands or collapses a Module
- Arrow keys navigate between Tools within an expanded Module
- Escape collapses the active Module and returns focus to its header
- The sidebar hide/show button is reachable by Tab and operable by Enter

**Skip navigation:** A visually hidden "Skip to main content" link must
appear as the first focusable element in the shell. It becomes visible
on focus. This allows keyboard and screen reader users to bypass the
sidebar on every page load.

```jsx
<a href="#main-content" className="skip-nav">
  Skip to main content
</a>
// ...
<main id="main-content" tabIndex="-1">
  {/* Active Tool renders here */}
</main>
```

---

### Assignment Table Accessibility

The assignment table uses virtual scrolling, which breaks screen reader
table navigation without explicit ARIA attributes. These attributes are
required whenever the table is rendered.

```jsx
<table
  role="grid"
  aria-label="Assignments"
  aria-rowcount={filteredAssignments.length}
  aria-multiselectable="true"
>
  <thead>
    <tr aria-rowindex={1}>
      <th scope="col">
        <input
          type="checkbox"
          aria-label="Select all assignments"
          checked={allSelected}
          onChange={handleSelectAll}
        />
      </th>
      <th scope="col" aria-sort={sortColumn === 'name' ? sortDirection : 'none'}>
        Assignment Name
      </th>
      {/* remaining headers */}
    </tr>
  </thead>
  <tbody>
    {rowVirtualizer.getVirtualItems().map(virtualRow => {
      const assignment = filteredAssignments[virtualRow.index]
      return (
        <tr
          key={assignment.id}
          aria-rowindex={virtualRow.index + 2} // +2 accounts for header row
          aria-selected={selectedIds.includes(assignment.id)}
        >
          <td>
            <input
              type="checkbox"
              aria-label={`Select ${assignment.name}`}
              checked={selectedIds.includes(assignment.id)}
              onChange={() => toggleSelection(assignment.id)}
            />
          </td>
          {/* remaining cells */}
        </tr>
      )
    })}
  </tbody>
</table>
```

**Sortable columns:** When a column is sorted, aria-sort on the th element
must be set to "ascending" or "descending". Unsorted columns use
aria-sort="none". This communicates sort state to screen readers without
relying on visual indicators alone.

**Filter bar:** Each filter control must have an associated label. Active
filters shown as chips must include a visible and screen-reader-accessible
remove button with an aria-label that names the filter being removed.

```jsx
<button aria-label="Remove filter: Due Date October 1 to October 31">
  ×
</button>
```

---

### Modal and Dialog Accessibility

Every modal — preview screens, confirmation dialogs, the PIN prompt — must
implement focus management correctly. This is one of the most common
accessibility failures in web applications.

**Required behavior:**
1. When a modal opens, focus moves to the first interactive element inside
   it, or to the modal container if no interactive elements precede the
   content.
2. Tab cycles only through elements inside the open modal — focus does not
   escape to the page behind it.
3. Escape closes the modal.
4. When the modal closes, focus returns to the element that opened it.

```jsx
// Use a ref to track the trigger element
const triggerRef = useRef(null)

function openModal() {
  triggerRef.current = document.activeElement
  setIsOpen(true)
}

function closeModal() {
  setIsOpen(false)
  // Return focus after the modal unmounts
  setTimeout(() => triggerRef.current?.focus(), 0)
}
```

**ARIA role:** Modals use role="dialog" with aria-modal="true" and an
aria-labelledby pointing to the modal's heading.

```jsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Preview Changes</h2>
  ...
</div>
```

---

### Toast Notification Accessibility

Screen readers do not automatically announce dynamically injected content.
Toasts must be injected into a pre-existing aria-live region.

A single live region container is rendered once in the application shell
and never removed. Toasts are inserted into it and removed from it.

```jsx
// In the shell — rendered once, always present
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only-live-region"
>
  {activeToasts.map(toast => (
    <div key={toast.id}>{toast.message}</div>
  ))}
</div>
```

**Region type by toast type:**
- Success, Info: aria-live="polite" — announced after the current reading
  finishes
- Warning, Error: aria-live="assertive" — announced immediately,
  interrupting the current reading

Error messages are assertive because the teacher needs to know immediately
that an action failed. Success messages are polite because they are
informational and interrupting would be disruptive during normal use.

---

### Canvas Injection Accessibility

When the content script injects buttons into Canvas pages, those buttons
must not break Canvas's existing accessibility tree.

**Requirements for injected elements:**
- Every injected button has a descriptive aria-label if its visible text
  is not fully descriptive
- Injected elements do not alter the tab order of existing Canvas elements
  in unexpected ways
- Injected panels that overlay Canvas content use role="dialog" with
  aria-modal="true" to contain focus

**Testing injected elements:** After injection, verify with a screen reader
that the Canvas page's existing keyboard navigation still works correctly.
Tab through the page before and after injection and confirm the sequence
is logical.

---

### Design System — Color

Canvas Power Tools uses a three-layer color system: background mode,
semantic colors, and accent color. These three layers are independent.
Changing the accent does not affect backgrounds or semantic colors.
Changing the background mode does not affect semantic colors.

---

#### Layer 1 — Background Mode

The teacher selects Light, Dark, or System in Settings. System follows
the operating system preference and switches automatically.

**Light mode neutrals:**

| Role | Value | Notes |
|---|---|---|
| Page background | #F6F5F4 | Off-white — softer than pure white |
| Surface (cards, panels) | #FFFFFF | White |
| Border | #DEDDDA | Subtle separation |
| Body text | #1E1E1E | Near-black — 17:1 on white ✓ |
| Secondary text | #505050 | 7.5:1 on white ✓ |
| Disabled text | #767676 | 4.5:1 on white ✓ (minimum) |
| Sidebar background | #F0EFED | Slightly darker than page |

**Dark mode neutrals:**

| Role | Value | Notes |
|---|---|---|
| Page background | #1A1A1A | Near-black |
| Surface (cards, panels) | #242424 | Slightly lighter than page |
| Border | #3A3A3A | Subtle separation |
| Body text | #EBEBEB | Near-white — 14:1 on #1A1A1A ✓ |
| Secondary text | #A0A0A0 | 5.5:1 on #1A1A1A ✓ |
| Disabled text | #6E6E6E | 4.5:1 on #1A1A1A ✓ (minimum) |
| Sidebar background | #111111 | Slightly darker than page |

All contrast ratios must be verified at implementation time using the
WebAIM Contrast Checker. The values above are targets — final hex codes
may shift slightly during implementation.

---

#### Layer 2 — Semantic Colors

Semantic colors communicate meaning — success, warning, error, info.
They are fixed regardless of accent or background mode. Each has a
light-mode and dark-mode variant.

| Meaning | Light mode | Dark mode | Usage |
|---|---|---|---|
| Success | #1B6B30 | #6FCF97 | Successful operations, published status |
| Warning | #9D5400 | #FFA654 | Fallback selectors, approaching deadlines |
| Error | #C01C28 | #FF8B8B | Failed operations, missing work |
| Info | #1A5FB4 | #78AEED | Informational toasts, neutral highlights |

**Color is never the sole indicator of meaning.** Every status must be
communicated by icon or text alongside color. Teachers who are colorblind
must be able to distinguish all states without relying on hue.

---

#### Layer 3 — Accent Color

The teacher selects one accent from a curated palette in Settings. The
accent applies to interactive elements — primary buttons, links, active
sidebar items, focus rings, selected row highlights, progress bars.

The accent never applies to body text on backgrounds or to semantic
colors. This keeps its usage contained and makes contrast management
tractable.

**Color pairs:** Each named accent has a light-mode variant and a
dark-mode variant. The correct variant is applied automatically. The
teacher never manages this.

| Name | Light mode | Dark mode | Notes |
|---|---|---|---|
| Blue (default) | #1A5FB4 | #78AEED | Distinct from Canvas's brand blue |
| Teal | #0E7C7B | #5DC8C7 | Good choice for CTE-adjacent products |
| Green | #1B6B30 | #6FCF97 | Shares value with success — use carefully |
| Purple | #613583 | #C084FC | Strong differentiation from Canvas |
| Orange | #9D4100 | #FFA654 | High energy; shares value with warning |
| Slate | #3C4557 | #A5B4C8 | Neutral — least visually assertive |
| Indigo | #1C3A6E | #82A8D8 | Professional, academic feel |

**Implementation:** Accent colors are exposed as CSS custom properties on
the root element. Every component that uses the accent color references
the variable, not a hard-coded hex value. Changing the accent requires
updating only the root variable.

```css
:root[data-accent="blue"][data-mode="light"] {
  --color-accent: #1A5FB4;
  --color-accent-hover: #154C8F;
  --color-accent-subtle: #EBF0FA;
}

:root[data-accent="blue"][data-mode="dark"] {
  --color-accent: #78AEED;
  --color-accent-hover: #A0C4F4;
  --color-accent-subtle: #1E2A3A;
}
```

All accent contrast ratios must be verified against both light and dark
backgrounds at implementation time. The values above are targets.

---

### Focus Indicators

Browser default focus rings are inconsistent across browsers and often
fail contrast requirements. A custom focus style is defined globally and
applied to every interactive element.

```css
/* Applied globally in the extension's root stylesheet */
:focus-visible {
  outline: 3px solid #1A5FB4;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Remove for mouse users — only show for keyboard navigation */
:focus:not(:focus-visible) {
  outline: none;
}
```

The :focus-visible pseudo-class shows the ring only for keyboard navigation,
not on mouse click. This satisfies both keyboard users (who need visible
focus) and mouse users (who find focus rings visually distracting).

---

### Reduced Motion

Some teachers experience discomfort or medical symptoms from animated
content. The prefers-reduced-motion media query must be respected throughout
the extension.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Specific animations that must be disabled under reduced motion:**
- Skeleton loader pulse animation
- Toast slide-in transition
- Sidebar expand/collapse animation
- Modal fade-in transition
- Loading spinner (replace with a static indicator)

---

### Cognitive Accessibility

Cognitive accessibility means the interface is predictable, forgiving, and
does not require the teacher to hold complex state in their head. Canvas
Power Tools addresses this through several design decisions already made.

**Documenting these decisions explicitly:**

*Preview before write* — no bulk operation executes without showing the
teacher exactly what will change. This allows course correction before any
consequence occurs.

*Revert everything* — every write operation is recoverable from the change
log. Teachers can act with confidence knowing mistakes are reversible.

*Explicit error messages* — every error state has a specific cause and a
specific next step. Generic error messages are not permitted.

*No time limits* — no interactive element in the extension expires or
auto-submits based on inactivity, with one deliberate exception: the
5-second send delay on Communication Tools. This delay is a safety feature
and is documented as such in the Communication Tools design document.

*Session recovery* — the teacher's last used Module, Tool, and sidebar
state are stored in sessionState in chrome.storage.local. If the browser
crashes or the tab is accidentally closed, reopening the extension returns
to the same context rather than resetting to a default view.

*Consistent navigation* — the sidebar structure does not change between
Tools. The teacher always knows where they are and how to get somewhere
else.

---

### Time Limits Exception — Communication Tools Send Delay

The 5-second countdown before the Send button activates in the Nudges,
Threshold, and Announcements Tools is an intentional exception to the
no-time-limits principle.

The delay serves as a safety mechanism — it prevents a teacher from
accidentally sending a message to students immediately upon clicking
Preview and then Confirm without a moment of deliberate consideration.
Messages sent through Canvas cannot be recalled.

This exception is documented here and in the Communication Tools design
document (Doc 14). WCAG 2.2 Success Criterion 2.2.1 allows time limits
if they are essential. Preventing accidental mass messaging qualifies.

---

### Testing Requirements

Before any feature ships, the following tests must pass manually. Formal
automated testing is added in a future version when the testing
infrastructure justifies it.

**Keyboard-only navigation test:**
- Unplug or disable the mouse
- Navigate to the feature using only Tab, Shift+Tab, Enter, Space, and
  arrow keys
- Confirm every interactive element is reachable and operable
- Confirm focus is always visible
- Confirm modals trap focus correctly
- Confirm Escape closes modals and returns focus

**Screen reader test (NVDA on Windows — free):**
- Navigate the feature using NVDA in browse mode and forms mode
- Confirm all form labels are announced correctly
- Confirm table headers and row/column relationships are announced
- Confirm toast notifications are announced
- Confirm modal titles are announced when dialogs open
- Confirm error messages are announced

**Color and contrast test:**
- Install the axe DevTools browser extension (free tier available)
- Run against every Tool before shipping
- Resolve all critical and serious violations before release

**Reduced motion test:**
- Enable "Reduce motion" in Windows Settings → Accessibility → Visual effects
- Verify all animations are disabled or minimized

---

### Text Size

Text size is a core accessibility feature. Teachers who need larger text
should not have to rely on browser zoom, which can break extension layouts
in unpredictable ways. The extension provides four text size options that
scale the entire UI proportionally.

**Options:**

| Setting | Root font size | Notes |
|---|---|---|
| Small | 13px | For teachers who want more content visible |
| Medium | 15px | Default |
| Large | 17px | Most teachers with accessibility needs |
| Extra Large | 20px | High visual accessibility need |

**Implementation:** The selected size is applied as font-size on the
document root. All text, spacing, and layout measurements in the extension
use rem units. This ensures every element scales proportionally when the
root size changes — not just text, but padding, margins, icon sizes, and
row heights.

```css
/* Applied to :root based on the teacher's text size setting */
:root[data-text-size="small"]       { font-size: 13px; }
:root[data-text-size="medium"]      { font-size: 15px; }  /* default */
:root[data-text-size="large"]       { font-size: 17px; }
:root[data-text-size="extra-large"] { font-size: 20px; }

/* All measurements use rem — they scale automatically */
.assignment-row { padding: 0.75rem 1rem; }   /* scales with text size */
.sidebar-item   { font-size: 0.9rem; }        /* scales with text size */
```

**Critical rule for developers:** Never use px units for text size, padding,
or any layout measurement that should scale with user preference. Use rem
throughout. The only acceptable use of px in layout is for elements that
must not scale — such as a 1px border or a 2px focus ring outline.

**What scales with text size:**
- All text
- Padding and margins on interactive elements
- Row heights in tables
- Icon sizes (use rem-based sizing on SVGs)
- Sidebar item spacing
- Modal dimensions

**What does not scale:**
- Border widths (always 1px or 2px)
- Focus ring outline width (3px — fixed for visibility)
- Box shadows

**Testing:** The extension must be visually tested at all four text sizes
before each release. In particular, verify that the assignment table columns
do not overflow, that sidebar items do not truncate incorrectly, and that
modal buttons remain fully visible at Extra Large.

---

### Spacing Modes (Future / Stretch)

Compact, Cozy, and Relaxed spacing modes allow teachers to control the
density of the interface — how much breathing room exists between rows,
cards, and elements.

This is lower priority than text size because browser zoom and text size
together address the most common accessibility needs. Spacing mode is a
comfort preference as much as an accessibility feature.

**Planned behavior when implemented:**

| Mode | Row padding | Description |
|---|---|---|
| Compact | 0.4rem vertical | Maximum content density. Suitable for teachers who have mastered the interface and want to see as many rows as possible. |
| Cozy | 0.75rem vertical | Default. Comfortable balance of density and readability. |
| Relaxed | 1.2rem vertical | More breathing room. Useful for teachers who find dense tables overwhelming, or who use the extension on large monitors. |

Implementation follows the same CSS custom property pattern as text size —
a data attribute on root drives padding variables used throughout the
component library.

This feature is added to the Future / Noted roadmap section and will be
designed in full when development reaches the interface polish phase.
