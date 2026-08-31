# Canvas Power Tools — 02: Bulk Assignment Editor

---

## What It Does

The Bulk Assignment Editor gives teachers a full-page interface to select multiple assignments across a course and edit their due dates, availability dates, point values, and publish status all at once — without clicking into each assignment individually.

Canvas has no native bulk editing capability for assignments. This is one of the core tools in the extension — not the whole product, but one of its most-used features.

---

## Module Context

The Bulk Edit Tool lives in the **Assignments Module**. It is the first Tool teachers encounter and the foundation for the extension's shared Component library. Every reusable piece built here — the multi-select table, column filters, date picker, preview diff modal, and change log — is available to all subsequent Tools.

---

## How It Is Accessed

A button is injected into the Canvas assignments page toolbar by the content script. Clicking it opens the Bulk Assignment Editor as a new tab — a full extension page served by the extension itself.

---

## Page Structure

The Bulk Edit Tool has three layers:

1. **AppNav** (shared header) — logo, course selector, module navigation, settings. Course picker lives here, not in the tool.
2. **Filter bar** — above the table. Search + column filters.
3. **Assignment table** — the main event. Gets maximum vertical space. Column set is determined by Settings.
4. **Bulk action panel** — appears when ≥1 row is selected. Dismissed when selection is cleared.

---

## AppNav (Shared — not owned by this tool)

The course selector is an AppNav concern. It appears in the header on every tool page. See `src/components/AppNav.jsx`.

The course selector is a dropdown populated by `getCourses()`. Changing the course reloads the assignment table. The last used course is remembered via `preferences.lastUsedCourseId` in storage.

---

## Filter Bar

Pattern: text search is always visible. Additional filters are added on demand — a "+ Add Filter" control opens a list of available filter types. Selecting a type prompts for a value; the applied filter renders as an editable, dismissible chip. The bar is clean by default and fills with chips as filters are applied.

**Available filter types:**

| Filter | Options |
|---|---|
| Assignment Group | Dynamic list from course groups |
| Module | Dynamic list from course modules |
| Published Status | Published / Unpublished / Scheduled |
| Assignment Type | Assignment / Quiz / Discussion / Page |
| Due Date | Has due date / No due date / Date range picker |

Text search filters client-side by assignment name. Chips show their current value and are clickable to change the value without removing and re-adding. "Clear all" appears only when ≥1 filter is active.

**Note:** A smart search bar (type-to-filter with `group:homework` syntax) is deferred — could be enabled as a Settings toggle in a later version.

---

## Assignment Table

### Columns

Every column is sortable (click header to sort ascending, click again for descending). Filtering is done via the filter bar above — there are no per-column filter controls.

**Default columns (shown out of the box):**

| Column | Notes |
|---|---|
| Checkbox | Always present — not configurable |
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
- Select All selects all rows matching current filters
- Uncheck Select All deselects everything
- Current values for all fields are shown inline in each row
- Table is sortable by any column
- Filtered rows are excluded from Select All
- Assignment count shown: "Showing 12 of 18 assignments"

---

## Bulk Action Panel

The bulk action panel appears when ≥1 assignment is selected. It is hidden when nothing is selected.

### Header Strip

- Left: `N selected · N fields to change` — total = assignments × fields with values set. E.g., 3 assignments with 5 fields each = "15 fields to change". Tooltip on hover shows "5 fields × 3 assignments".
- Right: Clear All deselects all rows and hides the panel. A collapse control hides the panel body; only the header strip remains.
- Collapsed state: just the header strip. Re-expands on click or on new field input.

### Date Controls (three-mode per row)

Each date row (Due Date, Avail. From, Avail. Until) has three modes:

**Set** — reveals a date input. Sets that date to an exact value on all selected assignments.

**Shift** — reveals a +/− control and a day-count input. Shifts each assignment's existing date by ±N days relative to its current value. E.g., Shift +7 moves all due dates one week later without changing their relationship to each other.

**Clear** — no input shown. Displays contextual text: "Removes this date from all selected assignments." Clears that date field entirely — useful when moving assignments between courses.

Only one mode is active per row at a time.

**Apply same shift/clear to all dates** — checkbox below the three date rows. When checked, the shift value or clear action set on Due Date is mirrored to Avail. From and Avail. Until automatically. Individual rows can still be overridden after mirroring.

### Points

A single input: `Set all to... pts`. Sets all selected assignments to that exact point value. Blank = no change to points.

### Status

Two controls side by side:
- Publish — publishes all selected assignments
- Unpublish — unpublishes all selected assignments

These are independent action buttons, not toggles — clicking either fires the intent immediately. Selected assignments may have mixed publish status so neither button has a persistent "active" state.

### Editable Fields (complete list — no others)

Due Date · Avail. From · Avail. Until · Points · Published Status · Assignment Group. This is the complete set. All other fields are too edge-case for bulk editing.

**Assignment Group** is a single select: "No change" or a specific group. Setting it moves every selected assignment into that group in one operation. The Assignment Groups tool keeps its own per-assignment "move to group" dropdown for quick single-assignment moves made while browsing a group — that dropdown is not a bulk-select UI and isn't meant to become one. Multi-assignment group moves belong here, where selection, filtering, preview, and per-assignment failure handling already exist.

### Preview Changes Button

Primary action. Disabled until ≥1 field has an active value. Clicking opens the Preview Changes screen — no Canvas writes happen until after the teacher confirms there.

---

## Preview Changes Screen

A modal that appears after clicking Preview Changes. The teacher must review and confirm before any data is written.

### Layout: grouped by assignment

Changes are grouped into one block per assignment — not a flat table. Each block is headed by the assignment name, with its changed fields listed beneath. This keeps the unit of change (the assignment) scannable and avoids repeating the assignment name across multiple rows.

### Diff display

Each change renders as `old → new`. Old value and new value should have distinct visual weight so it's clear which is past and which is future — do not distinguish them by position alone.

Never rely on color as the sole indicator of old vs. new (WCAG: color is not the only signal). Weight, position, and the arrow glyph all reinforce the distinction.

### Behavior

- Only fields that are actually changing are shown
- The footer count matches the action panel: `N fields to change across N assignments`
- **Cancel** returns to the table with all selections and field values intact — nothing is lost
- **Confirm & Apply** fires the Canvas API writes and shows per-assignment progress

---

## After Apply — Result Screen

The Result screen adapts to the outcome. Successes are reassurance; failures are action items and get the visual weight.

### All succeeded

Show success count and offer a report link and a done action.

### Partial failure

Failures are prominent. The success list collapses behind a disclosure so the eye lands on failures first. **Retry all failed** re-fires only the failed writes and updates the result in place. Both states offer **View Report**.

### Error translation (status-code driven)

Canvas does not reliably document error bodies for the assignment-update endpoint, so we translate on the stable contract — the **HTTP status code** — never by string-matching message text.

| Status | Bucket | Teacher-facing message |
|---|---|---|
| 401 / 403 | Permission / auth | "You don't have permission to edit this assignment, or your Canvas token needs reconnecting." |
| 404 | Not found | "This assignment no longer exists in Canvas (it may have been deleted)." |
| 422 | Validation | Pass through Canvas's own field message — 422 bodies are usually already readable. |
| 429 | Rate limited | Handled automatically by the request queue; should rarely surface. |
| 5xx | Server error | "Canvas had a temporary problem. This usually works on retry." |

Blueprint-locked assignments typically surface as 401/403 and land in the permission bucket — acceptable, since Canvas gives no documented, stable way to detect the blueprint case specifically.

### Report storage (unified with Change Log)

There is **one** storage model, reached from two places:

- The **Change Log already stores every success** — it powers revert. A "success report" is just a view of that existing change-log entry; no new storage is added for successes.
- **Failures** are attached to the same change-log entry as a lightweight array — they are **not** revertable entries (they never happened), just record: `failures: [{ assignmentName, status, reason }]`. Small, no PII (assignment names are already logged).
- Therefore **View Report (Result screen) === opening that operation's Change Log entry.** History of recent reports comes for free from the Change Log.

---

## Change Log

### Purpose

Every successful Apply operation creates a change log entry stored in `chrome.storage.local` under `changeLogs[courseId]`. The log gives teachers a permanent record of what was changed and the ability to revert any operation.

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

`failures` is omitted or empty when every write succeeded. Because assignment names are already stored in `changes`, adding them here introduces no new PII category.

### Retention

Maximum 10 entries per course. When the 11th entry is added, the oldest is dropped. The log is per-course — there is no global cross-course log view.

### Change Log UI

Accessed from the tool. Shows all entries for the current course, most recent first. Each entry shows a timestamp, summary, and a Revert button. Entries can be expanded to show the field-by-field diff for each assignment.

### Revert Behavior

Clicking Revert on any log entry:

1. Shows a confirmation: "Revert these 4 changes? This will restore the previous values in Canvas."
2. On confirm, fires PUT requests to Canvas restoring previous values
3. Creates a new log entry of type "revert" with `revertedFromId` pointing to the original entry
4. Shows a revert summary report on completion

The revert operation itself is logged, making it revertable. Nothing is ever destructively removed from the log.

### Revert Summary Report

Shows what was successfully reverted and what was skipped (e.g., assignment no longer exists in Canvas). Skipped assignments are reported with a plain language reason. The revert continues past skipped items — it does not abort on failure.

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
10. Teacher enters values in bulk action panel
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

The `bulk_update` endpoint handles date changes efficiently. Point value and publish status changes are fired as individual PUT requests per assignment since `bulk_update` only covers dates.

---

## Components Built by This Feature

This feature builds the following additional components, which other tools can reuse:

| Component | Reused By |
|---|---|
| `AssignmentTable` | Copy Assignments (source step) |
| `BulkActionBar` (floating panel) | Copy Assignments |
| `PreviewDiff` | Any tool with a write + confirm step |
| Result screen (success / partial-fail layout) | Any write operation |
| `FilterBar` (chip filter bar) | Any table-primary tool that needs add-on filters |

---

## Filter and Sort Persistence

Filters and sort state are remembered for the duration of the browser session. If a teacher applies a date range filter, navigates to the template library, and returns to the bulk editor, their filters are still active.

When the teacher starts a new browser session, filters reset to the defaults defined in Settings. This prevents teachers from arriving to a previous session's filters unexpectedly.

Active filters are always visible and removable regardless of how they were applied.

### What Is Remembered Per Session

| State | Remembered |
|---|---|
| Active filters | Yes — per course, for session duration |
| Sort column and direction | Yes — per course, for session duration |
| Scroll position in table | Yes — per course, for session duration |
| Selected assignments | No — cleared on navigate away |
| Bulk action field values | No — cleared on navigate away |
| Last used course | Yes — persisted to storage across sessions |

Session state is held in React component state at the page level, not in storage. Navigation within the extension preserves state. Closing and reopening the tab starts fresh, but stored preferences (last course) are restored.

---

## Table States

| State | Trigger | Behavior |
|---|---|---|
| Loading | `getAssignments()` in flight | Skeleton placeholder rows in the shape of real content |
| Empty — no assignments | Course has zero assignments | Empty state: "No assignments in this course" |
| Empty — filtered | Active filters match nothing | Empty state: "No assignments match your filters" + Clear filters action |
| Error | API call fails | Inline error with plain-language message + Try again action |

The "Clear filters" action in the filtered-empty state fires the same function as the filter bar's own "Clear all" — one shared `clearFilters()` function, two entry points.
