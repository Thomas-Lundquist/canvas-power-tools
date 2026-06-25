## Module Context

Accommodations is a Tool within the **People Module**, alongside Groups,
Sections, and Roster. It lives in People rather than Assignments because the
teacher's mental model starts with a specific student, not a specific
assignment. The teacher thinks "I need to set up overrides for Jane" — not
"I need to edit Quiz 1 for one student."

---

# Canvas Power Tools — 13: Accommodation Override Manager

---

## Overview

The Accommodation Override Manager lets teachers apply different due dates
to specific students across multiple assignments simultaneously. Canvas
supports per-student assignment overrides but the native workflow requires
opening each assignment individually and manually adding each student one
at a time — a process that is nearly unusable at scale.

For a teacher managing students who need extra time or different deadlines
across a full course, this feature can save hours of manual work per semester.

---

## FERPA Approach

This feature stores no disability data, accommodation reason, or any
information about why a student is receiving a different due date.

What the extension stores:
```
Student: Jane Smith
Assignment: Quiz 1
Override due date: Oct 8
```

What the extension never stores:
```
Reason for override: [nothing]
Disability category: [nothing]
Accommodation type: [nothing]
```

The accommodation reason lives in the school's SIS — Skyward, PowerSchool,
or similar. The extension only handles the output of that decision. This
keeps the feature entirely outside FERPA disability data territory.

---

## Page Access

Accessible from the sidebar under People → Accommodations. Also accessible from Grading → Missing Work when a student is selected, allowing a teacher to move directly from identifying a problem to setting an override.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Canvas Power Tools      [Course: Biology 101 ▼]         │
├─────────────────────────────────────────────────────────────────┤
│  Accommodation Overrides                                        │
│                                                                 │
│  [Search students...     ]    [Filter by status ▼]   [+ New]   │
│                                                                 │
│  Jane Smith                                      [Edit] [View]  │
│  3 active overrides  |  Next override due: Oct 8                │
│                                                                 │
│  Marcus Johnson                                  [Edit] [View]  │
│  1 active override  |  Next override due: Oct 15                │
│                                                                 │
│  + Add student overrides                                        │
└─────────────────────────────────────────────────────────────────┘
```

The page shows a list of students who have active overrides in the selected
course. Each student shows a count of active overrides and the next upcoming
override date.

---

## Adding Override Flow

### Step 1 — Select Student

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Accommodation Overrides          [Cancel]                  │
├─────────────────────────────────────────────────────────────────┤
│  Step 1 of 3 — Select Student                                   │
│                                                                 │
│  [Search students...                              ]             │
│                                                                 │
│  ○ Jane Smith                                                   │
│  ○ Marcus Johnson                                               │
│  ○ Priya Patel                                                  │
│  ○ Alex Kim                                                     │
│  ...                                                            │
│                                                                 │
│                                      [Cancel]    [Next]         │
└─────────────────────────────────────────────────────────────────┘
```

One student selected at a time. If the same override applies to multiple
students, the teacher runs the flow once per student. This is intentional —
override decisions are individual.

### Step 2 — Select Assignments

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Accommodation Overrides — Jane Smith     [Cancel]          │
├─────────────────────────────────────────────────────────────────┤
│  Step 2 of 3 — Select Assignments                               │
│                                                                 │
│  [Search assignments...    ]   [Filter: All ▼]  [Select All]   │
│                                                                 │
│  [x]  Quiz 1               Due: Oct 1    Jane's current: Oct 1 │
│  [x]  Homework 3           Due: Oct 5    Jane's current: Oct 5 │
│  [ ]  Midterm              Due: Oct 15   Jane's current: Oct 15│
│  [x]  Quiz 2               Due: Oct 22   Jane's current: Oct 22│
│                                                                 │
│  3 assignments selected                                         │
│                                                                 │
│                                      [Back]    [Next]           │
└─────────────────────────────────────────────────────────────────┘
```

The table shows Jane's current override date if one already exists, or the
standard due date if not. This makes it clear what will change.

### Step 3 — Set Override Dates

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Accommodation Overrides — Jane Smith     [Cancel]          │
├─────────────────────────────────────────────────────────────────┤
│  Step 3 of 3 — Set Override Dates                               │
│                                                                 │
│  Apply the same offset to all selected assignments:             │
│  ○ Extend by [___] days from standard due date                  │
│  ○ Set a specific date for each assignment individually         │
│                                                                 │
│  ── If extending by days ─────────────────────────────────────  │
│                                                                 │
│  Extend by: [3] days                                            │
│                                                                 │
│  Preview:                                                       │
│  Quiz 1       Oct 1   →   Oct 4                                 │
│  Homework 3   Oct 5   →   Oct 8                                 │
│  Quiz 2       Oct 22  →   Oct 25                                │
│                                                                 │
│  ── If setting individually ─────────────────────────────────── │
│                                                                 │
│  Quiz 1       [Oct 4    ]                                       │
│  Homework 3   [Oct 8    ]                                       │
│  Quiz 2       [Oct 25   ]                                       │
│                                                                 │
│                                      [Back]    [Preview]        │
└─────────────────────────────────────────────────────────────────┘
```

The "extend by days" option is the most common workflow — a student gets
3 extra days on every assignment. The "set individually" option handles
exceptions where dates do not follow a consistent pattern.

### Preview and Confirm

```
┌─────────────────────────────────────────────────────────────────┐
│  Confirm Override Changes — Jane Smith        [Cancel]          │
├─────────────────────────────────────────────────────────────────┤
│  The following overrides will be applied in Canvas:             │
│                                                                 │
│  Assignment      Standard Due    Jane's Override                │
│  ─────────────────────────────────────────────────             │
│  Quiz 1          Oct 1           Oct 4                          │
│  Homework 3      Oct 5           Oct 8                          │
│  Quiz 2          Oct 22          Oct 25                         │
│                                                                 │
│  3 overrides will be created or updated in Canvas.              │
│                                                                 │
│  [PIN prompt appears here if PIN is enabled]                    │
│                                                                 │
│                          [Cancel]    [Apply Overrides]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Student Override Detail View

Clicking View on a student in the main list:

```
┌─────────────────────────────────────────────────────────────────┐
│  Jane Smith — Overrides          [Edit All]  [Remove All]  [x]  │
├─────────────────────────────────────────────────────────────────┤
│  Assignment      Standard Due    Override Due    Status         │
│  ─────────────────────────────────────────────────────────────  │
│  Quiz 1          Oct 1           Oct 4           Upcoming       │
│  Homework 3      Oct 5           Oct 8           Upcoming       │
│  Midterm         Oct 15          Oct 15          No override     │
│  Quiz 2          Oct 22          Oct 25          Upcoming       │
│                                                                 │
│  [+ Add More Overrides]                                         │
└─────────────────────────────────────────────────────────────────┘
```

Status options: Upcoming, Past, No override. Past overrides remain visible
for the teacher's reference but are grayed out.

---

## Editing and Removing Overrides

Individual override edits open inline in the detail view. Removing an
override restores the assignment to the standard due date for that student.

Removing all overrides for a student removes them from the main list.

---

## Change Log Integration

Every override operation creates a change log entry. The revert system
works the same as the bulk editor — restores the previous override state
(or removes the override entirely if it was newly created).

---

## Canvas API Calls

| Action | Method | Endpoint |
|---|---|---|
| List students | GET | /api/v1/courses/:id/students |
| List assignments | GET | /api/v1/courses/:id/assignments |
| List existing overrides | GET | /api/v1/courses/:id/assignments/:id/overrides |
| Create override | POST | /api/v1/courses/:id/assignments/:id/overrides |
| Update override | PUT | /api/v1/courses/:id/assignments/:id/overrides/:id |
| Delete override | DELETE | /api/v1/courses/:id/assignments/:id/overrides/:id |

---

## Security

- PIN required before any overrides are applied
- All operations logged in audit log with student name and affected assignments
- Logged in change log for revert capability
- No disability data, accommodation reason, or any sensitive student information
  is stored anywhere in the extension at any time
