# Canvas Power Tools — 12: SpeedGrader Suite

---

## Overview

The SpeedGrader Suite is a set of four coordinated improvements to Canvas's
SpeedGrader workflow. It is not a Module within the Canvas Power Tools shell.
Instead, its Components are injected directly into Canvas's SpeedGrader page
(/courses/:id/gradebook/speed_grader) because the SpeedGrader workflow
requires operating inside Canvas's own UI.

SpeedGrader Tools are configured in Settings → SpeedGrader and deployed
automatically when a teacher opens SpeedGrader in Canvas. They appear as
panels alongside Canvas's existing SpeedGrader interface.

The suite does not attempt to change Canvas's document viewer, annotation
layer, or file rendering — those are not API-accessible. It improves the
surrounding workflow: comment management, class-wide navigation, keyboard
efficiency, and bulk grading actions.

Canvas's SpeedGrader is where teachers spend significant time each semester.
Small reductions in clicks per student multiply across a full class.

---

## Injection Approach

All four suite features are injected into the SpeedGrader page
(/courses/:id/gradebook/speed_grader) via the content script. They appear
as panels alongside Canvas's existing SpeedGrader UI rather than replacing
any Canvas elements.

The injected panels are designed to feel native to the SpeedGrader layout —
same font, similar visual weight, consistent with Canvas's sidebar style.

---

## Feature 1 — Comment Bank

### The Problem

Teachers leave the same comments dozens or hundreds of times per grading
session. Canvas provides no saved comment functionality. Every comment is
typed from scratch.

### What It Does

A collapsible panel injected into the SpeedGrader sidebar. Teachers build
a library of saved comments organized into categories. Any comment can be
inserted into the active comment field with one click.

### UI

```
┌───────────────────────────────────────────┐
│  Comment Bank                  [+ New]    │
├───────────────────────────────────────────┤
│  [Search comments...              ]       │
├───────────────────────────────────────────┤
│  General                        [+ Add]  │
│  ─────────────────────────────────────── │
│  Great work overall.            [Insert] │
│  Missing citation format.       [Insert] │
│  See rubric criteria for more   [Insert] │
│  detail on this section.                 │
│                                          │
│  Needs Improvement              [+ Add]  │
│  ─────────────────────────────────────── │
│  Please revise and resubmit.    [Insert] │
│  Response is incomplete.        [Insert] │
│                                          │
│  Encouragement                  [+ Add]  │
│  ─────────────────────────────────────── │
│  Much improved from last time.  [Insert] │
│  You are on the right track.    [Insert] │
└───────────────────────────────────────────┘
```

### Personalization Tokens

Comments support tokens that are replaced per student on insert:

| Token | Replaced With |
|---|---|
| {first_name} | Student's first name |
| {last_name} | Student's last name |
| {assignment_name} | Current assignment name |
| {score} | Current score entered |
| {points_possible} | Assignment's total points |

Example: "Hi {first_name}, your response on {assignment_name} was missing
a thesis statement." becomes "Hi Jane, your response on Essay 1 was missing
a thesis statement." when inserted for Jane.

### Comment Management

Adding a new comment opens a small inline form:

```
New Comment

Category: [General          ▼]    [+ New Category]
Text:
[                                              ]
[                                              ]
Tokens available: {first_name} {last_name}
                  {assignment_name} {score}

                      [Cancel]    [Save Comment]
```

Editing and deleting existing comments via right-click context menu or
hover actions on each comment row.

### Storage

Comment bank stored in chrome.storage.local. Synced index in
chrome.storage.sync so comment names are visible across devices. Full
comment text stays local.

---

## Feature 2 — Student Progress Panel

### The Problem

Canvas SpeedGrader shows one student at a time with no overview of the
class. Teachers have no way to see how far through grading they are, which
students are missing, or jump directly to a specific student without clicking
the arrow repeatedly.

### What It Does

A collapsible panel injected into the SpeedGrader sidebar showing the full
class roster with grading status. Clicking any student navigates directly
to their submission.

### UI

```
┌───────────────────────────────────────────┐
│  Quiz 1 — 28 Students                     │
│  Graded: 14    Remaining: 14              │
│  [████████████░░░░░░░░░░░░]   50%         │
├───────────────────────────────────────────┤
│  Filter: [All ▼]   Sort: [Name ▼]         │
├───────────────────────────────────────────┤
│  [G]  Chen, Amy              92 / 100     │
│  [G]  Davis, Marcus          87 / 100     │
│  [→]  Garcia, Sofia         ── (current) │
│  [S]  Johnson, Tom          submitted     │
│  [S]  Kim, Alex             submitted     │
│  [M]  Lee, Jordan           missing       │
│  [M]  Patel, Priya          missing       │
│  [M]  Rivera, Sam           missing       │
└───────────────────────────────────────────┘
```

### Status Indicators

| Indicator | Meaning |
|---|---|
| G — green | Graded — score shown |
| → — blue | Currently viewing |
| S — yellow | Submitted, not yet graded |
| M — red | Missing — no submission |
| L — orange | Late submission |
| E — purple | Excused |

### Filter and Sort

Teachers can filter the roster by status — show only ungraded, show only
missing, show only late. Sort by name, submission time, or current score.
This lets a teacher jump directly to all missing submissions or all late
submissions without scrolling through the full list.

### Panel State

The panel remembers its expanded or collapsed state per grading session.
The filter and sort settings persist for the duration of the session.

---

## Feature 3 — Keyboard Shortcuts

### The Problem

The core grading loop in SpeedGrader — enter grade, submit, advance to next
student — requires multiple mouse actions every single time. For a class of
30 students this is 90+ mouse clicks minimum.

### What It Does

Keyboard shortcuts injected into the SpeedGrader page for the most common
grading actions.

### Shortcut Reference

| Shortcut | Action |
|---|---|
| Alt + Right | Next student |
| Alt + Left | Previous student |
| Alt + G | Focus grade entry field |
| Alt + C | Focus comment field |
| Alt + Enter | Submit grade and advance to next student |
| Alt + 1 through 9 | Insert comment bank item by number (items 1-9) |
| Alt + S | Toggle student progress panel |
| Alt + B | Toggle comment bank panel |
| Escape | Clear focus, return to neutral state |

### Submit and Advance

Alt + Enter is the highest value shortcut. The current grading loop is:
1. Click grade field
2. Type grade
3. Click submit
4. Wait for save
5. Click next student arrow

With shortcuts:
1. Alt + G
2. Type grade
3. Alt + Enter (submits and advances automatically)

This reduces a 5-action loop to a 3-action loop. Over 30 students that is
60 fewer actions per assignment graded.

### Shortcut Discovery

A small keyboard icon appears in the SpeedGrader toolbar when the extension
is active. Hovering it shows a tooltip listing available shortcuts. Clicking
it opens the full shortcut reference panel.

---

## Feature 4 — Bulk Grade Actions

### The Problem

Certain grading operations need to apply to many students at once. Canvas
has no native solution for these.

### What It Does

A small toolbar injected above the SpeedGrader student navigation area.

```
[Grade Missing as Zero]    [Apply Comment to Selected]    [Export Grades]
```

### Grade Missing as Zero

Opens a confirmation showing all students with missing submissions.

```
┌─────────────────────────────────────────────────────────────────┐
│  Grade Missing as Zero                                          │
├─────────────────────────────────────────────────────────────────┤
│  The following students have no submission for Quiz 1.          │
│  They will receive a grade of 0.                                │
│                                                                 │
│  [x]  Jordan Lee          Missing since Oct 1                   │
│  [x]  Priya Patel         Missing since Oct 1                   │
│  [x]  Sam Rivera          Missing since Oct 1                   │
│                                                                 │
│  3 students will receive a zero.                                │
│                                                                 │
│  [x] Add comment: "No submission received."   [Edit comment]   │
│                                                                 │
│  Note: This may sync to your SIS. Revert is available          │
│  in the Change Log but may not reverse SIS sync.               │
│                                                                 │
│                          [Cancel]    [Apply Zeros]              │
└─────────────────────────────────────────────────────────────────┘
```

PIN required. Logged in audit log. Included in change log for revert.

### Apply Comment to Selected

Lets the teacher select multiple students from the progress panel and
send the same comment to all of them in one action.

```
┌─────────────────────────────────────────────────────────────────┐
│  Apply Comment to Selected Students                             │
├─────────────────────────────────────────────────────────────────┤
│  Selected students (3):                                         │
│  Jordan Lee, Priya Patel, Sam Rivera                            │
│                                                                 │
│  Comment:                                                       │
│  [Please see me during office hours to discuss          ]       │
│  [your submission.                                      ]       │
│                                                                 │
│  Or select from comment bank:  [Select comment ▼]              │
│                                                                 │
│  Personalization: {first_name} will be replaced per student    │
│                                                                 │
│  Sending to: 3 students                                         │
│                                                                 │
│                          [Cancel]    [Send Comments]            │
└─────────────────────────────────────────────────────────────────┘
```

PIN required. Logged in audit log.

### Export Grades

Exports the current assignment's grade data as a CSV for the teacher's
records. Does not write anything to Canvas.

```
Quiz 1 — Grades Export
Columns: Student Name, Student ID, Score, Points Possible,
         Percentage, Submission Status, Submission Time,
         Comment (if any)
```

---

## Data Flow for SpeedGrader Suite

```
Teacher opens SpeedGrader page
        ↓
Content script detects SpeedGrader URL pattern
        ↓
Injects panel containers into SpeedGrader layout
        ↓
getStudents(courseId) — populates progress panel
getSubmissions(courseId, assignmentId) — populates status indicators
getCommentBank() — loads from local storage
        ↓
Teacher grades student using shortcuts and comment bank
        ↓
Grade and comment written to Canvas via API
logToAuditLog() called
Change log entry created
        ↓
Progress panel updates in real time
```

---

## Canvas API Calls for SpeedGrader Suite

| Action | Method | Endpoint |
|---|---|---|
| List students | GET | /api/v1/courses/:id/students |
| List submissions | GET | /api/v1/courses/:id/submissions |
| Update grade | PUT | /api/v1/courses/:id/assignments/:id/submissions/:id |
| Add comment | PUT | /api/v1/courses/:id/assignments/:id/submissions/:id |

---

## Reusable Components from SpeedGrader Suite

| Component | Reused By |
|---|---|
| getStudents() | Group Manager, Section Mgmt, Accommodation Overrides, Communication |
| getSubmissions() | Missing Work Dashboard, Late Work Policy, At-Risk Dashboard |
| Student roster list | Accommodation Overrides, Communication Tools |
| Comment bank | Communication Tools bulk messaging |
| Progress bar | Any multi-step operation |
| Send log pattern | Communication Tools |
