# Canvas Power Tools — 05: Feature Roadmap

---

## Roadmap Philosophy

Every feature on this roadmap must pass one test before it belongs here:
Does it reduce friction on a high-frequency, tedious task that teachers
perform regularly in Canvas?

Features are tiered by dependency and complexity, not just priority. Nothing
in V2 should be attempted before V1 is stable. Nothing in V3 should be
attempted before V2 establishes the data and infrastructure it depends on.

---

## Tier Definitions

**V1 — Core**
The features that define the product. Must be excellent before launch.
A teacher should be able to install the extension, connect it, and get
real value within 5 minutes.

**V2 — Expansion**
High value features that build directly on V1 foundations. Expands the
surface area of the tool without requiring architectural changes.

**V3 — Power**
Advanced features for heavy users. Some require backend infrastructure.
Some are complex enough to warrant their own design sessions.

**Future — Noted**
Good ideas that are captured but not yet scoped or scheduled. Nothing
here is forgotten — it is just not ready to plan.

---

## V1 — Core

### Suggested Release Strategy

Ship the Bulk Assignment Editor first as a true V1.0 release. Get it into
the hands of real teachers. Gather feedback. Once it is stable and
teachers are using it, ship Assignment Templates as V1.5.

Trying to build both simultaneously as a beginner adds unnecessary risk.
The Bulk Editor alone is a complete and valuable product.

| Feature | Description | Status |
|---|---|---|
| Onboarding and Auth | Token setup, URL entry, verification flow, re-onboarding | Fully designed |
| Settings Page | Token management, preferences, data management, about | Fully designed |
| Bulk Assignment Editor | Edit due dates, availability, points, status in bulk | Fully designed |
| Assignment Templates | Create, organize, and deploy reusable assignment structures | Fully designed |

### V1 Dependencies

```
Onboarding and Auth
        ↓
Settings Page
        ↓
Bulk Assignment Editor    ←─── Assignment Templates
```

Both the Bulk Editor and Templates depend on Onboarding and Settings being
complete. Templates and the Bulk Editor are parallel — neither depends on the
other, but they are designed to work together as a workflow.

---

## V2 — Expansion

All V2 features reuse the API layer, component library, and storage patterns
established in V1. None require backend infrastructure.

| Feature | Description | Key Dependencies |
|---|---|---|
| Grading Dashboard | Cross-assignment grading progress view, bulk grade entry | getCourses, getAssignments |
| Group Manager | Bulk group creation, auto-assign students by criteria, group set management | Student roster API |
| Cross-Course Assignment Duplication | Copy individual assignments from one course to another without templates | Assignment API layer |
| Assignment Group Manager | Create and manage Canvas assignment groups, adjust grade weights | Assignment Groups API |
| Rubric Manager | Create, store, and attach reusable rubrics. Connects to template system | Rubrics API, Templates |
| Extension Popup — Customizable | Configurable quick links to courses, gradebooks, and tools | V1 complete |
| Opt-In Anonymous Telemetry | Send minimal anonymous error reports to developer dashboard | Lightweight backend |
| Developer Diagnostic Dashboard | Aggregated selector health, failure correlation by Canvas version | Telemetry pipeline |

### V2 Notes

**Grading Dashboard** — reads grade data from Canvas. Does not write grades
unless explicit bulk grade entry is built. Start with read-only view first,
add write capability after validation.

**Group Manager** — auto-assign by criteria is the high-value feature.
Criteria examples: assign to group by last name range, by performance tier,
randomly, or by custom list. Requires student roster access.

**Rubric Manager** — originally noted as a future addition to templates. Moved
to V2 as its own standalone feature. Rubrics created here can be attached to
templates and individual assignments.

**Extension Popup** — baseline design exists (see document 04 — Settings /
Popup section). Customization layer added in V2 once there are enough features
to warrant a configurable launcher.

**Telemetry and Developer Dashboard** — requires a lightweight backend. Can be
a simple Node.js server with a database. Opt-in only. No PII. Anonymous
selector failure and recovery events only. Developer dashboard shows aggregated
health across all reporting users.

---

## V3 — Power

V3 features are more complex, some require backend infrastructure, and all
require the data foundations laid by V2.

| Feature | Description | Key Dependencies |
|---|---|---|
| Conditional Assignment Rules | Auto-assign assignments to students based on grade thresholds | Grading Dashboard, Group Manager |
| At-Risk Student Dashboard | Flag students falling behind across multiple metrics | Grading Dashboard |
| Automated Student Nudges | Message students who have not submitted near deadlines | Messaging API |
| Assignment Calendar View | Visual calendar of all assignments across all courses | getAssignments across courses |
| Bulk Feedback Templates | Reusable comment snippets for common grading feedback | Grading Dashboard |
| Course Blueprint Templates | Save entire course structures for semester rollover | All V1 template infrastructure |
| Module Organization Tools | Bulk reorder, publish, and manage modules and their contents | Modules API |
| People and Roster Tools | Cross-course student view, bulk messaging, attendance context | Student and enrollment API |

### V3 Spotlight — Conditional Assignment Rules

This is the most strategically significant V3 feature. It is the feature that
moves Canvas Power Tools from a time-saving tool into an intelligent teaching
assistant.

**Concept:** Teachers define if-then rules. When a grade is posted in Canvas,
the extension evaluates active rules and automatically assigns additional
assignments to affected students.

**Example rules:**
- If student scores below 70% on Quiz 1 → assign Remedial Quiz 1 to that student
- If student scores above 95% on Homework Set A → assign Advanced Extension
- If student has not submitted Assignment 3 by due date → assign follow-up task

**Why it requires V2 first:**
- Requires grade data infrastructure from the Grading Dashboard
- Requires per-student assignment operations from the Group Manager work
- High stakes — automated actions affecting real students need a mature,
  well-tested codebase underneath them

**Rule Builder UI concept:**

```
Assignment Rules                                   [+ New Rule]

Rule 1 — Remediation Trigger           [Active]  [Edit]  [Delete]

  IF    Quiz 1
        Score is below    70%

  THEN  Assign    Remedial Quiz 1
        To        Affected students only
        Due       3 days after rule fires

  Last fired: Oct 3 — 4 students assigned

Rule 2 — Advanced Extension           [Inactive]  [Edit]  [Delete]

  IF    Homework Set A
        Score is above    95%

  THEN  Assign    Advanced Extension Activity
        To        Affected students only
        Due       5 days after rule fires

  Last fired: Never
```

Rules are always teacher-initiated and teacher-controlled. The extension never
takes automated action without a rule the teacher explicitly created and
activated. Every rule firing is logged.

---

## Future — Noted

These ideas are captured and will not be forgotten. They are not yet scoped
or scheduled.

| Idea | Notes |
|---|---|
| Mastery Pathways | Chain assignments so completing one unlocks the next. Requires Canvas module prerequisites API |
| Adaptive Due Date Extensions | Automatically extend due dates for students below a performance threshold |
| Grade Trend Visualization | Show grade trajectory per student over time as a chart |
| Pacing Guide Generator | Auto-distribute assignments across a semester calendar based on parameters |
| Template Export and Sharing | Export templates as a file, share with colleagues, import from file |
| Multi-Institution Support | Store tokens for multiple Canvas instances. Architecture note reserved in storage schema |
| Per-Course Settings | Some preferences scoped to individual courses rather than globally |
| Token Expiry Reminders | Notify teacher before their token is about to expire |
| LTI Version | Full native Canvas integration via Learning Tools Interoperability standard. True long-term goal. Requires backend, institutional approval, and OAuth 2.0 |
| Admin Dashboard | Institution-level views, multi-teacher usage, department templates |
| Mobile Companion | Stretch goal. Canvas mobile API has significant limitations |
| Department-Wide Templates | Share template libraries across a department or institution |

---

## LTI — The Long-Term Architecture Goal

The browser extension is the right first step. It lets individual teachers
install and use the tool without institutional approval, validates the product
with real users, and builds deep Canvas API knowledge.

The natural evolution is an LTI tool — the official standard for embedding
third-party tools natively inside Canvas. LTI tools appear in the Canvas
left navigation sidebar like native Canvas pages. They work on any browser,
any device, including mobile. They require no extension installation.

The transition path:

```
V1 Extension
Individual teachers, Chrome only, no server
        ↓
Validate product-market fit
Build user base
Learn Canvas API deeply
        ↓
V2/V3 Extension
More features, optional backend for telemetry
        ↓
LTI Version
Institutional sales, native integration, any browser
All feature designs and API knowledge transfer directly
Only the delivery mechanism changes
```

No LTI work should begin until the extension has proven value with real users.

---

## Reusable Components Across the Roadmap

Every feature built contributes to and benefits from a shared component and
API library. This is the compounding return on the depth-first approach.

| Component | Built In | Reused By |
|---|---|---|
| getCourses() | V1 — Bulk Editor | Every feature |
| getAssignments() | V1 — Bulk Editor | Templates, Grading, Rules |
| Course dropdown selector | V1 — Bulk Editor | Every feature page |
| Checkbox multi-select table | V1 — Bulk Editor | Groups, Students, Modules |
| Column filter system | V1 — Bulk Editor | Any table view |
| Date range filter | V1 — Bulk Editor | Any date feature |
| Preview diff modal | V1 — Bulk Editor | Any write operation |
| Change log system | V1 — Bulk Editor | Grading, Groups |
| Bulk action bar | V1 — Bulk Editor | Any bulk operation |
| Template library UI | V1 — Templates | Course blueprints, rubrics |
| Folder browser | V1 — Templates | Rubrics, feedback snippets |
| Multi-course selector | V1 — Templates | Announcements, any cross-course op |
| Deploy flow with preview | V1 — Templates | Any template-style feature |
