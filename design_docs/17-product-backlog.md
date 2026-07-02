# Canvas Power Tools — 16: Product Backlog

---

## What This Document Is

The product backlog is a living record of potential features, enhancements,
and ideas that are being tracked but not yet committed to a specific release.
Items here have been discussed, assessed for feasibility, and deemed worth
preserving — but are not ready to be added to the roadmap.

Items graduate from the backlog to the roadmap when:
- The feature is fully designed
- Its dependencies are in place or on the near-term roadmap
- A version target is appropriate given current priorities

Items are never deleted from the backlog. If something is explicitly ruled
out, it is marked Out of Scope with a reason rather than removed.

---

## Backlog Item Structure

Each item records:
- **What it is** — plain language description
- **Module** — which Module it belongs to
- **Why it is here** — why it was not added to the roadmap yet
- **API feasibility** — what the Canvas API supports
- **Complexity** — Low / Medium / High
- **Suggested promotion** — which roadmap version it would likely enter

---

## Communication Module — Enhancements

---

### COM-001 — Missing Work Summary Message

**What it is:**
A single comprehensive message sent to a student listing all of their
outstanding missing work at once, rather than one nudge per missing
assignment. A student with five missing assignments receives one message
that names all five rather than five separate nudges.

Requires a {missing_assignments} personalization token that renders as a
formatted list of assignment names and due dates specific to each student.

**Module:** Communication — Nudges Tool (extension of existing Tool)

**Why it is here:** Not included in the initial Nudge Tool design. Natural
completion of the nudge concept once the base tool is stable.

**API feasibility:** Fully feasible. Reads submissions across all assignments
per student, compiles the missing list, constructs a personalized message
body per recipient. One API call per student for send.

**Complexity:** Low — extends existing Nudge Tool infrastructure. No new
API patterns required.

**Suggested promotion:** V2 alongside Nudges, or as an immediate follow-up
patch once Nudges ships.

---

### COM-002 — Course Grade Threshold Messenger

**What it is:**
A variant of the Grade Threshold Messenger scoped to overall course grade
rather than a single assignment. Messages all students currently above or
below a specified overall grade threshold — for example, all students
currently failing the course.

**Module:** Communication — Threshold Tool (extension of existing Tool)

**Why it is here:** The initial Threshold design is per-assignment only.
Course-level grade threshold is a distinct and more powerful use case.

**API feasibility:** Fully feasible. Canvas calculates overall course grades
using assignment groups and weights. The grades API returns current overall
scores per student. Threshold comparison runs client-side.

**Complexity:** Medium — requires reading and aggregating grade data across
all assignments per student. Different data shape from the per-assignment
threshold flow.

**Suggested promotion:** V2 as an addition to the Threshold Tool, likely
implemented as a toggle between Assignment and Course Grade modes.

---

### COM-003 — Section Targeting for Communication Tools

**What it is:**
A section filter added to all three Communication Tools — Nudges, Threshold,
and Announcements. Allows a teacher to restrict message recipients to
students in a specific section rather than the whole course.

Particularly useful for teachers running multiple sections on different
schedules who need to send section-specific reminders.

**Module:** Communication — all three Tools

**Why it is here:** The initial designs operate at course level only.
Section targeting is a natural extension once the Sections Tool in the
People Module provides the section API infrastructure.

**API feasibility:** Fully feasible. Sections API is already planned for
the People Module. Communication Tools would consume the same data.

**Complexity:** Low — adding a section filter dropdown to existing recipient
selection UI. The filtering logic is client-side on the already-fetched
student list.

**Suggested promotion:** V2, added alongside or immediately after the
People → Sections Tool ships.

---

### COM-004 — Message Templates for Nudges and Threshold

**What it is:**
Template support for the Nudge Tool and Grade Threshold Messenger, matching
the template system already designed for Announcements. Teachers save
frequently used message bodies and load them from a dropdown rather than
rewriting from scratch each time.

**Module:** Communication — Nudges Tool and Threshold Tool

**Why it is here:** Announcements has templates. Nudges and Threshold do
not. The template infrastructure already exists — this is reuse, not new
design work.

**API feasibility:** No additional API calls required. Template data is
stored locally in chrome.storage.local using the existing template
architecture.

**Complexity:** Low — templates are a local storage feature using
infrastructure already built for Assignment Templates and Announcement
Templates. UI addition only.

**Suggested promotion:** V2, low effort, can be bundled with the initial
Nudges and Threshold release.

---

### COM-005 — Reply Visibility in Sent Log

**What it is:**
A read-only enhancement to the Sent Log showing whether a sent message
received a reply from the student. Not a full inbox — just enough to see
"Jane replied" or "No response yet" next to each sent log entry before
sending a follow-up.

Prevents teachers from sending a second nudge to a student who already
responded to the first one.

**Module:** Communication — Sent Log (shared across all Tools)

**Why it is here:** The Sent Log as designed is write-only record keeping.
Reading conversation replies requires an additional API call pattern not
yet planned.

**API feasibility:** Fully feasible. Canvas Conversations API supports
reading conversation threads including replies. Matching sent messages to
their conversation thread requires storing the conversation ID returned
at send time.

**Complexity:** Medium — requires storing conversation IDs at send time
(schema change to Sent Log entries), polling or fetching conversation
threads on Sent Log open, and a UI indicator per entry.

**Suggested promotion:** V2 as a Sent Log enhancement, lower priority than
the other Communication additions. Could ship as a V2 patch.

---

### COM-006 — Observer and Parent Messaging

**What it is:**
A dedicated Tool for messaging Canvas observer accounts — parents and
guardians linked to student accounts. Separate from student messaging
because the audience, content, and sensitivity level are different.

Would allow a teacher to message all observers of students below a grade
threshold, or all observers of students with missing work, without
messaging the students themselves.

**Module:** Communication — new Tool (Observer Messenger)

**Why it is here:** Significant FERPA considerations require dedicated
design work before this ships. Messaging a parent about a student's
specific grades involves student records. The security model, disclosures,
and PIN requirements need careful separate design.

**API feasibility:** Canvas Conversations API supports messaging observers.
Observer relationships are accessible via the enrollments API with the
observer role filter.

**Complexity:** High — new Tool, new security design, FERPA review needed,
separate UI from student messaging.

**Suggested promotion:** V3. Requires a full design document before
development begins.

---

### COM-007 — Scheduled Pre-Deadline Reminders

**What it is:**
A relative scheduling system for nudge messages — "send this reminder
2 days before each assignment's due date" — rather than a fixed calendar
date. Reminders update automatically when assignment dates shift.

**Module:** Communication — Nudges Tool (automation extension)

**Why it is here:** Requires monitoring assignment due dates and triggering
messages at relative offsets. Significantly more complex than one-time
scheduled sends. Connects to the Recurring Announcements stretch feature
already noted in the roadmap.

**API feasibility:** Technically feasible but requires a persistent
monitoring mechanism. Chrome MV3 service workers are not persistent —
reliable scheduled triggering may require a lightweight backend or
chrome.alarms with careful design around browser-closed scenarios.

**Complexity:** High — monitoring system, relative date calculation,
Chrome alarms integration, edge case handling for browsers that are
closed at trigger time.

**Suggested promotion:** Future / Stretch. Requires further design
discussion before scope can be determined.

---

## Assignments Module — Enhancements

---

### ASN-001 — Bulk Availability Window Offset

**What it is:**
When shifting due dates in bulk, automatically shift the Available From
and Available Until dates by the same offset relative to the new due date
rather than shifting them by a flat number of days. Preserves the window
relationship — if an assignment was available for 3 days before the due
date, it remains available for 3 days before the new due date.

**Module:** Assignments — Bulk Edit Tool

**Why it is here:** The current shift behavior moves all three date fields
by the same flat offset. The relative offset is a more intelligent default
for teachers who set consistent availability windows.

**API feasibility:** Fully feasible. Client-side calculation before the
API write.

**Complexity:** Low — a calculation variant in the existing date shift
logic. UI addition of a toggle between flat shift and relative shift.

**Suggested promotion:** V1.5 or as a V1.0 patch after initial release.

---

### ASN-002 — Assignment Duplication With Date Offset

**What it is:**
When duplicating an assignment to another course, allow the teacher to
specify a date offset applied to all dates on the duplicate. The original
assignment's dates shift forward or backward by the specified amount in
the destination course.

**Module:** Assignments — Duplicate Tool

**Why it is here:** The current Duplicate Tool creates assignments with no
due date, requiring a separate Bulk Edit step to set dates. Offering an
inline offset at duplication time eliminates that step for the common case.

**API feasibility:** Fully feasible. Dates are set in the create
assignment API call.

**Complexity:** Low — date offset field added to the Duplicate Tool UI.

**Suggested promotion:** V2 alongside the Duplicate Tool.

---

### ASN-003 — Assignment Reordering

**What it is:**
Drag-and-drop or arrow-based reordering of assignments within a course,
affecting the position field Canvas uses to determine display order.
Includes bulk reorder — select multiple assignments and move them as a
group to a new position.

**Module:** Assignments — Bulk Edit Tool or a new Reorder Tool

**Why it is here:** Canvas's native drag-and-drop reordering is slow and
unreliable for large assignment lists. Bulk reorder does not exist natively.

**API feasibility:** Canvas assignment position field is settable via the
update assignment endpoint. Bulk position updates require individual PUT
requests per assignment.

**Complexity:** Medium — drag-and-drop UI interaction, position
recalculation, multiple sequential API writes.

**Suggested promotion:** V2 as an addition to the Bulk Edit Tool or as
a standalone Assignments Module Tool.

---

## Grading Module — Enhancements

---

### GRD-001 — Grade Export with Custom Formatting

**What it is:**
Export grade data from a course in customizable formats — beyond the
standard Canvas gradebook export. Allows column selection, student
filtering, and formatting options suited to common SIS import formats.

**Module:** Grading — Overview Tool (export addition)

**Why it is here:** Canvas's built-in grade export is rigid. Teachers who
need to import grades into an SIS often have to reformat the export
manually. This is a convenience enhancement, not a core grading feature.

**API feasibility:** Fully feasible. Reads submission data via the
submissions API and formats it client-side before download.

**Complexity:** Medium — data aggregation, column mapping UI, CSV
generation with configurable formatting.

**Suggested promotion:** V2 as a Grading Overview enhancement, lower
priority than core grading tools.

---

### GRD-002 — Grade Trend Alerts

**What it is:**
Automatic flagging of students whose grade trend is moving in a concerning
direction — not just currently below a threshold but declining over
multiple recent assessments. Surfaces in the Grading Overview as a warning
indicator per student.

Distinct from the V3 At-Risk Dashboard which is a standalone analytical
view. This is a lighter real-time indicator embedded in the existing
Grading Overview.

**Module:** Grading — Overview Tool

**Why it is here:** Requires grade trend calculation across multiple
assignments which is more complex than point-in-time threshold checks.
The At-Risk Dashboard in V3 covers the deeper version of this concept.

**API feasibility:** Fully feasible. Requires reading submission history
per student across multiple assignments and calculating trend direction.

**Complexity:** Medium — trend calculation algorithm, indicator UI,
performance consideration for large classes.

**Suggested promotion:** V3 alongside or as part of the At-Risk Dashboard.

---

## People Module — Enhancements

---

### PPL-001 — Bulk Enrollment Management

**What it is:**
Add, remove, or change enrollment roles for multiple students across
sections in bulk. Useful at the start of semester when rosters shift and
teachers need to move students between sections.

**Module:** People — Sections Tool or Roster Tool

**Why it is here:** Enrollment changes are high-stakes and institution-
dependent. Many schools restrict enrollment changes to administrators.
The feature is feasible via API but may not be appropriate for all
institutions.

**API feasibility:** Canvas enrollments API supports creating and
deactivating enrollments. Permissions depend on institution configuration.

**Complexity:** High — permission variability across institutions,
validation requirements, high-stakes data changes requiring careful
confirmation design.

**Suggested promotion:** V3, with clear documentation that this requires
appropriate Canvas permissions and may not be available at all institutions.

---

### PPL-002 — Student Profile Quick View

**What it is:**
A lightweight student profile panel accessible from any Tool that shows
a student — Nudges, Accommodations, Missing Work — that displays key
information without leaving the current Tool. Grade summary, submission
history, active accommodations, and recent messages sent.

**Module:** People — shared Component used across Modules

**Why it is here:** Cross-Module student context requires aggregating data
from multiple API sources. Useful but not core functionality.

**API feasibility:** Fully feasible. Combines data from the grades,
submissions, overrides, and conversations APIs.

**Complexity:** Medium — data aggregation from multiple endpoints, panel
UI Component that works across Modules.

**Suggested promotion:** V3 as a shared Component.

---

## Settings and Infrastructure — Enhancements

---

### INF-001 — Settings Sync Conflict Resolution UI

**What it is:**
When a teacher uses the extension on two devices and settings diverge —
one device updated a preference, the other did not — a visible conflict
resolution screen rather than silent last-write-wins behavior.

**Module:** Settings

**Why it is here:** Sync conflicts are rare and the current last-write-wins
behavior is acceptable for most settings. A UI for resolution adds
complexity for an edge case.

**API feasibility:** Chrome storage API — no Canvas API involvement.

**Complexity:** Medium — conflict detection, diffing, resolution UI.

**Suggested promotion:** Future. Only worth building if teachers report
confusion from silent sync conflicts.

---

### INF-002 — Extension Usage Analytics (Local Only)

**What it is:**
A local usage dashboard showing the teacher their own activity — how many
bulk edits made, how many messages sent, time saved estimates, most used
Tools. Privacy-safe because it never leaves the device.

**Module:** Settings — new Analytics tab

**Why it is here:** Nice-to-have, not core. Useful for understanding how
the teacher uses the tool but adds storage overhead.

**API feasibility:** No Canvas API involvement. Tracks local operation
counts stored in chrome.storage.local.

**Complexity:** Low — event counters written at each operation, simple
dashboard UI.

**Suggested promotion:** Future, low priority.

---

## Design and UI — Enhancements

---

### UI-001 — Compact / Cozy / Relaxed Spacing Modes

**What it is:**
Three interface density settings affecting padding on table rows, cards,
and elements throughout the extension. Compact maximizes visible content.
Relaxed adds breathing room. Cozy is the default.

Implemented via CSS custom property padding variables on the root element,
following the same pattern as the text size and accent color systems.

**Module:** Settings — General (Appearance)

**Why it is here:** Lower priority than text size since browser zoom and
text size address the most common accessibility needs. Spacing mode is
a comfort preference as much as an accessibility feature.

**API feasibility:** No Canvas API involvement. CSS-only implementation.

**Complexity:** Low — CSS custom properties, settings schema addition,
three padding variable sets.

**Suggested promotion:** Future, after the core UI is stable and the
component library is mature enough that spacing changes do not require
manual fixes per component.

---

### UI-002 — Library Module

**What it is:**
A unified view of all teacher-created content across all Tools — rubrics,
assignment templates, comment bank entries, blueprint templates, and
question banks — with a single export for full backup and cross-device
portability. Import from backup on any device.

**Module:** Library (new top-level Module)

**Why it is here:** Only makes sense once teachers have accumulated
meaningful content across multiple Tools. An empty Library Module is
purposeless. Build after V2 Tools are mature and in active use.

**API feasibility:** No Canvas API involvement. Reads from chrome.storage.local
and chrome.storage.sync.

**Complexity:** Medium — aggregated view across all content types, unified
export format, import with conflict resolution.

**Suggested promotion:** Future. The signal to promote this is when
teachers are managing enough content that browsing individual Tool
libraries becomes inconvenient.

---

## Future and Stretch — Carried From Roadmap

The following items are noted in the roadmap Future section and recorded
here for completeness. They do not yet have enough detail to be full
backlog items.

| ID | Item | Notes |
|---|---|---|
| FUT-001 | Recurring Announcements | Requires local scheduling infrastructure or backend. Not API-native. |
| FUT-002 | End-of-Semester Checklist Wizard | Complements the Rollover Wizard. Guides course close process. |
| FUT-003 | File Management | Bulk rename, move, cross-course sharing for Canvas Files. |
| FUT-004 | Competency Tracking | Mastery-based assessment map for CTE programs. Requires deep Outcomes API work. |
| FUT-005 | Template Export and Sharing | Export templates as portable file. Import from a colleague. |
| FUT-006 | Multi-Institution Support | One extension, multiple Canvas instances. Architecture note reserved. |
| FUT-007 | Admin Dashboard | Institution-level views and multi-teacher management. |
| FUT-008 | LTI Version | True native Canvas integration. All designs transfer — only delivery changes. |
| FUT-009 | Mastery Pathways | Chain assignments so completing one unlocks the next. |
| FUT-010 | Adaptive Due Date Extensions | Auto-extend due dates for students below a performance threshold. |
| FUT-011 | Token Expiry Reminders | Notify teacher before API token expires. |
| FUT-012 | Differentiated Assignments | Assign different work to different groups within the same section. |
| FUT-013 | Graded Surveys | Include Canvas surveys in QTI Import and template workflows. |
| FUT-014 | Department-Wide Templates | Share template libraries across a department or institution. |
| FUT-015 | Extra Credit Handling | Clean interface for marking assignments as extra credit. |
| FUT-016 | Scheduled Pre-Deadline Reminders | See COM-007. |
| FUT-017 | Observer and Parent Messaging | See COM-006. |
| FUT-018 | Spacing Modes | See UI-001. |
| FUT-019 | Library Module | See UI-002. |

---

## Backlog Index

| ID | Item | Module | Complexity | Status |
|---|---|---|---|---|
| COM-001 | Missing Work Summary Message | Communication | Low | Ready for V2 |
| COM-002 | Course Grade Threshold Messenger | Communication | Medium | Ready for V2 |
| COM-003 | Section Targeting for Communication | Communication | Low | Ready for V2 |
| COM-004 | Message Templates for Nudges and Threshold | Communication | Low | Ready for V2 |
| COM-005 | Reply Visibility in Sent Log | Communication | Medium | V2 patch |
| COM-006 | Observer and Parent Messaging | Communication | High | Needs design — V3 |
| COM-007 | Scheduled Pre-Deadline Reminders | Communication | High | Future / Stretch |
| ASN-001 | Bulk Availability Window Offset | Assignments | Low | Ready for V1.5 |
| ASN-002 | Assignment Duplication With Date Offset | Assignments | Low | Ready for V2 |
| ASN-003 | Assignment Reordering | Assignments | Medium | V2 |
| GRD-001 | Grade Export With Custom Formatting | Grading | Medium | V2 |
| GRD-002 | Grade Trend Alerts | Grading | Medium | V3 |
| PPL-001 | Bulk Enrollment Management | People | High | V3 — permission dependent |
| PPL-002 | Student Profile Quick View | People | Medium | V3 |
| INF-001 | Settings Sync Conflict Resolution UI | Settings | Medium | Future |
| INF-002 | Extension Usage Analytics (Local Only) | Settings | Low | Future |
| UI-001 | Compact / Cozy / Relaxed Spacing Modes | UI | Low | Future |
| UI-002 | Library Module | New Module | Medium | Future |
ENDOFFILE
echo "Doc 16 created"