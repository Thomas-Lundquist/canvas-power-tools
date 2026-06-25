# Canvas Power Tools — 05: Feature Roadmap

---

## Roadmap Philosophy

Every feature earns its place by answering yes to one question: does it
reduce friction on a task teachers perform regularly in Canvas?

Features are tiered by dependency and complexity. V2 features require V1
foundations. V3 features require V2 data and infrastructure. Skipping tiers
produces unstable software and poor user experiences.

The extension is organized into Modules containing Tools. The roadmap is
presented in this structure so the relationship between features is clear.

---

## Tier Definitions

| Tier | Meaning |
|---|---|
| V1.0 | Core launch. The product is not shippable without these. |
| V1.5 | Ships once V1.0 is stable and in active use. |
| V2 | One substantial release addressing grading, communication, and people management. |
| V3 | Advanced features requiring V2 foundations. Some require backend infrastructure. |
| Future | Captured ideas not yet scoped or scheduled. |
| Out of Scope | Pain points the Canvas API cannot meaningfully address. Explicitly excluded. |

---

## V1.0 — Core Launch

Three features ship together. The PIN system ships alongside the Bulk Edit
Tool even though high-stakes features arrive in V2. Building security
infrastructure before it is urgently needed prevents a painful retrofit later.

| Module | Tool | Description |
|---|---|---|
| — | Onboarding and Auth | Token setup, Canvas URL entry, verification, re-onboarding flow |
| — | Settings | Full settings system including all preferences, data management, and security |
| — | PIN and Security System | Configurable PIN for write operations, inactivity timeout, audit log |
| Assignments | Bulk Edit | Bulk edit due dates, availability dates, points, and publish status across multiple assignments. Change log with 10-entry history per course and full revert capability |

### V1.0 Build Order

```
Onboarding and Auth  →  Settings + PIN System  →  Bulk Edit Tool
```

Nothing else should be started until Bulk Edit is stable and tested against
the Canvas sandbox.

---

## V1.5 — Assignment Intelligence

Ships after V1.0 has been used by real teachers and any critical issues are
resolved. The template system builds directly on the Assignments Module
infrastructure established in V1.0.

| Module | Tool | Description |
|---|---|---|
| Assignments | Templates | Create reusable assignment structures. Save from scratch or from an existing Canvas assignment. Organize into folders. Deploy to multiple courses simultaneously. Dates are never stored in templates — they are set at deploy time. |

---

## V2 — Expanding the Toolkit

One release. All V2 features reuse the API layer, Component library, and
storage patterns from V1. They are presented by Module for clarity.

### Assignments Module (V2 additions)

| Tool | Description |
|---|---|
| Rubrics | Build and save rubrics in a cleaner interface than Canvas's native builder. Organize into categories. Attach to any assignment across any course. Copy-as-new for rubrics already used in grading, which Canvas locks against editing. |
| Assignment Groups | Create and manage Canvas assignment groups. Adjust grade weights. Live preview showing how weight changes affect the class average. |
| Duplicate | Copy any assignment from one course to another. Arrives unpublished with no due date. |

### Grading Module (V2 — new module)

| Tool | Description |
|---|---|
| Overview | Cross-assignment grading progress view. Shows graded, submitted, and missing counts per assignment. Links directly to SpeedGrader and to Grade Missing as Zero. |
| Missing Work | Operational view of missing submissions across the course — by student or by assignment. One-click nudge and one-click zero from this view. |
| Adjustments | Apply grade curves across an assignment — flat point addition, percentage scaling, score floor, scale-to-100, or square root curve. Full preview before any grades are written. |
| Late Policy | Define late penalties per assignment type. Calculate and apply penalties based on submission timestamps. Full teacher review before applying. |

### Communication Module (V2 — new module)

| Tool | Description |
|---|---|
| Nudges | Message students who have not submitted a specific assignment. Personalization tokens replace per student on send. PIN required. Mandatory preview with 5-second delay before send activates. Sent log kept locally. |
| Threshold | Message students above or below a grade threshold on a specific assignment. Same security model as Nudges. |
| Announcements | Create announcements and send them to multiple courses simultaneously. Supports scheduling (send later), draft saving, and reusable announcement templates. Templates use the same architecture as assignment templates. |

### People Module (V2 — new module)

| Tool | Description |
|---|---|
| Groups | Create and manage student groups. Auto-assign by random distribution, alphabetical split, performance tier, or manual selection. |
| Sections | Set per-section due dates across multiple assignments without editing each assignment individually. Cross-section grade comparison view (read-only). |
| Accommodations | Apply date overrides to specific students across multiple assignments. One student, multiple assignments, in one flow. No disability data stored — dates only. FERPA safe by design. |

### SpeedGrader (V2 — injected, not a Module)

SpeedGrader Tools inject directly into Canvas's SpeedGrader page. They
are configured in Settings but deployed via content script. They cannot
be a Module because they operate inside Canvas's own UI.

| Component | Description |
|---|---|
| Comment Bank | Saved comment library with categories, search, and one-click insert. Supports personalization tokens. Built here, accessible from Communication → Nudges. |
| Progress Panel | Full class roster with grading status indicators. Click any student to navigate directly to their submission. Filters by status. |
| Keyboard Shortcuts | Alt+Enter submits grade and advances to next student. Full shortcut set for navigation and comment insert. |
| Bulk Grade Actions | Grade all missing submissions as zero with class-wide preview. Apply the same comment to multiple selected students. Export grades as CSV. |

### Infrastructure (V2)

| Item | Description |
|---|---|
| Opt-In Telemetry | Anonymous error reporting. OFF by default. Requires a lightweight backend. Payload contains no PII — selector key, Canvas version, extension version, and URL pattern only. |
| Developer Dashboard | Aggregated selector health across reporting users. Correlates failures with Canvas version releases. Private developer view. Requires telemetry backend. |

---

## V3 — Power Features

All V3 features require V2 data foundations. Several require the lightweight
backend introduced for V2 telemetry.

### Assignments Module (V3 additions)

| Tool | Description |
|---|---|
| QTI Import | Convert a structured spreadsheet into valid QTI XML and import it as a Canvas quiz. Supports multiple choice, true/false, short answer, fill-in-the-blank, and matching. Faster than Canvas's quiz builder for question-heavy assessments. |
| Peer Review | Auto-assign peer reviewers. Track review completion status across the class. Send reminders to students who have not completed reviews. |

### Grading Module (V3 additions)

| Tool | Description |
|---|---|
| At-Risk | Identify students falling behind across multiple metrics over time. Distinct from Missing Work which is operational. At-Risk identifies patterns — a student consistently submitting late, grades trending downward across three assignments. |

### People Module (V3 additions)

| Tool | Description |
|---|---|
| Roster | Cross-course student view. Bulk messaging by section or group. |

### Content Module (V3 — new module)

| Tool | Description |
|---|---|
| Modules | Bulk reorder, publish, and manage Canvas module items. Set prerequisites and completion requirements in bulk. |
| Pages | Bulk publish and unpublish Canvas pages. Cross-course page duplication. View all pages in an organized list. |
| Discussions | Bulk operations on graded and ungraded discussions. Cross-course duplication. |

### Setup Module (V3 — new module)

| Tool | Description |
|---|---|
| Rollover | Guided semester copy wizard. Selects what to copy, shifts all dates by semester offset, and presents a post-copy checklist of items requiring manual review. |
| Course Settings | Save preferred course configuration as a template. Apply to new courses in one step. |
| Blueprints | Save a full course structure — assignments, modules, rubrics, pages — as a reusable blueprint for new course creation. |
| Standards | Bulk-tag assignments to Canvas Outcomes or external standards frameworks. Coverage map showing which standards have been addressed. Particularly relevant for CTE programs. |

### SpeedGrader (V3 addition)

| Component | Description |
|---|---|
| Grade With Context | Collapsible panel visible while grading showing the student's overall course grade, submission history pattern, and grade trend. Helps teachers make more informed grading and feedback decisions. |

---

## Future — Noted

These ideas are captured and will not be forgotten. None are scoped or
scheduled.

| Idea | Notes |
|---|---|
| Library Module | Unified view of all teacher-created content — rubrics, templates, comment bank, blueprints, question banks. Single export for full backup. Import on any device. Build after V2 Tools are mature and teachers have accumulated content worth organizing. |
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
| Extra Credit Handling | Clean interface for marking assignments as extra credit and visualizing the effect on student grades. Deferred — lower priority than core grading tools. |
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
| getCourses() | V1.0 Bulk Edit | Every Tool |
| getAssignments() | V1.0 Bulk Edit | Templates, Rubrics, Grading, Rules |
| getStudents() | V2 Groups | Sections, Accommodations, Communication, Roster |
| getSubmissions() | V2 Grading Overview | Missing Work, Late Policy, Adjustments, At-Risk |
| Course selector | V1.0 Bulk Edit | Every Tool in shell header |
| Multi-select table | V1.0 Bulk Edit | Groups, Students, Modules |
| Column filter system | V1.0 Bulk Edit | Any table-based Tool |
| Preview diff modal | V1.0 Bulk Edit | Every write operation |
| Change log | V1.0 Bulk Edit | Grading, Groups, Accommodations |
| PIN gate hook | V1.0 Settings | All write operations across all Modules |
| Audit log | V1.0 Settings | All Modules |
| Skeleton loader | V1.0 Bulk Edit | Every data-loading table |
| Toast system | V1.0 (UI Standards) | Every Tool |
| Template library UI | V1.5 Templates | Rubrics, Blueprints, Announcement Templates |
| Folder browser | V1.5 Templates | Rubrics, Comment Bank, Announcement Templates |
| Multi-course selector | V1.5 Templates | Announcements, Duplicate, Blueprints |
| Comment Bank | V2 SpeedGrader | Communication → Nudges, Threshold |
| Student roster list | V2 SpeedGrader | Accommodations, Communication |
| Sent log | V2 Communication | All outbound message operations |
