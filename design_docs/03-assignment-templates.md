---

## Module Context

The Templates Tool lives in the **Assignments Module**, alongside Bulk Edit,
Rubrics, Assignment Groups, and Duplicate. Templates are a creation tool —
teachers think of them in the context of making assignments, which is why
they live in Assignments rather than a separate library. The template library
UI and folder architecture built here are reused by Rubrics and Announcement
Templates.

# Canvas Power Tools — 03: Assignment Templates

---

## What It Does

Assignment Templates lets teachers save assignment structures — everything
except dates — and redeploy them to one or more courses instantly. Instead of
recreating the same quiz format, homework structure, or project rubric from
scratch every semester, a teacher saves it once and reuses it forever.

Canvas has no native template system for assignments. This feature directly
reduces the most time-consuming part of course setup.

---

## Core Rule — No Dates in Templates

Templates never store any date fields. This is a firm design decision.

Date fields that are explicitly excluded:
- Due Date
- Available From
- Available Until

Dates are course-specific and semester-specific. Storing them in a template
would create more confusion than value. Dates are set at deploy time, at the
moment the teacher creates the assignment from the template.

---

## What a Template Does Store

| Field | Notes |
|---|---|
| Name | Used as the starting point — teacher typically edits per use |
| Description / Instructions | Often reused verbatim or with minor edits |
| Points | Usually consistent for the same assignment type |
| Submission Type | Online, on paper, external tool, etc. |
| Allowed Submission Formats | File upload, text entry, URL, media, etc. |
| Assignment Group | Homework, Quizzes, Exams, etc. |
| Grading Type | Points, percentage, letter grade, complete/incomplete |
| Peer Review | Enabled or disabled |

**Future (not in V1):** Rubric attachment. The rubric system is a separate
Canvas API concern and will be added in a later version. The field rubricId is
reserved in the data structure for this purpose.

---

## Template Data Structure

```javascript
// Single template item
{
  id: "template_abc123",
  folderId: "folder_xyz",      // null if unfiled
  name: "Weekly Quiz",          // the template's display name in the library
  createdAt: "2025-09-01T00:00:00Z",
  lastUsed: "2025-10-01T00:00:00Z",  // null if never used
  sourceAssignmentId: "67890",        // null if created from scratch
  fields: {
    name: "Weekly Quiz",              // assignment name when deployed
    description: "Complete all questions before the deadline.",
    points: 20,
    submissionType: "online",
    allowedFormats: [
      "online_text_entry",
      "online_upload"
    ],
    assignmentGroup: "Quizzes",
    gradingType: "points",
    peerReview: false
    // Future: rubricId: null
  }
}

// Folder
{
  id: "folder_xyz",
  name: "Quizzes",
  createdAt: "2025-09-01T00:00:00Z"
}
```

---

## Storage

**Primary store:** chrome.storage.local
Full template data — including descriptions, instructions, and all fields —
is stored in chrome.storage.local. This avoids the 8KB per-item size limit
in chrome.storage.sync, which a template with detailed instructions could
easily exceed.

**Sync layer:** chrome.storage.sync — template index only
A lightweight index containing only template IDs, names, and folder
assignments syncs across devices. This allows the library structure to follow
the teacher between machines.

**Cross-device behavior:**
When a teacher opens the extension on a new device, their template library
structure (folder names and template names) appears immediately via the sync
index. The full template content is not available until the teacher imports
a settings backup from their other device via the Settings export feature.

**Write strategy:**
1. Write full template to chrome.storage.local
2. Update the lightweight index in chrome.storage.sync
3. Update UI

**Read strategy:**
1. Read chrome.storage.local for full template data
2. Read chrome.storage.sync for index to confirm structure is current
3. If index and local differ, prompt teacher to re-sync or import

---

## Pages and Flows

The Templates Tool consists of four distinct views, all rendered within the Assignments Module:

1. Template Library — browse, organize, manage all templates
2. Template Editor — create or edit a template from scratch
3. Save as Template — lightweight modal on Canvas assignment pages
4. Deploy Template — select courses and create assignments

---

## 1. Template Library

The default view when a teacher navigates to Assignments → Templates.

### Layout

```
[Logo] Canvas Power Tools                              [Settings]

Assignment Templates                          [+ New Template]

[Search templates...                    ]

├── Quizzes  (3)                                    [+ New in folder]
│    Weekly Quiz           Last used Oct 1     [Use] [Edit] [Delete]
│    Chapter Quiz          Last used Sep 15    [Use] [Edit] [Delete]
│    Pop Quiz              Never used          [Use] [Edit] [Delete]
│
├── Homework  (2)                                   [+ New in folder]
│    Reading Response      Last used Oct 3     [Use] [Edit] [Delete]
│    Problem Set           Last used Sep 28    [Use] [Edit] [Delete]
│
└── Unfiled  (1)
     Draft Assignment      Never used          [Use] [Edit] [Delete]

[+ New Folder]
```

### Search Behavior

The search box filters across all templates in all folders simultaneously.
When a search is active, the folder structure collapses and results are shown
as a flat list. Clearing the search restores the folder view.

Search matches against the template name field only.

### Sort Order

Within each folder, templates are sorted by lastUsed descending by default —
most recently used templates appear at the top. Templates that have never been
used appear at the bottom. This default can be changed per session.

### Folder Operations

Folders can be renamed and deleted. Deleting a folder prompts: "Delete this
folder? Templates inside will be moved to Unfiled." Templates are never
deleted when a folder is deleted.

### Template Operations

**Use** — opens the Deploy Template flow
**Edit** — opens the Template Editor with this template's values pre-filled
**Delete** — prompts confirmation: "Delete Weekly Quiz? This cannot be undone."
Template deletion is permanent. There is no template-level change log or
versioning at this stage.

---

## 2. Template Editor

Used for both creating a new template from scratch and editing an existing one.
When editing, all fields are pre-filled with the template's current values.

### Layout

```
[Logo] Canvas Power Tools                    [< Back to Library]

New Template   (or: Edit Template — Weekly Quiz)

Template Name
[Weekly Quiz                                          ]

Folder
[Quizzes                                    ▼]    [+ New Folder]

── Assignment Fields ────────────────────────────────────────────

Assignment Name
[Weekly Quiz — Week ___                               ]
(This becomes the assignment name when deployed. Edit as needed.)

Instructions
[                                                     ]
[                                                     ]
[Rich text editor — bold, italic, lists, links        ]

Points
[20]

Assignment Group
[Quizzes                                    ▼]
(Groups are loaded from Canvas for the teacher's courses)

Grading Type
[Points                                     ▼]
Options: Points, Percentage, Letter Grade, Complete/Incomplete, Not Graded

Submission Type
[Online                                     ▼]
Options: Online, On Paper, No Submission, External Tool

Allowed Formats  (shown only when Submission Type is Online)
[x] Text Entry    [x] File Upload    [ ] URL    [ ] Media Recording

Peer Review
[ ] Enable peer review for this assignment

                              [Cancel]    [Save Template]
```

### Validation

Template Name is required.
Assignment Name is required.
Points must be a number greater than or equal to zero.
At least one Allowed Format must be selected when Submission Type is Online.

### Assignment Group Dropdown

The assignment group dropdown is populated by calling
getAssignmentGroups(courseId). Since templates are not tied to a specific
course, a default course is used to populate these options. If the teacher
uses the template in a different course that has different group names, the
group field is matched by name. If no match is found in the target course,
the field is left blank and the teacher is notified.

---

## 3. Save as Template — From Existing Canvas Assignment

A "Save as Template" button is injected into the Canvas assignment detail page
by the content script. It appears in the assignment header area alongside
Canvas's own action buttons.

Clicking it opens a lightweight modal — not a new page.

### Save as Template Modal

```
Save as Template                                      [Cancel]

Template Name
[Quiz 1                              ]
(Pre-filled with the Canvas assignment name — edit as needed)

Folder
[Unfiled                             ▼]    [+ New Folder]

The following fields will be saved:
Name, Instructions, Points, Submission Type,
Allowed Formats, Assignment Group, Grading Type, Peer Review

These fields will NOT be saved:
Due Date, Available From, Available Until,
Module Assignment, Student Overrides

                          [Cancel]    [Save Template]
```

The explicit list of what is and is not saved is intentional. It sets clear
expectations and prevents confusion about why dates do not appear in templates.

On save, the template is written to storage with sourceAssignmentId set to the
Canvas assignment's ID for traceability.

---

## 4. Deploy Template Flow

Accessed by clicking Use on any template in the library. Opens as a full page.

### Layout

```
[Logo] Canvas Power Tools              [< Back to Library]

Deploy Template — Weekly Quiz

Select courses to create this assignment in:

[x] Biology 101 — Fall 2025
[x] Biology 101 — Spring 2026
[ ] Chemistry 202 — Fall 2025
[ ] Lab Section A — Fall 2025

[Select All]    [Deselect All]

── Set Dates ────────────────────────────────────────────────────

Due Date          [__________]    (required to publish immediately)
Available From    [__________]    (optional)
Available Until   [__________]    (optional)

Leaving dates blank creates the assignment as undated and unpublished.
You can set dates later using the Bulk Assignment Editor.

── Preview ──────────────────────────────────────────────────────

Creating "Weekly Quiz" in 2 courses
Points: 20  |  Group: Quizzes  |  Type: Online, File Upload + Text Entry
Status: Unpublished (no due date set)

                              [Back]    [Create Assignments]
```

### Course Selection

All courses returned by getCourses() are listed. The teacher selects one or
more. At least one course must be selected before Create Assignments is enabled.

### Date Handling at Deploy Time

Dates are set here, not stored in the template. This is where dates live.

If Due Date is left blank, the assignment is created as undated and unpublished.
The preview text reflects this clearly.

If Due Date is filled in, the assignment is created and published.

Available From and Available Until are always optional.

The Bulk Assignment Editor is the recommended tool for setting or changing dates
after creation, especially when deploying to multiple courses with different
date schedules.

### After Deployment

```
Assignments Created

Successfully created: 2 assignments
  Biology 101 — Fall 2025        Weekly Quiz created
  Biology 101 — Spring 2026      Weekly Quiz created

Failed: 1
  Chemistry 202 — Fall 2025      Assignment group "Quizzes" not found
                                  Assignment created in Ungrouped

                                                    [Done]    [View in Bulk Editor]
```

The View in Bulk Editor button opens the Bulk Editor pre-filtered to the
newly created assignments, making it easy to set dates immediately after
creation.

---

## Relationship Between Templates and Bulk Editor

These two features are designed to work together as a natural workflow:

```
Teacher creates a template        (Template Editor or Save as Template)
        ↓
Teacher deploys to multiple courses    (Deploy Template)
        ↓
Assignments created undated
        ↓
Teacher opens Bulk Editor
        ↓
Filters to newly created assignments
        ↓
Sets dates in bulk across all courses
```

This workflow replaces what currently takes many minutes of clicking through
Canvas course by course.

---

## Future Additions — Noted, Not Scoped

**Rubric attachment**
Templates will eventually support attaching a saved rubric. The rubricId field
is reserved in the data structure. Canvas has a separate rubrics API. This is
a V2 addition.

**Template export and sharing**
Teachers will eventually be able to export templates as a file and share them
with colleagues. This requires defining an import/export format and handling
conflicts on import. Noted for a future version.

**Template versioning**
No version history is kept when a template is edited. The previous version is
overwritten. Version history may be added in a future version if teacher
feedback indicates it is needed.
