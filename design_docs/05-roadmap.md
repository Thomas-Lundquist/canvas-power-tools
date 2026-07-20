# Canvas Power Tools — 05: Feature Roadmap

---

## Roadmap Philosophy

Every feature earns its place by answering yes to one question: does it
reduce friction on a task teachers perform regularly in Canvas?

Canvas Power Tools ships as **one product — V1 — to the Chrome Web Store.**
There are no version tiers. The roadmap is organized by **Module → Tool**,
with a build-status marker on each Tool. Build *order* is driven by
dependency and complexity — a Tool that needs student data comes after the
Tool that first fetches it — not by arbitrary release phases.

The extension is organized into Modules containing Tools. The roadmap is
presented in this structure so the relationship between features is clear.

> **Module TBD:** Blueprints and Standards are planned tools whose module placement is not yet decided — they are not Setup tools. See the dedicated section below the Setup Module.

**Status legend**

| Status | Meaning |
|---|---|
| Built | Implemented and in the codebase. |
| Planned | Designed and scoped; not yet built. |
| Idea | Captured, not yet scoped or scheduled. |
| Out of scope | The Canvas API cannot meaningfully address this. Explicitly excluded. |

---

## Architecture — Modules, Tools, Archetypes

> Full plan: **doc 19 — Module Consolidation & Shell Architecture.**

Modules are no longer flat lists of separate pages. A **Module is one page**; its
**Tools are routed views** switched by a persistent rail (Module = workspace,
Tool = task). Each Tool's screen is one of the **seven archetypes defined in
doc 10** — Table-Primary · Browse/Library · Resource-Manager · Dashboard ·
Config/Form-Flow · Compose/Messaging · Log/Audit Trail — reusable templates
built from the doc-10 atoms + tokens and classified **per screen**. See doc 10 §"Interaction Grammar &
Archetypes" for the shapes and doc 19 for the tool→archetype mapping.

**Consolidation direction** (detail + status in doc 19): some Tools below merge
onto one axis (**Message Students** = Nudges + Threshold; **Content** =
Modules + Pages + Discussions), some share an engine but keep separate doors
(Sections + Accommodations → one Override Engine), and a few become context
actions rather than tools (Copy → a row action; Comment Bank → inside the
Composer). Tool rows below are annotated `[archetype]` where decided.

---

## Core (Setup & Security)

| Tool | Status | Description |
|---|---|---|
| Onboarding and Auth | Built | Token setup, Canvas URL entry, verification, re-onboarding flow. |
| Settings | Built | Full settings system including all preferences, data management, and security. |
| PIN and Security System | Built | Configurable PIN for write operations, inactivity timeout, audit log. |

---

## Assignments Module

| Tool | Status | Description |
|---|---|---|
| Bulk Edit | Built | Bulk edit due dates, availability dates, points, and publish status across multiple assignments. Change log with 10-entry history per course and full revert capability. |
| Templates | Built | Create reusable assignment structures. Save from scratch or from an existing Canvas assignment. Organize into folders. Deploy to multiple courses simultaneously. Dates are never stored in templates — they are set at deploy time. |
| Rubrics | Built | Build and save rubrics in a cleaner interface than Canvas's native builder. Organize into categories. Attach to any assignment across any course. Copy-as-new for rubrics already used in grading, which Canvas locks against editing. |
| Assignment Groups | Built | Create and manage Canvas assignment groups. Adjust grade weights. Live preview showing how weight changes affect the class average. |
| Copy / Duplicate | Built | Copy any assignment from one course to another. Arrives unpublished with no due date. |
| QTI Import | Planned | Convert a structured spreadsheet into valid QTI XML and import it as a Canvas quiz. Supports multiple choice, true/false, short answer, fill-in-the-blank, and matching. Faster than Canvas's quiz builder for question-heavy assessments. |
| Peer Review | Planned | Auto-assign peer reviewers. Track review completion status across the class. Send reminders to students who have not completed reviews. |

---

## Grading Module

| Tool | Status | Description |
|---|---|---|
| Overview / Dashboard | Built | Cross-assignment grading progress view. Shows graded, submitted, and missing counts per assignment. Links directly to SpeedGrader and to Grade Missing as Zero. |
| Missing Work | Built | Operational view of missing submissions across the course — by student or by assignment. One-click nudge and one-click zero from this view. |
| Adjustments | Built | Apply grade curves across an assignment — flat point addition, percentage scaling, score floor, scale-to-100, or square root curve. Full preview before any grades are written. |
| Late Policy | Built | Define late penalties per assignment type. Calculate and apply penalties based on submission timestamps. Full teacher review before applying. |
| At-Risk | Planned | Identify students falling behind across multiple metrics over time. Distinct from Missing Work, which is operational. At-Risk identifies patterns — a student consistently submitting late, grades trending downward across three assignments. |

---

## Communication Module

| Tool | Status | Description |
|---|---|---|
| Nudges | Built | Message students who have not submitted a specific assignment. Personalization tokens replace per student on send. PIN required. Mandatory preview with 5-second delay before send activates. Sent log kept locally. |
| Threshold | Built | Message students above or below a grade threshold on a specific assignment. Same security model as Nudges. |
| Announcements | Built | Create announcements and send them to multiple courses simultaneously. Supports scheduling (send later), draft saving, and reusable announcement templates. Templates use the same architecture as assignment templates. |

---

## People Module

| Tool | Status | Description |
|---|---|---|
| Groups | Built | Create and manage student groups. Auto-assign by random distribution, alphabetical split, performance tier, or manual selection. |
| Sections | Built | Set per-section due dates across multiple assignments without editing each assignment individually. Cross-section grade comparison view (read-only). |
| Accommodations | Built | Apply date overrides to specific students across multiple assignments. One student, multiple assignments, in one flow. No disability data stored — dates only. FERPA safe by design. |
| Roster | Planned | Cross-course student view. Bulk messaging by section or group. |

---

## SpeedGrader (injected into Canvas, not a Module)

SpeedGrader Tools inject directly into Canvas's SpeedGrader page. They
are configured in Settings but deployed via content script. They cannot
be a Module because they operate inside Canvas's own UI.

| Tool | Status | Description |
|---|---|---|
| Comment Bank | Planned | Saved comment library with categories, search, and one-click insert. Supports personalization tokens. Accessible from Communication → Nudges. |
| Progress Panel | Planned | Full class roster with grading status indicators. Click any student to navigate directly to their submission. Filters by status. |
| Keyboard Shortcuts | Planned | Alt+Enter submits grade and advances to next student. Full shortcut set for navigation and comment insert. |
| Bulk Grade Actions | Planned | Grade all missing submissions as zero with class-wide preview. Apply the same comment to multiple selected students. Export grades as CSV. |
| Grade With Context | Planned | Collapsible panel visible while grading showing the student's overall course grade, submission history pattern, and grade trend. Helps teachers make more informed grading and feedback decisions. |

---

## Content Module

| Tool | Status | Description |
|---|---|---|
| Modules | Planned | Bulk reorder, publish, and manage Canvas module items. Set prerequisites and completion requirements in bulk. |
| Pages | Planned | Bulk publish and unpublish Canvas pages. Cross-course page duplication. View all pages in an organized list. |
| Discussions | Planned | Bulk operations on graded and ungraded discussions. Cross-course duplication. |

---

## Setup Module

| Tool | Status | Description |
|---|---|---|
| Rollover | Planned | Guided semester copy wizard. Selects what to copy, shifts all dates by semester offset, and presents a post-copy checklist of items requiring manual review. |
| Course Settings | Planned | Save preferred course configuration as a template. Apply to new courses in one step. |

---

## Module TBD

These tools are planned but their module placement is not yet decided. Do not assign them to a module until the job-to-be-done for each has been locked and the module home confirmed.

| Tool | Status | Description |
|---|---|---|
| Blueprints | Planned | Save a full course structure — assignments, modules, rubrics, pages — as a reusable blueprint for new course creation. |
| Standards | Planned | Bulk-tag assignments to Canvas Outcomes or external standards frameworks. Coverage map showing which standards have been addressed. Particularly relevant for CTE programs. |

---

## Infrastructure

| Item | Status | Description |
|---|---|---|
| Opt-In Telemetry | Planned | Anonymous error reporting. OFF by default. Requires a lightweight backend. Payload contains no PII — selector key, Canvas version, extension version, and URL pattern only. |
| Developer Dashboard | Planned | Aggregated selector health across reporting users. Correlates failures with Canvas version releases. Private developer view. Requires telemetry backend. |

---

## Ideas — Noted (not yet scoped)

These ideas are captured and will not be forgotten. None are scoped or
scheduled.

| Idea | Notes |
|---|---|
| Library Module | Unified view of all teacher-created content — rubrics, templates, comment bank, blueprints, question banks. Single export for full backup. Import on any device. Build once the core Tools are mature and teachers have accumulated content worth organizing. |
| End-of-Semester Checklist | Guided wizard for course close — final grade check, missing submission review, grade passback confirmation. Complements the Rollover Wizard. |
| File Management | Bulk rename, move, and cross-course sharing for Canvas Files. |
| Competency Tracking | Mastery-based assessment map for CTE programs. Requires deep Outcomes API work. |
| Template Export and Sharing | Export templates as a portable file. Import from a colleague. |
| Multi-Institution Support | One extension, multiple Canvas instances. Architecture note reserved in storage schema. |
| Admin Dashboard | Institution-level views and multi-teacher management. |
| LTI Version | True native Canvas integration via Learning Tools Interoperability. All feature designs and API knowledge transfer — only the delivery mechanism changes. Long-term goal. |
| Mastery Pathways | Chain assignments so completing one unlocks the next. |
| Adaptive Due Date Extensions | Automatically extend due dates for students below a performance threshold. |
| Token Expiry Reminders | Notify the teacher before their API token expires. |
| Compact / Cozy / Relaxed Spacing Modes | Interface density setting. Compact maximizes visible rows. Relaxed adds breathing room. Cozy is the default. Implemented via CSS custom property padding variables. Lower priority than text size since browser zoom and text size address the most common accessibility needs. |
| Extra Credit Handling | Clean interface for marking assignments as extra credit and visualizing the effect on student grades. Lower priority than core grading tools. |
| Recurring Announcements | Send the same announcement on a repeating schedule. Canvas's API supports one-time scheduled posts only; a reliable recurring system would require local scheduling infrastructure that is fragile if the browser is closed. Requires further design work. |
| Differentiated Assignments | Assign different work to different groups within the same section. Uses Canvas's assign-to field per group. |
| Graded Surveys | Include Canvas surveys in QTI Import and template workflows. |
| Department-Wide Templates | Share template libraries across a department or institution. |

---

## Out of Scope

These pain points are explicitly excluded because the Canvas API does not
provide meaningful access to them, or because dedicated software handles
them better.

| Item | Reason |
|---|---|
| Attendance Tracking | Lives in SIS software — Skyward, Focus, PowerSchool. Not a Canvas problem. |
| SpeedGrader Annotation | Canvas's document viewer is proprietary. The annotation layer is not API-accessible. |
| Notification Management | Canvas notification preferences are not meaningfully exposed via the API. |

---

## Reusable Component Map

Every Component built for one Tool is available to all subsequent Tools.
This table shows the compounding value of the depth-first approach.

| Component | Built In | Reused By |
|---|---|---|
| getCourses() | Bulk Edit | Every Tool |
| getAssignments() | Bulk Edit | Templates, Rubrics, Grading, Rules |
| getStudents() | Groups | Sections, Accommodations, Communication, Roster |
| getSubmissions() | Grading Overview | Missing Work, Late Policy, Adjustments, At-Risk |
| Course selector | Bulk Edit | Every Tool in shell header |
| Multi-select table | Bulk Edit | Groups, Students, Modules |
| Column filter system | Bulk Edit | Any table-based Tool |
| Preview diff modal | Bulk Edit | Every write operation |
| Change log | Bulk Edit | Grading, Groups, Accommodations |
| PIN gate hook | Settings | All write operations across all Modules |
| Audit log | Settings | All Modules |
| Skeleton loader | Bulk Edit | Every data-loading table |
| Toast system | UI Standards | Every Tool |
| Template library UI | Templates | Rubrics, Blueprints, Announcement Templates |
| Folder browser | Templates | Rubrics, Comment Bank, Announcement Templates |
| Multi-course selector | Templates | Announcements, Duplicate, Blueprints |
| Comment Bank | SpeedGrader | Communication → Nudges, Threshold |
| Student roster list | SpeedGrader | Accommodations, Communication |
| Sent log | Communication | All outbound message operations |
