# Canvas Power Tools — 13: Accommodation Override Manager

## Module Context

Accommodations is a Tool within the **People Module**, alongside Groups, Sections, and Roster. It lives in People rather than Assignments because the teacher's mental model starts with a specific student, not a specific assignment. The teacher thinks "I need to set up overrides for Jane" — not "I need to edit Quiz 1 for one student."

---

## Overview

The Accommodation Override Manager lets teachers apply different due dates to specific students across multiple assignments simultaneously. Canvas supports per-student assignment overrides but the native workflow requires opening each assignment individually and manually adding each student one at a time — a process that is nearly unusable at scale.

For a teacher managing students who need extra time or different deadlines across a full course, this feature can save hours of manual work per semester.

---

## FERPA Approach

This feature stores no disability data, accommodation reason, or any information about why a student is receiving a different due date.

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

The accommodation reason lives in the school's SIS — Skyward, PowerSchool, or similar. The extension only handles the output of that decision. This keeps the feature entirely outside FERPA disability data territory.

---

## Page Access

Accessible from the sidebar under People → Accommodations. Also accessible from Grading → Missing Work when a student is selected, allowing a teacher to move directly from identifying a problem to setting an override.

---

## Main List View

Shows a list of students who have active overrides in the selected course. Each student row shows:
- Student name
- Count of active overrides
- Next upcoming override date
- Edit and View actions

Controls: search bar, status filter, and a "+ New" action to start the override flow.

---

## Adding Override Flow

### Step 1 — Select Student

One student selected at a time. If the same override applies to multiple students, the teacher runs the flow once per student. This is intentional — override decisions are individual.

Shows a searchable student roster with radio selection. One student can be selected to proceed.

### Step 2 — Select Assignments

Shows all assignments in the course with checkboxes. Each row shows the assignment name, standard due date, and Jane's current override date (if one already exists) or the standard due date if not. This makes it clear what will change.

Controls: search, filter by type, Select All.

### Step 3 — Set Override Dates

Two modes:
- **Extend by days** — a single offset (e.g. "3 days") applied to all selected assignments relative to their standard due dates. Preview shows the resulting dates before confirming.
- **Set individually** — a date picker per assignment for cases where dates do not follow a consistent pattern.

The "extend by days" option covers the most common workflow — a student gets 3 extra days on every assignment.

### Preview and Confirm

Shows a table of the upcoming changes: assignment name, standard due date, and the student's new override date. Shows total count of overrides to be created or updated. PIN prompt appears here if PIN is enabled. Apply Overrides fires the Canvas API calls.

---

## Student Override Detail View

Clicking View on a student shows all assignments with their standard due date, override due date, and status (Upcoming, Past, No override). Past overrides remain visible for reference. Actions: Edit All, Remove All, and Add More Overrides.

---

## Editing and Removing Overrides

Individual override edits open inline in the detail view. Removing an override restores the assignment to the standard due date for that student.

Removing all overrides for a student removes them from the main list.

---

## Change Log Integration

Every override operation creates a change log entry. The revert system works the same as the bulk editor — restores the previous override state (or removes the override entirely if it was newly created).

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
- No disability data, accommodation reason, or any sensitive student information is stored anywhere in the extension at any time
