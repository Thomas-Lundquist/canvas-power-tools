# Canvas Power Tools — 03: Assignment Templates

## Module Context

The Templates Tool lives in the **Assignments Module**, alongside Bulk Edit, Rubrics, Assignment Groups, and Duplicate. Templates are a creation tool — teachers think of them in the context of making assignments, which is why they live in Assignments rather than a separate library. The template library UI and folder architecture built here are reused by Rubrics and Announcement Templates.

---

## Product Decisions

These decisions define how the system works. They are architectural and should not change without a documented reason.

| # | Decision | Rationale |
|---|---|---|
| 1 | **Deployment is split by cardinality.** The PowerTools dashboard owns the Library and the Bulk Deployment Engine (many courses at once). Canvas injection owns two lightweight buttons — *Save to Templates* and *Create from Template* — for single, in-context actions. | Multi-course batch deploy is the headline value Canvas cannot replicate — it belongs in the dashboard. Single, precise deploy wants the module context that only exists inside Canvas. Each path lives where it is strongest. |
| 2 | **Injected buttons trigger only; the extension does all API work.** | Hard architectural rule: content scripts inject trigger UI, never call the Canvas API. Keeps the injected DOM footprint tiny and API access centralized in `request.js`. |
| 3 | **"Create from Template" requires a minimum of 2 steps (pick template → deploy); dates and publish are optional.** | The single-target path is exactly where a teacher is setting up one specific thing. Optional fields keep the "fast" promise for those who want it. |
| 4 | **Templates store two types: `assignment` and `page`.** Quizzes are deferred. | Assignments cover most of what teachers reuse; Pages are the next-simplest shape. New Quizzes is a separate API surface and is deferred. |
| 5 | **Instructions are stored as verbatim Canvas HTML and rendered sanitized, read-only.** No WYSIWYG editor in PowerTools. | "Save once, redeploy faithfully" requires lossless capture. Rendering saved HTML needs a sanitizer, not a full editor. |
| 6 | **Editing model: structured fields are editable forms; the instructions body is edited via a raw-HTML source view (light edits) or by re-capturing from the Canvas RCE (heavy edits).** | Matching the RCE means re-implementing Canvas's media/embed pickers against course-scoped resources. "Light edits here, heavy edits in Canvas" is honest and avoids shipping a large, worse editor. |
| 7 | **Rendering always sanitizes** (bundled DOMPurify, allow-list). Storing verbatim HTML is not the same as it being safe. | Canvas sanitizes on its own input/render. The captured string is untrusted the moment it is injected into our DOM — XSS risk unless sanitized at render time. |
| 8 | **Assignment Group is a text label, not a course-bound selection.** The editor field is a type-ahead combobox (free text + suggestions), resolved by name at deploy. | A template is course-agnostic — group IDs are only valid inside their own course. The template stores the name; the real group object exists only at deploy time. |
| 9 | **Deploy resolves groups by name, and creates the group if it does not exist** — shown as a per-course mappable field the teacher can redirect. | Assignment groups carry grade weight; a silent fallback could wreck a gradebook. The mapping is always visible so the teacher controls which grade bucket each course's assignment lands in. |
| 10 | **Publish state defaults to Auto: publish if a due date is set, otherwise leave as a draft.** Editor holds a default preference; deploy offers Auto / Published / Unpublished. | Publish is a semester-context truth like dates, not a stored fact. "Has a due date" is a good proxy for "ready to publish." |
| 11 | **Library offers a grouped list view and a card view** where each card shows a scaled, sanitized HTML thumbnail of the instructions. | The list is dense and clearest for scanning; the card thumbnails reuse HTML we already store to give a real document preview. List ships first; cards are the toggle. |
| 12 | **Variables and New Quizzes are deferred — but their seams are reserved now.** Instructions are stored as an unresolved template string; the schema reserves `engine`. | "Table the feature, reserve the seam." Storing pre-rendered instructions or hardcoding the assignment API would block variables and New Quizzes permanently. |

**Deferred with seams reserved:**

- **Dynamic variables**, in two tiers. Auto-resolved tokens (`[Course Name]`, `[Due Date]`, `[Term]`) are cheap — the data already exists at deploy time. User-prompted tokens need an authoring syntax and a fill-in step at deploy. Neither is specced now.
- **New Quizzes** (`engine: "new_quiz"`) — separate `/quiz-lti` API surface.
- **Rubric attachment** (`rubricId`).
- **Course-scoped media rehoming** — see the known limitation below.

---

## What It Does

Assignment Templates lets teachers capture an assignment's (or page's) structure once — everything except dates — and redeploy it into one or more courses as real Canvas content. Instead of rebuilding the same quiz format, homework structure, or project page from scratch every semester, a teacher saves it once and reuses it forever.

Canvas has no native template system for assignments. This feature directly reduces the most time-consuming part of course setup — and pairs a dashboard for organizing and batch-deploying with in-context Canvas buttons for capturing and dropping single items exactly where the teacher is working.

---

## Core Rule — No Dates in Templates

Templates never store any date fields. This is a firm design decision.

Date fields that are explicitly excluded:
- Due Date
- Available From
- Available Until

Dates are course-specific and semester-specific. Storing them in a template would create more confusion than value. Dates are set at deploy time. Publish state follows the same logic — it is a deploy-time truth, not a stored one (Decision 10).

---

## Template Types

A template is one of two types:

| Type | Captures | Deploys to |
|---|---|---|
| `assignment` | Name, Instructions, Points, Submission Type, Allowed Formats, Assignment Group, Grading Type, Peer Review | A course assignment (optionally into a module) |
| `page` | Name, Instructions (body) | A course Page (Pages area) |

The editor form is conditional on type — a `page` template shows only Name + Instructions + Folder + publish preference; the entire "Assignment Fields" section is hidden. The Library shows a type indicator per template. This pattern will extend to distinguish Assignments from New Quizzes when added.

`engine: "assignment" | "new_quiz"` is reserved on assignment-type templates so New Quizzes can be added without a migration.

---

## What an Assignment Template Stores

| Field | Notes |
|---|---|
| Name | Used as the starting point — teacher typically edits per use |
| Instructions | Verbatim Canvas HTML, stored as an unresolved template string; rendered sanitized |
| Points | Usually consistent for the same assignment type |
| Submission Type | Online, on paper, external tool, etc. |
| Allowed Submission Formats | File upload, text entry, URL, media, etc. |
| Assignment Group | A name label, resolved by name at deploy (Decision 8) |
| Grading Type | Points, percentage, letter grade, complete/incomplete |
| Peer Review | Enabled or disabled |
| Publish default | Default publish preference; overridable at deploy (Decision 10) |

A **page template** stores only Name, Instructions (verbatim HTML), and the publish default.

---

## Template Data Structure

```javascript
// Single template item
{
  id: "template_abc123",
  type: "assignment",          // "assignment" | "page"
  folderId: "folder_xyz",      // null if unfiled
  name: "Weekly Quiz",         // the template's display name in the library
  createdAt: "2025-09-01T00:00:00Z",
  lastUsed: "2025-10-01T00:00:00Z",  // null if never used
  sourceId: "67890",           // source assignment/page id, null if from scratch
  publishDefault: "auto",      // "auto" | "published" | "unpublished"
  fields: {
    name: "Weekly Quiz",       // assignment/page name when deployed
    instructions: "<p>Complete all questions…</p>",  // verbatim HTML, unresolved
    // assignment-only fields below (absent on page templates):
    points: 20,
    submissionType: "online",
    allowedFormats: ["online_text_entry", "online_upload"],
    assignmentGroup: "Quizzes",  // name label, not an id
    gradingType: "points",
    peerReview: false,
    engine: "assignment"       // reserved: "assignment" | "new_quiz"
    // Reserved: rubricId: null
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

**Primary store:** `chrome.storage.local`
Full template data — including instructions HTML and all fields — is stored in `chrome.storage.local`. This avoids the 8KB per-item size limit in `chrome.storage.sync`, which a template with detailed HTML instructions could easily exceed.

**Sync layer:** `chrome.storage.sync` — template index only
A lightweight index containing only template IDs, names, types, and folder assignments syncs across devices. This allows the library structure to follow the teacher between machines.

**Cross-device behavior:**
When a teacher opens the extension on a new device, their template library structure (folder names and template names) appears immediately via the sync index. The full template content is not available until the teacher imports a settings backup from their other device via the Settings export feature.

**Write strategy:**
1. Write full template to `chrome.storage.local`
2. Update the lightweight index in `chrome.storage.sync`
3. Update UI

**Read strategy:**
1. Read `chrome.storage.local` for full template data
2. Read `chrome.storage.sync` for index to confirm structure is current
3. If index and local differ, prompt teacher to re-sync or import

---

## Architecture Split — Where Each Action Lives

```
PowerTools dashboard                 Canvas (injected buttons — triggers only)
────────────────────                 ─────────────────────────────────────────
• Template Library                   • "Save to Templates"  (assignment / page)
  (browse, organize, CRUD)             → capture in context
• Template Editor                    • "Create from Template" (module page,
• Bulk Deployment Engine               beside the native "+")
  (many courses at once)               → single, in-context deploy
```

Single, precise action → Canvas (module id is free from context).
Many courses at once → PowerTools (module placement optional).
Organize & author → PowerTools (a management job that wants a real page).

---

## Pages and Flows

The Templates Tool consists of five surfaces:

1. **Template Library** — dashboard: browse, organize, manage all templates
2. **Template Editor** — dashboard: create or edit a template
3. **Save to Templates** — injected modal on Canvas assignment/page views
4. **Create from Template** — injected surface on Canvas module pages (single deploy)
5. **Bulk Deployment Engine** — dashboard: deploy one template to many courses at once

---

## 1. Template Library (dashboard)

The default view when a teacher navigates to Assignments → Templates.

Shows all templates organized by folder. Templates can be browsed in a grouped list view (default) or a card view that shows scaled, sanitized HTML thumbnails of each template's instructions.

**Search:** Filters across all templates in all folders simultaneously. When a search is active, the folder structure collapses and results show as a flat list. Search matches against template name only.

**Sort:** Within each folder, templates sort by `lastUsed` descending by default — most recently used at the top, never-used at the bottom. Changeable per session.

**Folder operations:**
- Rename and delete folders
- Deleting a folder prompts: "Delete this folder? Templates inside will be moved to Unfiled." Templates are never deleted when a folder is deleted.

**Template operations:**
- **Use** — opens the Bulk Deployment Engine for this template. Primary action, always visible.
- **Edit** — opens the Template Editor with this template's values pre-filled.
- **Delete** — confirms: "Delete Weekly Quiz? This cannot be undone." Permanent; no template-level versioning.

---

## 2. Template Editor (dashboard)

Creates a new template or edits an existing one. When editing, all fields are pre-filled. The form is conditional on template type — page templates hide the entire Assignment Fields section.

**Fields (assignment type):**
- Template Name (required)
- Folder (optional)
- Assignment Name (required) — becomes the assignment name when deployed
- Instructions — sanitized read-only render with option to edit HTML source
- Points
- Assignment Group (type-ahead combobox — see Decision 8)
- Grading Type
- Submission Type
- Allowed Formats (shown only when Submission Type is Online)
- Peer review toggle
- Publish default (Auto / Published / Unpublished)

**Fields NOT saved:** Due Date, Available From, Available Until (set at deploy time).

### Instructions Field (Decisions 5–7)

- Displays a sanitized, read-only render of the stored HTML (DOMPurify + a styled container). This is not a WYSIWYG editor.
- An "Edit HTML source" control reveals a raw-HTML textarea for light edits.
- For heavy formatting, the teacher edits in the Canvas RCE and re-saves via *Save to Templates*.

### Assignment Group Field (Decisions 8–9)

A type-ahead combobox, not a course-bound dropdown. The teacher types a group name freely; suggestions are offered from group names used in the teacher's other templates and optionally the currently-selected course's groups — always as suggestions, never a constraint. Helper text: "Matched by name at deploy time; created if it doesn't exist." May be left blank.

### Validation

- Template Name is required.
- Assignment Name is required (assignment type).
- Points must be a number ≥ 0 (assignment type).
- At least one Allowed Format must be selected when Submission Type is Online.

---

## 3. Save to Templates — injected (Canvas → capture)

A "Save to Templates" button injected by the content script into the Canvas assignment (and page) view. It is a trigger only — the extension performs the capture.

**What it shows:**
- Pre-filled template name (editable)
- Folder selector
- Explicit list of fields that will and will not be saved (sets clear expectations about why dates are absent)

The template type is inferred from the page the button is on. Instructions are captured as verbatim HTML. `sourceId` is set to the Canvas item's ID for traceability.

---

## 4. Create from Template — injected (Canvas module → single deploy)

A "Create from Template" button injected at the module level on the Canvas Modules page. Because it lives on a module, the module id is free from context — the biggest advantage over dashboard deploy.

**What it shows:**
- Template picker (search/select)
- Optional due date
- Optional publish setting (Auto / Published / Unpublished)

Minimum 2 interactions: pick a template → create. Dates and publish are optional. The assignment is created in the current course and added to the current module. Assignment group resolves by name (Decision 9). Publish follows Decision 10.

---

## 5. Bulk Deployment Engine (dashboard → many courses)

Accessed by clicking Use on a template in the Library. Full page.

**Course selection:**
All courses from `getCourses()` are listed, each showing term/semester metadata to disambiguate identical course names. At least one course is required to proceed.

**Assignment Group Mapping (Decision 9):**
Each selected course shows a group selector, pre-filled with a name match, falling back to the course's top group, with a "Create '<name>'" option. Always visible so the teacher controls which grade bucket each course's assignment lands in.

**Date Handling:**
A shared date set applies to all selected courses. An option to "Set dates individually" allows per-course date overrides for classes that run on different schedules. Blank due date → undated, unpublished draft.

**Publish (Decision 10):**
Auto by default: publish if a due date is set, otherwise create as a draft. Published / Unpublished override Auto.

**After deployment:**
Shows per-course success and failure. **View in Bulk Editor** opens the Bulk Editor pre-filtered to the newly created assignments, making it easy to set or adjust dates immediately after creation.

---

## Relationship Between Templates and Bulk Editor

```
Teacher creates a template     (Template Editor or Save to Templates)
        ↓
Teacher deploys to courses     (Bulk Deployment Engine, or Create from Template)
        ↓
Assignments created (dated or undated per deploy)
        ↓
Teacher opens Bulk Editor → filters to new assignments → sets/adjusts dates in bulk
```

---

## Known Limitation — Course-Scoped Media

Canvas inline images and file links use course-scoped URLs (e.g., `/courses/123/files/456`). Saved verbatim and deployed to a different course, those links point back at the origin course. The extension stores instructions HTML as-is and accepts this; card thumbnails show a placeholder for images that cannot load. **Media rehoming** (rewriting/uploading media into the target course on deploy) is a future concern, not a blocker.

---

## Future Additions — Noted, Not Scoped

**Dynamic variables** — two tiers (auto-resolved and user-prompted); see Product Decisions. Instructions are already stored as an unresolved template string so both tiers remain possible.

**New Quizzes** — `engine: "new_quiz"`; separate `/quiz-lti` API surface. The `engine` field is reserved.

**Rubric attachment** — `rubricId` reserved; separate Canvas rubrics API.

**Template export and sharing** — export templates as a file to share with colleagues; requires an import/export format and conflict handling on import.

**Template versioning** — no version history is kept when a template is edited; the previous version is overwritten. May be added if teacher feedback asks for it.
