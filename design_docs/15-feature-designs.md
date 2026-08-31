# Canvas Power Tools — 15: Feature Designs

---

## Overview

This document covers Tools not yet given their own dedicated design document. Each section defines the Tool's Module context, scope, and Canvas API requirements. A full dedicated design document will be written before development begins on each Tool.

---

## Grading Module — Overview Tool

### Purpose

A cross-assignment view of grading progress across a course. Distinct from SpeedGrader which handles individual assignment grading. The Grading Dashboard answers: "Where do I stand on grading across my whole course?"

### What It Shows

A table of all assignments with grading status columns: how many students are graded, submitted but ungraded, missing, and the due date. Filterable by assignment group and status.

Per-row actions: Open in SpeedGrader (navigates to that assignment), Grade Missing as Zero (fires the bulk zero workflow from the SpeedGrader Suite).

### Canvas APIs
- GET /api/v1/courses/:id/assignments
- GET /api/v1/courses/:id/submissions

---

## Grading Module — Missing Work Tool

### Purpose

Operational view of what needs attention right now. Which students are missing what, across which assignments, and for how long. Connects directly to Communication Tools for one-click nudging.

### What It Shows

Two views (togglable): By Student (each student with all their missing assignments listed) and By Assignment (each assignment with all missing students).

Per-student/per-row actions: Nudge (opens the Communication Tools nudge flow pre-filled with the student and assignment), Grade as Zero (opens the bulk zero confirmation).

### Canvas APIs
- GET /api/v1/courses/:id/students
- GET /api/v1/courses/:id/assignments
- GET /api/v1/courses/:id/submissions

---

## Grading Module — Adjustments Tool

### Purpose

Apply mathematical adjustments to all grades on an assignment in bulk. Covers the most common curving scenarios teachers face.

### Curve Types

| Type | Description | Example |
|---|---|---|
| Flat addition | Add a fixed number of points to every score | Everyone +5 points |
| Percentage scale | Multiply every score by a percentage | All scores × 1.1 |
| Score floor | No student scores below a minimum | No one below 60% |
| Square root curve | Classic curve — multiply sqrt of score by 10 | Standard bell curve adjustment |
| Highest score to 100 | Scale all scores so the top scorer gets 100% | Proportional adjustment |

### Flow

1. Select assignment
2. Choose curve type and enter parameters
3. Choose whether to apply to all students or only those below a threshold
4. Preview every student's adjusted grade before writing anything (with class average before and after)
5. Confirm → PIN required → Apply

Logged in audit log and change log.

### Canvas APIs
- GET /api/v1/courses/:id/assignments/:id/submissions
- PUT /api/v1/courses/:id/assignments/:id/submissions/:id (per student)

---

## Grading Module — Late Policy Tool

### Purpose

Read submission timestamps, identify late work, and apply grade adjustments according to the teacher's defined late policy — without manual grade editing per student.

### Policy Definition

Per assignment type (Homework, Quizzes, Exams), the teacher defines:
- Whether a penalty applies
- Penalty type: flat percentage deduction, or per-day percentage penalty
- Grace period (hours after due date before penalty applies)
- Maximum penalty cap (grade never drops below X%)

### Applying the Policy

After defining the policy, the teacher can run it against specific assignments. The tool reads submission timestamps, calculates how many days late each submission is, applies the penalty formula, and shows a preview before writing any grades.

### Canvas APIs
- GET /api/v1/courses/:id/submissions
- PUT /api/v1/courses/:id/assignments/:id/submissions/:id

---

## Assignments Module — Extra Credit (Assignment Groups Tool)

### Purpose

Canvas's approach to extra credit is confusing. The standard method is a zero-point assignment in a specific group. This feature provides a clean interface for that workflow.

### What It Does

A toggle in the Assignment Group Manager and the Bulk Editor to mark specific assignments as extra credit. Under the hood this sets the assignment to 0 points possible in a designated extra credit group, while allowing scores above zero to be entered.

Teachers can also view how extra credit is affecting each student's overall grade via a simple overlay in the Grading Dashboard.

### Canvas APIs
- GET /api/v1/courses/:id/assignment_groups
- PUT /api/v1/courses/:id/assignments/:id

---

## People Module — Sections Tool

### Purpose

Teachers running multiple sections of the same course frequently need to push the same assignment to all sections or set different due dates per section without editing each assignment individually.

Canvas supports section-level assignment overrides but the native workflow requires opening each assignment and setting each section override manually.

### What It Does

Two modes:
- **Set Section Due Dates** — select an assignment, set a different due date per section. Available From and Available Until can be shared across all sections. Preview → Apply.
- **Cross-Section Grade Comparison** — side-by-side grade distribution across sections for a selected assignment. Read-only.

### Canvas APIs
- GET /api/v1/courses/:id/sections
- GET /api/v1/courses/:id/assignments/:id/overrides
- POST /api/v1/courses/:id/assignments/:id/overrides
- PUT /api/v1/courses/:id/assignments/:id/overrides/:id

---

## Assignments Module — Assignment Groups Tool

### Purpose

Canvas assignment groups control grade weighting — Homework 20%, Quizzes 30%, Exams 50%. The native interface for managing these is buried and offers no visual feedback on how weights affect final grades.

### What It Does

A table of all assignment groups with their weight, assignment count, and average score. Actions: Add Group, Reorder, Edit Weights.

Each group also expands to list its assignments. Within that list, assignments can be reordered (arrow-based, same pattern as group reordering) or bulk-sorted (Name / Points / Due Date, ascending or descending, via a "Sort" menu in the group's header toolbar). Canvas has no bulk reorder endpoint for assignments within a group, so both write per-assignment `position` via the update-assignment endpoint (individual PUT requests). The active sort is remembered per group and shown on the Sort trigger until a manual arrow-nudge invalidates it. This is separate from the assignment-to-assignment-group move (the per-row "move to group" dropdown) and from ASN-003's course-wide bulk reorder in the Bulk Edit Tool.

The group's header toolbar is a "Rename" button plus two menus (using the shared `Menu` component) to avoid crowding: a "Sort" menu (per above) and an "Actions" menu holding Duplicate, Copy to, Merge, a "Manage" submenu (Move assignments, Delete assignments), and Delete Group. The two bulk assignment-selection actions are nested under "Manage" (via `Menu.Submenu`, a flyout nested one level inside `Menu`) rather than sitting as top-level entries — their full labels widened the flat list more than the rest.

**Move assignments** (Actions → Manage) opens a modal scoped to that one group: a destination-group picker plus a checklist of the group's assignments (with Select All) to move in bulk to the chosen group. Normal PIN gate (not forced) — same severity as the existing per-row "move to group" dropdown, just batched.

**Delete assignments** (Actions → Manage) opens a modal scoped to that one group, listing its assignments with checkboxes (plus Select All) so the teacher picks a subset to permanently delete from Canvas — including their submissions and grades. This is a forced-PIN operation (see Doc 11, Forced PIN Re-Entry): the PIN prompt shows every time regardless of recent verification, and carries an explicit irreversible-deletion warning. There is no Change Log entry for deletions (they are not revertable); the audit log still records the action.

Key value-add: a live weight adjustment preview that recalculates and displays the projected class average in real time as the teacher adjusts weights — before committing anything to Canvas.

### Canvas APIs
- GET /api/v1/courses/:id/assignment_groups
- POST /api/v1/courses/:id/assignment_groups
- PUT /api/v1/courses/:id/assignment_groups/:id
- DELETE /api/v1/courses/:id/assignment_groups/:id

---

## People Module — Groups Tool

### Purpose

Canvas groups are used for collaborative assignments and peer review. Creating and managing groups manually is extremely tedious for large classes.

### Auto-Assignment Criteria

| Criteria | Description |
|---|---|
| Random | Randomly distribute students into N groups of equal size |
| By last name | Alphabetical split into N groups |
| By performance | Split into groups based on current course grade — used to create mixed-ability or like-ability groups |
| Manual | Teacher defines groups by selecting students |

### What It Shows

A Group Set picker (with option to create new sets). Each group listed with its members. Actions: Add Group, Auto-Assign Students (with criteria picker), Shuffle All, Edit, Delete per group.

### Canvas APIs
- GET /api/v1/courses/:id/groups
- GET /api/v1/courses/:id/group_categories
- POST /api/v1/courses/:id/group_categories
- POST /api/v1/group_categories/:id/groups
- PUT /api/v1/groups/:id/memberships

---

## Assignments Module — Rubrics Tool

### Purpose

Canvas's rubric builder is cumbersome. Rubrics cannot be easily reused across courses. This feature provides a clean builder, a personal rubric library, and cross-course rubric deployment.

### Scope

**In scope:**
- Build rubrics from scratch with a clean row-by-row interface
- Save rubrics to a local library organized by category
- Attach any saved rubric to any assignment in any course
- Copy a rubric that has already been used for grading into a new editable version (original preserved on past grades)
- View all rubrics in use across all courses

**Out of scope:**
- Editing rubrics already used in grading — Canvas locks these to preserve grade integrity. This is a Canvas restriction the extension cannot override.
- Rubric outcome alignment (planned)

### Canvas API Note

Rubrics attached to assignments that have been graded become locked by Canvas. The copy-as-new workflow creates a new rubric object via the API and attaches it to new assignments going forward. The original rubric remains unchanged on past submissions.

### Canvas APIs
- GET /api/v1/courses/:id/rubrics
- POST /api/v1/courses/:id/rubrics
- PUT /api/v1/courses/:id/rubrics/:id
- DELETE /api/v1/courses/:id/rubrics/:id
- POST /api/v1/courses/:id/rubric_associations

---

## Assignments Module — Duplicate Tool

### Purpose

Copy a single assignment from one course to another. Distinct from templates (which are reusable structures) — this copies an existing assignment as-is.

### Flow

1. Select source assignment from a course
2. Select one or more destination courses

The duplicated assignment lands in the destination course as unpublished with no due date, ready for the teacher to set dates and publish.

### Canvas APIs
- GET /api/v1/courses/:id/assignments
- POST /api/v1/courses/:id/assignments/:id/duplicate

---

## Settings — Popup Configuration

### Purpose

Allow teachers to configure what appears in the extension toolbar popup. Currently the popup shows connection status, quick launch tools, and a course list with per-course links.

### Customization Options

Teachers configure via Settings > Popup:
- Which courses appear (all active, recently accessed, or custom selection)
- Which quick launch tools appear
- Which per-course links appear (Grades, Assignments, Modules, etc.)
- Maximum number of courses shown
- Sort order of courses

No new Canvas API calls required — uses `getCourses()`, already built.

---

## Infrastructure — Developer Dashboard

### Purpose

A private web dashboard aggregating anonymous telemetry from teachers who have opted in. Helps identify which Canvas updates break which selectors and how many teachers are affected.

### Requirements

- Lightweight backend server (Node.js + Hono or Express)
- Simple database (PostgreSQL or SQLite)
- Opt-in toggle in extension Settings (off by default)
- Anonymous payload only — no PII, no institution data, no course content

### Dashboard Metrics

- Selector health across all reporting users
- Canvas version breakdown correlated with failures
- Extension versions in the wild
- Recent failure log with drill-down detail

Full design in Document 06: DOM Resilience and Diagnostics.
