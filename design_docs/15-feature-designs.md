# Canvas Power Tools — 15: Feature Designs

---

## Overview

This document covers Tools not yet given their own dedicated design
document. Each section defines the Tool's Module context, scope, UI concept,
and Canvas API requirements. A full dedicated design document will be written
before development begins on each Tool.

---

## Grading Module — Overview Tool

### Purpose

A cross-assignment view of grading progress across a course. Distinct from
SpeedGrader which handles individual assignment grading. The Grading Dashboard
answers: "Where do I stand on grading across my whole course?"

### UI Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  Grading Dashboard         [Course: Biology 101 ▼]              │
├─────────────────────────────────────────────────────────────────┤
│  [All ▼]  [Filter by group ▼]  [Filter by status ▼]            │
├──────────────────────────────┬──────────────────────────────────┤
│  Assignment                  │ Graded   Submitted  Missing  Due │
├──────────────────────────────┼──────────────────────────────────┤
│  Quiz 1                      │ 24/28    2          2        Past│
│  Homework 3                  │ 12/28    8          8        Past│
│  Midterm                     │ 0/28     28         0        Oct 15│
│  Quiz 2                      │ 0/28     0          0        Oct 22│
├──────────────────────────────┼──────────────────────────────────┤
│  [Open in SpeedGrader]       [Grade Missing as Zero]            │
└─────────────────────────────────────────────────────────────────┘
```

Clicking a row opens that assignment in SpeedGrader. Clicking Grade Missing
as Zero on a past-due assignment fires the bulk zero workflow from the
SpeedGrader Suite.

### Canvas APIs
- GET /api/v1/courses/:id/assignments
- GET /api/v1/courses/:id/submissions

---

## Grading Module — Missing Work Tool

### Purpose

Operational view of what needs attention right now. Which students are
missing what, across which assignments, and for how long. Connects directly
to Communication Tools for one-click nudging.

### UI Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  Missing Work               [Course: Biology 101 ▼]             │
├─────────────────────────────────────────────────────────────────┤
│  View by: [Student ▼]   Filter: [All assignments ▼]             │
├─────────────────────────────────────────────────────────────────┤
│  Jane Smith              3 missing assignments                   │
│  Quiz 1 (8 days late) · Homework 3 (4 days late) · Quiz 2      │
│  [Nudge]    [Grade as Zero]    [View Profile]                   │
│                                                                  │
│  Marcus Johnson          1 missing assignment                    │
│  Homework 3 (4 days late)                                       │
│  [Nudge]    [Grade as Zero]    [View Profile]                   │
├─────────────────────────────────────────────────────────────────┤
│  Toggle view: [By Student]  [By Assignment]                      │
└─────────────────────────────────────────────────────────────────┘
```

By Assignment view shows each assignment with all students who are missing
it, rather than each student with all assignments they are missing.

Nudge opens the Communication Tools nudge flow pre-filled with the student
and assignment. Grade as Zero opens the bulk zero confirmation for that
student and assignment.

### Canvas APIs
- GET /api/v1/courses/:id/students
- GET /api/v1/courses/:id/assignments
- GET /api/v1/courses/:id/submissions

---

## Grading Module — Adjustments Tool

### Purpose

Apply mathematical adjustments to all grades on an assignment in bulk.
Covers the most common curving scenarios teachers face.

### Curve Types

| Type | Description | Example |
|---|---|---|
| Flat addition | Add a fixed number of points to every score | Everyone +5 points |
| Percentage scale | Multiply every score by a percentage | All scores × 1.1 |
| Score floor | No student scores below a minimum | No one below 60% |
| Square root curve | Classic curve — multiply sqrt of score by 10 | Standard bell curve adjustment |
| Highest score to 100 | Scale all scores so the top scorer gets 100% | Proportional adjustment |

### UI Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  Grade Curving               Assignment: [Quiz 1 ▼]             │
├─────────────────────────────────────────────────────────────────┤
│  Curve type:                                                    │
│  ○ Flat addition      Add [___] points to all scores            │
│  ○ Percentage scale   Multiply all scores by [___] %            │
│  ○ Score floor        No student scores below [___] %           │
│  ○ Scale to 100       Highest score becomes 100%                │
│  ○ Square root        Classic bell curve                        │
│                                                                 │
│  Apply to: ○ All students   ○ Students below [___] %            │
│                                                                 │
│  ── Preview ──────────────────────────────────────────────────  │
│  Student         Current    Curved    Change                    │
│  Jane Smith      58%        63%       +5 pts                   │
│  Marcus Johnson  64%        69%       +5 pts                   │
│  ...                                                            │
│                                                                 │
│  Class average: 74%  →  79%                                     │
│                                                                 │
│  [Cancel]                          [Apply Curve]                │
└─────────────────────────────────────────────────────────────────┘
```

Preview shows every student's adjusted grade before anything is written.
Class average shown before and after to give the teacher a quick sanity check.

PIN required. Logged in audit log and change log.

### Canvas APIs
- GET /api/v1/courses/:id/assignments/:id/submissions
- PUT /api/v1/courses/:id/assignments/:id/submissions/:id (per student)

---

## Grading Module — Late Policy Tool

### Purpose

Read submission timestamps, identify late work, and apply grade adjustments
according to the teacher's defined late policy — without manual grade editing
per student.

### Policy Definition

```
┌─────────────────────────────────────────────────────────────────┐
│  Late Policy                 Course: Biology 101                │
├─────────────────────────────────────────────────────────────────┤
│  Assignment types:                                              │
│  [x] Apply to Homework        Penalty: [10] % per [1] day(s)   │
│  [x] Apply to Quizzes         Penalty: [25] % flat after due   │
│  [ ] Apply to Exams           (No late penalty for exams)       │
│                                                                 │
│  Grace period: [0] hours after due date before penalty applies  │
│  Maximum penalty: [50] % (grade never drops below 50%)         │
│                                                                 │
│  [Save Policy]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Applying the Policy

After defining the policy, the teacher can run it against specific
assignments. The tool reads submission timestamps, calculates how many
days late each submission is, applies the penalty formula, and shows a
preview before writing any grades.

Canvas APIs:
- GET /api/v1/courses/:id/submissions
- PUT /api/v1/courses/:id/assignments/:id/submissions/:id

---

## Assignments Module — Extra Credit (Assignment Groups Tool)

### Purpose

Canvas's approach to extra credit is confusing. The standard method is a
zero-point assignment in a specific group. This feature provides a clean
interface for that workflow.

### What It Does

A toggle in the Assignment Group Manager and the Bulk Editor to mark
specific assignments as extra credit. Under the hood this sets the
assignment to 0 points possible in a designated extra credit group, while
allowing scores above zero to be entered.

Teachers can also view how extra credit is affecting each student's overall
grade via a simple overlay in the Grading Dashboard.

Canvas APIs:
- GET /api/v1/courses/:id/assignment_groups
- PUT /api/v1/courses/:id/assignments/:id

---

## People Module — Sections Tool

### Purpose

Teachers running multiple sections of the same course — Section A, Section B,
Section C — frequently need to push the same assignment to all sections or
set different due dates per section without editing each assignment
individually.

Canvas supports section-level assignment overrides but the native workflow
requires opening each assignment and setting each section override manually.

### UI Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  Section Management          Course: Biology 101                │
├─────────────────────────────────────────────────────────────────┤
│  Sections in this course:                                       │
│  Section A (28 students) · Section B (31 students) · Section C (29 students) │
│                                                                 │
│  [Set Section Due Dates]   [Cross-Section Grade Comparison]     │
├─────────────────────────────────────────────────────────────────┤
│  SET SECTION DUE DATES                                          │
│                                                                 │
│  Assignment: [Quiz 1                              ▼]            │
│                                                                 │
│  Section A    [Oct 1  ]                                         │
│  Section B    [Oct 2  ]    (meets a day later)                  │
│  Section C    [Oct 1  ]                                         │
│                                                                 │
│  Available from:  [Sep 28  ]  (same for all sections)           │
│  Available until: [Oct 3   ]  (same for all sections)           │
│                                                                 │
│  [Preview]      [Apply Section Dates]                           │
└─────────────────────────────────────────────────────────────────┘
```

Cross-Section Grade Comparison shows a side-by-side grade distribution
across sections for a selected assignment. Read-only — no data is written.

Canvas APIs:
- GET /api/v1/courses/:id/sections
- GET /api/v1/courses/:id/assignments/:id/overrides
- POST /api/v1/courses/:id/assignments/:id/overrides
- PUT /api/v1/courses/:id/assignments/:id/overrides/:id

---

## Assignments Module — Assignment Groups Tool

### Purpose

Canvas assignment groups control grade weighting — Homework 20%, Quizzes
30%, Exams 50%. The native interface for managing these is buried and
offers no visual feedback on how weights affect final grades.

### UI Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  Assignment Groups           Course: Biology 101                │
├─────────────────────────────────────────────────────────────────┤
│  Group            Weight    Assignments   Avg Score             │
│  ─────────────────────────────────────────────────────────────  │
│  Homework         20%       12            84%                   │
│  Quizzes          30%       8             76%                   │
│  Exams            50%       2             71%                   │
│                                                                 │
│  Total weight: 100%   Class average: 77.2%                      │
│                                                                 │
│  [+ Add Group]   [Reorder]   [Edit Weights]                     │
│                                                                 │
│  ── Weight Adjustment Preview ───────────────────────────────── │
│  Adjust weights and see live impact on class average.           │
│  Homework [20]%  Quizzes [30]%  Exams [50]%                    │
│  Projected class average with new weights: [____]%              │
└─────────────────────────────────────────────────────────────────┘
```

The live weight adjustment preview is the key value-add over Canvas's native
interface. Teachers can experiment with weighting before committing.

Canvas APIs:
- GET /api/v1/courses/:id/assignment_groups
- POST /api/v1/courses/:id/assignment_groups
- PUT /api/v1/courses/:id/assignment_groups/:id
- DELETE /api/v1/courses/:id/assignment_groups/:id

---

## People Module — Groups Tool

### Purpose

Canvas groups are used for collaborative assignments and peer review. Creating
and managing groups manually is extremely tedious for large classes.

### Auto-Assignment Criteria

| Criteria | Description |
|---|---|
| Random | Randomly distribute students into N groups of equal size |
| By last name | Alphabetical split into N groups |
| By performance | Split into groups based on current course grade — used to create mixed-ability groups or like-ability groups |
| Manual | Teacher defines groups by selecting students |

### UI Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  Group Manager               Course: Biology 101                │
├─────────────────────────────────────────────────────────────────┤
│  Group Set: [Lab Groups — Fall 2025             ▼]  [+ New Set] │
├─────────────────────────────────────────────────────────────────┤
│  Group 1 (5 students)                       [Edit]  [Delete]    │
│  Chen, Amy · Davis, Marcus · Garcia, Sofia · Johnson, Tom · Kim │
│                                                                 │
│  Group 2 (5 students)                       [Edit]  [Delete]    │
│  Lee, Jordan · Patel, Priya · Rivera, Sam · Brooks, Taylor · Wang│
│                                                                 │
│  [+ Add Group]   [Auto-Assign Students ▼]   [Shuffle All]       │
└─────────────────────────────────────────────────────────────────┘
```

Canvas APIs:
- GET /api/v1/courses/:id/groups
- GET /api/v1/courses/:id/group_categories
- POST /api/v1/courses/:id/group_categories
- POST /api/v1/group_categories/:id/groups
- PUT /api/v1/groups/:id/memberships

---

## Assignments Module — Rubrics Tool

### Purpose

Canvas's rubric builder is cumbersome. Rubrics cannot be easily reused
across courses. This feature provides a clean builder, a personal rubric
library, and cross-course rubric deployment.

### Scope

**In scope:**
- Build rubrics from scratch with a clean row-by-row interface
- Save rubrics to a local library organized by category
- Attach any saved rubric to any assignment in any course
- Copy a rubric that has already been used for grading into a new editable
  version (original preserved on past grades)
- View all rubrics in use across all courses

**Out of scope:**
- Editing rubrics already used in grading — Canvas locks these to preserve
  grade integrity. This is a Canvas restriction the extension cannot override
- Rubric outcome alignment (planned)

### Canvas API Note

Rubrics attached to assignments that have been graded become locked by Canvas.
The copy-as-new workflow creates a new rubric object via the API and attaches
it to new assignments going forward. The original rubric remains unchanged
on past submissions.

Canvas APIs:
- GET /api/v1/courses/:id/rubrics
- POST /api/v1/courses/:id/rubrics
- PUT /api/v1/courses/:id/rubrics/:id
- DELETE /api/v1/courses/:id/rubrics/:id
- POST /api/v1/courses/:id/rubric_associations

---

## Assignments Module — Duplicate Tool

### Purpose

Copy a single assignment from one course to another. Distinct from templates
(which are reusable structures) — this copies an existing assignment as-is.

### UI Concept

Simple two-step flow:
1. Select source assignment from a course
2. Select one or more destination courses

The duplicated assignment lands in the destination course as unpublished
with no due date, ready for the teacher to set dates and publish.

Canvas APIs:
- GET /api/v1/courses/:id/assignments
- POST /api/v1/courses/:id/assignments/:id/duplicate

---

## Settings — Popup Configuration

### Purpose

Allow teachers to configure what appears in the extension toolbar popup.
Currently the popup shows connection status, quick launch tools, and a
course list with per-course links.

### Customization Options

Teachers configure via Settings > Popup:
- Which courses appear (all active, recently accessed, or custom selection)
- Which quick launch tools appear
- Which per-course links appear (Grades, Assignments, Modules, etc.)
- Maximum number of courses shown
- Sort order of courses

No new Canvas API calls required — uses getCourses(), already built.

---

## Infrastructure — Developer Dashboard

### Purpose

A private web dashboard aggregating anonymous telemetry from teachers who
have opted in. Helps identify which Canvas updates break which selectors
and how many teachers are affected.

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
