# Canvas Power Tools — 02: Bulk Assignment Editor

---

## What It Does

The Bulk Assignment Editor is the first and flagship feature of Canvas Power
Tools. It gives teachers a full-page interface to select multiple assignments
across a course and edit their due dates, availability dates, point values, and
publish status all at once — without clicking into each assignment individually.

Canvas has no native bulk editing capability for assignments. This feature alone
justifies the extension.

---

## How It Is Accessed

A button labeled something like "Power Tools" or "Bulk Editor" is injected into
the Canvas assignments page toolbar by the content script. Clicking it opens the
Bulk Assignment Editor as a new tab — a full extension page served by the
extension itself.

---

## Page Structure

The page has four main sections:

1. Top bar — logo, course selector, navigation links
2. Filter bar — search and column filters
3. Assignment table — the main data view
4. Bulk action bar — appears when assignments are selected

---

## Top Bar

```
[Logo] Canvas Power Tools     [Course: Fall 2025 Biology 101 ▼]     [Change Log]  [Settings]
```

The course selector is a dropdown populated by getCourses(). Changing the
course reloads the assignment table. The last used course is remembered via
preferences.lastUsedCourseId in storage.

---

## Filter Bar

```
[Search assignments...        ]     [Clear All Filters]     [Select All]
Active filters: Due Date: Oct 1–Oct 31  |  Status: Published  [x]
```

Active filters are shown as removable chips. Clear All Filters removes every
active filter at once. Each chip has an X to remove that filter individually.

---

## Assignment Table

### Columns

Every column is sortable (click header to sort ascending, click again for
descending) and filterable (filter icon in header opens filter control).

| Column | Filter Type | Notes |
|---|---|---|
| Checkbox | — | Select / deselect individual rows |
| Assignment Name | Text search | Searches name field |
| Group | Multi-select dropdown | Canvas assignment groups |
| Module | Multi-select dropdown | Canvas modules |
| Due Date | Date range picker | Filter to a date window |
| Available From | Date range picker | Filter to a date window |
| Available Until | Date range picker | Filter to a date window |
| Points | Min / max number range | e.g. show only assignments worth 50+ points |
| Status | Multi-select | Published, Unpublished, Draft |

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

## Bulk Action Bar

The bulk action bar appears at the bottom of the page when one or more
assignments are selected. It is hidden when nothing is selected.

```
3 assignments selected

Due Date:         ○ Set date  [__________]     ○ Shift  [+/-]  [___]  days
Available From:   ○ Set date  [__________]     ○ Shift  [+/-]  [___]  days
Available Until:  ○ Set date  [__________]     ○ Shift  [+/-]  [___]  days

[ ] Shift all date fields together     ← reflects Settings default, overridable here

Points:    Set all to  [_____]  pts

Status:    [Publish]    [Unpublish]

                                        [Preview Changes]    [Apply to Canvas]
```

### Date Controls

Each date field has two modes selected by radio button:

**Set date** — enter a specific date. All selected assignments get that exact
date regardless of their current value.

**Shift** — enter a positive or negative number of days. Each selected
assignment's date is shifted by that amount relative to its current value.
Example: shift +7 moves all due dates one week later.

### Shift All Date Fields Together Toggle

When this toggle is ON, changing the shift value for Due Date automatically
mirrors the same value to Available From and Available Until. The teacher can
still override individual fields after the mirror. The toggle default reflects
the preferences.shiftAllDatesTogether value from Settings, but can be changed
here per session without affecting the global preference.

### Points

Entering a value in the Points field sets all selected assignments to exactly
that point value. Leaving it blank makes no change to points.

### Status

Publish sets all selected assignments to published state.
Unpublish sets all selected assignments to unpublished state.
These are mutually exclusive actions — clicking one does not affect the other
control.

### Apply Button

Apply to Canvas is disabled until at least one field has a value entered.
Clicking it does not immediately write to Canvas — it opens the Preview Changes
screen first.

---

## Preview Changes Screen

A modal that appears after clicking Apply to Canvas. The teacher must review
and confirm before any data is written.

```
Preview Changes                                              [Cancel]

Assignment         Field             From              To
──────────────────────────────────────────────────────────────────
Quiz 1             Due Date          Oct 1, 2025       Oct 8, 2025
Quiz 1             Points            20                25
Homework 3         Due Date          Oct 5, 2025       Oct 12, 2025
Homework 3         Available Until   Oct 6, 2025       Oct 13, 2025

4 changes across 2 assignments

                                      [Cancel]    [Confirm & Apply]
```

Only fields that are actually changing are shown. If the teacher set a due date
but left points blank, only due date rows appear.

The teacher can click Cancel to go back and adjust their selections without
losing anything.

Confirm & Apply fires the Canvas API write operations and shows a progress
indicator.

---

## After Apply — Result Screen

```
Changes Applied

Successfully updated: 2 assignments
  Quiz 1         — due date, points updated
  Homework 3     — due date, availability updated

Failed: 0

                                                        [Done]
```

If any assignments fail to update, they are listed with the error reason. The
teacher is never left wondering what happened.

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
  ]
}
```

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

## Reusable Components Built by This Feature

These components are built for the bulk editor but designed to be reused by
every subsequent feature:

| Component | Reused By |
|---|---|
| getCourses() | Templates, Groups, Grading |
| getAssignments() | Templates, Grading |
| Course dropdown selector | Every feature page |
| Checkbox multi-select table | Groups, student lists, any bulk operation |
| Column filter system | Any table view |
| Date range filter | Any date-related feature |
| Date picker input | Any form with dates |
| Preview diff modal | Any write operation |
| Result summary screen | Any write operation |
| Change log system | Grading, Groups when added |
| Bulk action bar pattern | Any bulk operation feature |
