# Canvas Power Tools — 02: Bulk Assignment Editor

---

## UI Design Decisions (Locked)

These decisions are locked. Do not re-litigate without a documented reason for changing them.

| # | Decision | Rationale |
|---|---|---|
| 1 | **Course picker lives in AppNav** | Persistent across all tools. Teacher always knows which course they're working in. Same location on every tool page — never hunt for it. |
| 2 | **Filters: top bar above table** | Table gets maximum vertical space. Top bar keeps the layout linear (no sidebar narrowing the table). Current button-style layout needs redesign — see Filter Bar section below. |
| 3 | **Bulk action bar: floating card at bottom, context-only** | Appears only when rows are selected. Not sticky full-width. Floats above the table as a card with shadow elevation — visually distinct from the table surface so the teacher knows it's an action layer, not table chrome. |
| 4 | **Column visibility: configured in Settings, not on this page** | Defaults are decided and locked. Teacher configures their column set once in Settings; those columns are always visible on the tool. No "Columns" menu cluttering the tool UI. |

---

## What It Does

The Bulk Assignment Editor gives teachers a full-page interface to select multiple assignments across a course and edit their due dates, availability dates, point values, and publish status all at once — without clicking into each assignment individually.

Canvas has no native bulk editing capability for assignments. This is one of the core tools in the extension — not the whole product, but one of its most-used features.


---

## Module Context

The Bulk Edit Tool lives in the **Assignments Module**. It is the first Tool teachers encounter and the foundation for the extension's shared Component library. Every reusable piece built here — the multi-select table, column filters, date picker, preview diff modal, and change log — is available to all subsequent Tools.

---

## How It Is Accessed

A button labeled something like "Power Tools" or "Bulk Editor" is injected into
the Canvas assignments page toolbar by the content script. Clicking it opens the
Bulk Assignment Editor as a new tab — a full extension page served by the
extension itself.

---

## Page Structure

The Bulk Edit Tool has three layers:

1. **AppNav** (shared header) — logo, course selector, module navigation, settings. Course picker lives here, not in the tool.
2. **Filter bar** — above the table. Search + column filters. Design TBD (not the current button-row pattern).
3. **Assignment table** — the main event. Gets maximum vertical space. Column set is determined by Settings.
4. **Floating action card** — appears above the table bottom when ≥1 row is selected. Elevated with shadow. Dismissed when selection is cleared.

---

## AppNav (Shared — not owned by this tool)

The course selector is an AppNav concern. It appears in the header on every tool page. See `src/components/AppNav.jsx` and design doc 10 for the AppNav spec.

```
[Logo] Canvas Power Tools   [Course: Fall 2025 Biology 101 ▼]   [Assignments] [Grading] [Communication] [People]   [Settings]
```

The course selector is a dropdown populated by getCourses(). Changing the
course reloads the assignment table. The last used course is remembered via
preferences.lastUsedCourseId in storage.

---

## Filter Bar

Pattern: **chip-based add-filter hybrid**. Text search is always visible. Additional filters are added on demand — a "+ Add Filter" button opens a dropdown listing available filter types. Selecting a type prompts for a value; the applied filter renders as an editable, dismissible chip. The bar is clean by default and fills with chips as filters are applied.

```
[🔍 Search assignments...]   [+ Add Filter]

Active: [Group: Homework ×]  [Module: Unit 3 ×]  [Clear all]
```

**Available filter types (6):**

| Filter | Options |
|---|---|
| Assignment Group | Dynamic list from course groups |
| Module | Dynamic list from course modules |
| Published Status | Published / Unpublished / Scheduled |
| Assignment Type | Assignment / Quiz / Discussion / Page |
| Due Date | Has due date / No due date / Date range picker |

Text search is always the first element and filters client-side by assignment name. Chips show their current value and are clickable to change it without removing and re-adding. "Clear all" only appears when ≥1 filter is active.

**Note:** A smart search bar (type-to-filter with `group:homework` syntax) is deferred — could be enabled as a Settings toggle in a later version.

---

## Assignment Table

### Columns

Every column is sortable (click header to sort ascending, click again for
descending). Filtering is done via the chip filter bar above the table — there are no per-column filter controls.

**Default columns (shown out of the box):**

| Column | Notes |
|---|---|
| ☐ Checkbox | Always present — not configurable |
| Assignment Name | Always present — cannot be hidden |
| Assignment Group | High-value, short header |
| Due Date | The #1 thing teachers bulk-edit |
| Published | Toggle — quick visual status |

**Optional columns (off by default, configurable in Settings):**

| Column | Notes |
|---|---|
| Close Date | Available until date |
| Unlock Date | Available from date |
| Module | Canvas module the assignment belongs to |
| Points Possible | Numeric |
| Submission Type | Online / on paper / none / etc. |

Teachers can toggle any optional column on or off in Settings at any time. The configuration persists between sessions.

### Table Behavior

- Rows are selectable via checkbox
- Select All in the filter bar selects all rows matching current filters
- Uncheck Select All deselects everything
- Current values for all fields are shown inline in each row
- Table is sortable by any column
- Filtered rows are excluded from Select All
- Assignment count shown below filter bar: "Showing 12 of 18 assignments"

### Sample Table Row

```
[x]  Quiz 1    Quizzes    Week 3    Oct 1, 2025    Sep 28    Oct 2    20 pts    Published
```

---

## Floating Action Card

The floating action card appears above the bottom of the viewport when ≥1 assignment is selected. It is hidden when nothing is selected. It is **not** a full-width sticky bar — it is a centered card (~860px wide) with `--shadow-lg` elevation, visually floating above the table surface.

### Card Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  3 selected · 15 fields to change            [Clear All]  [∧]         │
├─────────────────────────────────────────────────┬────────────────────┤
│  📅 Dates                                        │  # Points          │
│  Due Date     [Set] [Shift] [Clear]  [input]     │  [Set all to...] pts│
│  Avail. From  [Set] [Shift] [Clear]  [input]     ├────────────────────┤
│  Avail. Until [Set] [Shift] [Clear]  [input]     │  👁 Status          │
│  ☐ Apply same shift/clear to all dates           │  [Eye]  [EyeOff]   │
│                                                  │ Publish  Unpublish │
│                                                  │                    │
│                                                  │ [Preview Changes →]│
└─────────────────────────────────────────────────┴────────────────────┘
```

### Header Strip

- Left: `N selected · N fields to change` — total = assignments × fields with values set. E.g., 3 assignments with 5 fields each = "15 fields to change". Tooltip on hover shows "5 fields × 3 assignments".
- Right: `[Clear All]` deselects all rows and hides the card. `[∧]` collapses to the header strip only.
- Collapsed state: just the header strip (44px tall). Re-expands on click or on new field input.

### Date Controls (three-mode segmented control per row)

Each date row (Due Date, Avail. From, Avail. Until) has a three-button segmented control:

**[Set]** — reveals a date input. Sets that date to an exact value on all selected assignments.

**[Shift]** — reveals a +/− dropdown and a day-count input. Shifts each assignment's existing date by ±N days relative to its current value. E.g., Shift +7 moves all due dates one week later without changing their relationship to each other.

**[Clear]** — no input shown. Displays red contextual text: *"Removes this date from all selected assignments."* Clears that date field entirely — useful when moving assignments between courses.

Only one mode is active per row at a time. The segmented control makes the active mode visually unambiguous.

**Apply same shift/clear to all dates** — checkbox below the three date rows. When checked, the shift value or clear action set on Due Date is mirrored to Avail. From and Avail. Until automatically. Individual rows can still be overridden after mirroring.

### Points

A single text input: `[Set all to...]  pts`. Sets all selected assignments to that exact point value. Blank = no change to points.

### Status

Two `IconButton` atoms (ghost variant) side by side with label text below each:
- `Eye` icon + "Publish" label — publishes all selected assignments
- `EyeOff` icon + "Unpublish" label — unpublishes all selected assignments

These are independent action buttons, not toggles — clicking either fires the intent immediately. Selected assignments may have mixed publish status so neither button has a persistent "active" state. Icons from Lucide React (`Eye`, `EyeOff`).

### Editable Fields (complete list — no others)

Due Date · Avail. From · Avail. Until · Points · Published Status. This is the complete set. Assignment group changes are handled by the Assignment Groups tool. All other fields are too edge-case for bulk editing.

### Preview Changes Button

Primary action. Bottom-right of the card. Disabled until ≥1 field has an active value. Clicking opens the Preview Changes screen — no Canvas writes happen until after the teacher confirms there.

---

## Preview Changes Screen

A modal that appears after clicking Preview Changes. The teacher must review
and confirm before any data is written.

### Layout: grouped by assignment

Changes are grouped into one block per assignment — not a flat table. Each block is headed by the assignment name, with its changed fields listed beneath. This keeps the unit of change (the assignment) scannable and avoids repeating the assignment name across multiple rows.

```
Preview Changes                                              [Cancel]

┌────────────────────────────────────────────────────────────┐
│  Quiz 1                                                     │
│    Due Date     Oct 1, 2025   →   Oct 8, 2025             │
│    Points       20            →   25                       │
├────────────────────────────────────────────────────────────┤
│  Homework 3                                                │
│    Due Date     Oct 5, 2025   →   Oct 12, 2025            │
│    Avail. Until Oct 6, 2025   →   Oct 13, 2025            │
└────────────────────────────────────────────────────────────┘

15 fields to change across 3 assignments

                                      [Cancel]    [Confirm & Apply]
```

### Diff emphasis (do not rely on layout alone)

Each change renders as `old → new` with deliberate visual weight:
- **Old value** — muted (`--color-text-muted`), lighter weight. It is the past.
- **Arrow (→)** — accent color (`--cpt-color`). Draws the eye across the change.
- **New value** — full-strength body color (`--color-text-body`), `font-medium`. It is what will happen.

Never distinguish old vs. new by position alone — the color and weight difference must carry the meaning (WCAG: not color as the sole indicator, but here weight + color + the arrow glyph all reinforce it).

### Behavior

- Only fields that are actually changing are shown. Set a due date but leave points blank → only due-date rows appear.
- The footer count matches the floating card: `N fields to change across N assignments`.
- **Cancel** returns to the table with all selections and field values intact — nothing is lost.
- **Confirm & Apply** fires the Canvas API writes and shows per-assignment progress.

---

## After Apply — Result Screen

The Result screen adapts to the outcome. Successes are reassurance; failures are action items and get the visual weight.

### All succeeded (calm, minimal)

```
✓  15 fields updated across 3 assignments

                        [View Report]        [Done]
```

### Partial failure (failures carry the weight)

```
⚠  13 updated · 2 failed

   Failed
   Quiz 4      You don't have permission to edit this assignment,
               or your Canvas token needs reconnecting.        (401)
   Homework 7  Canvas had a temporary problem. Usually works
               on retry.                                        (503)

   ▸ 13 succeeded  (collapsed, expandable)

        [View Report]   [Retry all failed]        [Done]
```

- The success list collapses behind a disclosure so the eye lands on failures first.
- **Retry all failed** re-fires only the failed writes and updates the result in place.
- Both states offer **View Report** — a read-only view identical in layout to the Preview screen (grouped by assignment, same diff emphasis), showing what actually succeeded plus any failures.

### Error translation (status-code driven)

Canvas does not reliably document error *bodies* for the assignment-update endpoint, so we translate on the stable contract — the **HTTP status code** — never by string-matching message text.

| Status | Bucket | Teacher-facing message |
|---|---|---|
| 401 / 403 | Permission / auth | "You don't have permission to edit this assignment, or your Canvas token needs reconnecting." |
| 404 | Not found | "This assignment no longer exists in Canvas (it may have been deleted)." |
| 422 | Validation | **Pass through Canvas's own field message** — 422 bodies are usually already readable. |
| 429 | Rate limited | Handled automatically by the request queue; should rarely surface. |
| 5xx | Server error | "Canvas had a temporary problem. This usually works on retry." |

Blueprint-locked assignments typically surface as 401/403 and land in the permission bucket — acceptable, since Canvas gives no documented, stable way to detect the blueprint case specifically.

### Report storage (unified with Change Log)

There is **one** storage model, reached from two places:

- The **Change Log already stores every success** — it powers revert. A "success report" is just a *view* of that existing change-log entry; no new storage is added for successes.
- **Failures** are attached to the same change-log entry as a lightweight array — they are **not** revertable entries (they never happened), just record: `failures: [{ assignmentName, status, reason }]`. Small, no PII (assignment names are already logged).
- Therefore **View Report (Result screen) === opening that operation's Change Log entry.** History of recent reports comes for free from the Change Log.

---

## Change Log

### Purpose

Every successful Apply operation creates a change log entry stored in
chrome.storage.local under changeLogs[courseId]. The log gives teachers a
permanent record of what was changed and the ability to revert any operation.

### Log Entry Structure

```javascript
{
  id: "clog_1696339200000",
  timestamp: "2025-10-03T14:32:00Z",
  courseId: "12345",
  courseName: "Biology 101 - Fall 2025",
  summary: "4 changes across 2 assignments",
  type: "edit",           // or "revert"
  revertedFromId: null,   // populated if this is a revert entry
  changes: [
    {
      assignmentId: "67890",
      assignmentName: "Quiz 1",
      field: "dueDate",
      previousValue: "2025-10-01",
      newValue: "2025-10-08"
    },
    {
      assignmentId: "67890",
      assignmentName: "Quiz 1",
      field: "points",
      previousValue: 20,
      newValue: 25
    }
  ],
  // Attached when an operation had partial failures. NOT revertable —
  // these writes never landed. Powers the Result screen's failure view.
  failures: [
    {
      assignmentId: "24680",
      assignmentName: "Homework 7",
      status: 503,          // HTTP status — drives error translation
      reason: "server"      // bucket: permission | notfound | validation | server
    }
  ]
}
```

`failures` is omitted or empty when every write succeeded. Because assignment
names are already stored in `changes`, adding them here introduces no new
PII category.

### Retention

Maximum 10 entries per course. When the 11th entry is added, the oldest is
dropped. The log is per-course — there is no global cross-course log view.

### Change Log UI

Accessed via the Change Log button in the top bar. Opens as a panel or page
showing all entries for the current course, most recent first.

```
Change Log — Biology 101 - Fall 2025                        [Close]

Today, 2:32 PM    4 changes across 2 assignments            [Revert]
▼ expanded
  Quiz 1          Due Date      Oct 1   →   Oct 8
  Quiz 1          Points        20      →   25
  Homework 3      Due Date      Oct 5   →   Oct 12
  Homework 3      Available Until Oct 6 →   Oct 13

Today, 11:20 AM   2 changes across 1 assignment             [Revert]
► collapsed — click to expand

Oct 2, 4:10 PM    5 changes across 3 assignments            [Revert]
► collapsed — click to expand
```

### Revert Behavior

Clicking Revert on any log entry:

1. Shows a confirmation: "Revert these 4 changes? This will restore the
   previous values in Canvas."
2. On confirm, fires PUT requests to Canvas restoring previous values
3. Creates a new log entry of type "revert" with revertedFromId pointing to
   the original entry
4. Shows a revert summary report on completion

The revert operation itself is logged, making it revertable. Nothing is ever
destructively removed from the log.

### Revert Summary Report

```
Revert Complete

Reverted successfully: 2 assignments
  Quiz 1        Due Date    Oct 8    →    Oct 1
  Quiz 1        Points      25       →    20

Skipped: 1 assignment
  Homework 4    Not found in Canvas — may have been deleted

                                                    [Close]
```

Skipped assignments are reported with a plain language reason. The revert
continues past skipped items — it does not abort on failure.

---

## Data Flow — Full Sequence

```
1. Teacher opens extension page
2. getCourses() called — populates course dropdown
3. Teacher selects course
4. getAssignments(courseId) called — fetches all assignments with pagination
5. getAssignmentGroups(courseId) called — for group column data
6. getModules(courseId) called — for module column data
7. Table renders with all data
8. Teacher applies filters — client-side filtering, no additional API calls
9. Teacher selects assignments via checkboxes
10. Teacher enters values in bulk action bar
11. Teacher clicks Preview Changes
12. Diff calculated client-side — shows old vs new
13. Teacher confirms
14. PUT requests fired per assignment
    (bulk_update endpoint used where possible)
15. Success/failure tracked per assignment
16. Result screen shown
17. Change log entry created and saved to storage
18. Table refreshes to show updated values
```

---

## Canvas API Calls for This Feature

| Action | Method | Endpoint |
|---|---|---|
| List courses | GET | /api/v1/courses |
| List assignments | GET | /api/v1/courses/:id/assignments |
| List assignment groups | GET | /api/v1/courses/:id/assignment_groups |
| List modules | GET | /api/v1/courses/:id/modules |
| Bulk update dates | PUT | /api/v1/courses/:id/assignments/bulk_update |
| Update single assignment | PUT | /api/v1/courses/:id/assignments/:id |

The bulk_update endpoint handles date changes efficiently. Point value and
publish status changes are fired as individual PUT requests per assignment since
bulk_update only covers dates.

---

## Components Built by This Feature

The shared Tier 1 + Tier 2 atom set (`Badge`, `Button`, `IconButton`, `Card`, `Skeleton`, `EmptyState`, `Callout`, `Actions`, `Toolbar`, `SearchInput`, `SegmentedToggle`, `NumberField`, `SortControl` + `useSort`) are already built in `src/components/`. The API functions (`getCourses`, `getAssignments`) and `CourseSelector` (AppNav) are also pre-existing.

This feature builds the following additional components, which other tools can reuse:

| Component | Owned By | Reused By |
|---|---|---|
| `AssignmentTable` | Bulk Editor | Copy Assignments (source step) |
| `BulkActionBar` (floating card) | Bulk Editor | Copy Assignments |
| `PreviewDiff` | Bulk Editor | Any tool with a write + confirm step |
| Result screen (success / partial-fail layout) | Bulk Editor | Any write operation |
| Chip filter bar (`FilterBar`) | Bulk Editor | Any table-primary tool that needs add-on filters |

---

## Filter and Sort Persistence

Filters and sort state are remembered for the duration of the browser session.
If a teacher applies a date range filter, navigates to the template library,
and returns to the bulk editor, their filters are still active.

When the teacher starts a new browser session the next day, filters reset to
the defaults defined in Settings. This prevents teachers from arriving to a
previous session's filters unexpectedly.

Active filters are always shown as removable chips above the table regardless
of whether they were set in the current session or restored from settings
defaults. The teacher always knows what is active.

### What Is Remembered Per Session

| State | Remembered |
|---|---|
| Active filters | Yes — per course, for session duration |
| Sort column and direction | Yes — per course, for session duration |
| Scroll position in table | Yes — per course, for session duration |
| Selected assignments | No — cleared on navigate away |
| Bulk action field values | No — cleared on navigate away |
| Last used course | Yes — persisted to storage across sessions |

Session state is held in React component state at the page level, not in
storage. Navigation within the extension preserves state. Closing and reopening
the tab starts fresh, but stored preferences (last course) are restored.

---

## Loading State — Assignment Table

The assignment table uses skeleton loading rather than a spinner. Skeleton
loaders show placeholder rows in the shape of real content while data loads.

```
┌────┬──────────────────────┬────────┬──────────┬──────┐
│    │ ████████████████     │ ██████ │ ████████ │ ████ │
│    │ ████████████         │ ██████ │ ████████ │ ████ │
│    │ ██████████████████   │ ██████ │ ████████ │ ████ │
│    │ ████████             │ ██████ │ ████████ │ ████ │
└────┴──────────────────────┴────────┴──────────┴──────┘
(animated gray placeholder rows)
```

For large courses a count indicator accompanies the skeleton:
```
Loading assignments... 47 of 200
[████████░░░░░░░░░░░░]
```

All other loading states in the extension (dropdowns, apply progress, deploy
progress) use the standard spinner component. The skeleton is specific to the
assignment table.

## Table State Matrix (Grammar Rule A5)

All four non-data states use shared atoms. No bespoke empty or error UI is permitted.

| State | Trigger | Atom | Label / Action |
|---|---|---|---|
| Loading | `getAssignments()` in flight | `Skeleton` (8 placeholder rows) | — |
| Empty — no assignments | Course has zero assignments | `EmptyState` | "No assignments in this course" · no action button |
| Empty — filtered | Active filters match nothing | `EmptyState` | "No assignments match your filters" · `Button` "Clear filters" |
| Error | API call fails | `Callout` (variant="error") | Plain-language error + `Button` "Try again" |

The "Clear filters" button in the filtered-empty state fires the same action as clicking the filter bar's own "Clear all" link — they are the same operation, two entry points. Implement as one shared `clearFilters()` function called by both. Do not duplicate the state-clearing logic.
