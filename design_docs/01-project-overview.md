# Canvas Power Tools — 01: Project Overview

---

## What It Is

Canvas Power Tools is a Chrome browser extension that gives teachers a faster,
smarter interface for common Canvas LMS workflows. Rather than replacing Canvas,
it augments it — adding functionality that Instructure has been slow to ship.

The product is organized as a single-page application that opens in a new
browser tab. Teachers navigate between modules using a persistent collapsible
sidebar. Every feature lives within this unified shell rather than opening as
isolated tabs.

---

## Core Value Proposition

Canvas's native UI requires too many clicks for too many common tasks. Canvas
Power Tools reduces that friction systematically, starting with the highest-
frequency pain points — assignment management and bulk editing — and expanding
outward into grading, communication, people management, and course design.

---

## Design Principles

These principles govern every feature, every screen, and every line of code.
When a decision is unclear, these are the tiebreakers.

**Privacy first.**
No data leaves the teacher's device except to their own Canvas instance.
No analytics, no external logging, no third-party data access. This is both
an ethical commitment and a practical FERPA compliance strategy.

**FERPA alignment.**
Student PII — names, grades, emails — is fetched on demand from Canvas and
never persisted by the extension. The extension stores no student data.

**Preview before write.**
No bulk operation executes without a confirmation step showing the teacher
exactly what will change. Old values and new values are shown side by side.
This is non-negotiable regardless of how simple an operation seems.

**Revert everything.**
Every write operation is recoverable. A change log tracks the last 10
operations per course. Any entry can be reverted. Reverts are themselves
logged and are therefore also revertable.

**Security by default.**
An optional PIN system gates all write operations. Every write is logged in
an audit trail regardless of PIN status. High-stakes operations carry
additional confirmation requirements.

**Reusable architecture.**
API functions, UI components, and data patterns are built once and reused
across every feature. No logic is duplicated. When Canvas changes an endpoint,
one file is updated and every feature benefits.

**Minimal permissions.**
The Chrome manifest requests only the permissions each feature strictly
requires. Permissions are never requested speculatively for future features.

**Professional presentation.**
Icons from a consistent library — Lucide or Heroicons. No emojis anywhere
in the UI, documentation, or codebase. The extension should feel like
software a school would be comfortable recommending officially.

**Depth before breadth.**
One feature done excellently ships before the next feature begins. A shallow
tool that does many things poorly serves no one.

---

## Application Structure

Canvas Power Tools is organized into Modules, Tools, and Components.

**Module** — a top-level navigation section grouping related Tools.
**Tool** — an individual feature within a Module.
**Component** — a reusable UI or logic element shared across Tools.

```
Canvas Power Tools
│
├── Assignments  (Module)
│   ├── Bulk Edit          (Tool)
│   ├── Templates          (Tool)
│   ├── Rubrics            (Tool)
│   ├── Assignment Groups  (Tool)
│   ├── Duplicate          (Tool)
│   ├── QTI Import         (Tool)  ← V3
│   └── Peer Review        (Tool)  ← V3
│
├── Grading  (Module)
│   ├── Overview           (Tool)
│   ├── Missing Work       (Tool)
│   ├── Adjustments        (Tool)
│   ├── Late Policy        (Tool)
│   └── At-Risk            (Tool)  ← V3
│
├── Communication  (Module)
│   ├── Nudges             (Tool)
│   ├── Threshold          (Tool)
│   └── Announcements      (Tool)
│
├── People  (Module)
│   ├── Groups             (Tool)
│   ├── Sections           (Tool)
│   ├── Accommodations     (Tool)
│   └── Roster             (Tool)  ← V3
│
├── Content  (Module)  ← V3
│   ├── Modules            (Tool)
│   ├── Pages              (Tool)
│   └── Discussions        (Tool)
│
└── Setup  (Module)  ← V3
    ├── Rollover           (Tool)
    ├── Course Settings    (Tool)
    ├── Blueprints         (Tool)
    └── Standards          (Tool)

SpeedGrader  (Injected — not a Module)
  Configured via Settings. Injects Tools directly into Canvas's
  SpeedGrader page. Cannot be a Module because it operates inside
  Canvas's own UI rather than within the extension shell.

Library  (Module)  ← Future
  A unified view of all teacher-created content across all Tools —
  rubrics, templates, comment bank entries, blueprints, and question
  banks — with a single export for backup and cross-device portability.
```

---

## Navigation Shell

The extension opens as a single-page application in one browser tab. A
persistent sidebar provides navigation. The header provides global controls.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Icon] Canvas Power Tools     [Course: Biology 101 ▼]    [⚙]   [?]  │
├──────────────┬───────────────────────────────────────────────────────┤
│ [← Hide]     │                                                       │
│              │                                                       │
│ Assignments  │                                                       │
│  Bulk Edit   │   Active Tool renders here                            │
│  Templates   │                                                       │
│  Rubrics     │                                                       │
│  ...         │                                                       │
│              │                                                       │
│ Grading      │                                                       │
│ Communication│                                                       │
│ People       │                                                       │
│ Content  V3  │                                                       │
│ Setup    V3  │                                                       │
│              │                                                       │
│ SpeedGrader  │                                                       │
│ Settings     │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

**Header** — persistent across all Tools. Contains the app logo and name,
the active course selector, a settings icon, and a help icon. The course
selector applies globally to whichever Tool is active.

**Sidebar** — collapsible. Modules expand and collapse to show their Tools.
The hide button collapses the sidebar to a thin strip, giving the active
Tool full screen width. Sidebar state is remembered across sessions.

**Main content area** — the active Tool renders here. Navigation between
Tools is instant since the application shell is already loaded.

**V3 modules** — visible in the sidebar but visually distinguished (grayed
or labeled) until their release. This familiarizes teachers with the roadmap
without implying current availability.

---

## Delivery Architecture

**Extension type:** Chrome Manifest V3

**Content scripts** are injected into specific Canvas pages. Their sole
responsibility is injecting trigger buttons into the Canvas UI. They make
no API calls and contain no feature logic.

**The extension shell** (the single-page application) does all real work —
rendering Tools, calling the Canvas API, managing storage, and handling
user interactions.

**SpeedGrader Tools** are an exception. They inject panels and controls
directly into Canvas's SpeedGrader page because SpeedGrader's workflow
requires operating inside Canvas's own UI. They are configured in Settings
but deployed via content script injection.

**No backend is required for V1 or V2.** All Canvas API calls are made
directly from the extension to Canvas using the teacher's API token. A
lightweight backend is introduced in V2 only for optional anonymous
telemetry.

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| Extension standard | Chrome Manifest V3 | Required for Chrome Web Store |
| Language | JavaScript ES6+ | Accessible for a beginner; migrate to TypeScript later |
| UI framework | React | Necessary for the complexity of a single-page app with module navigation |
| Routing | React Router | Handles module and tool navigation within the single-page shell |
| Styling | Tailwind CSS | Utility-first; no conflicts with Canvas styles since the extension runs in its own tab |
| Build tool | Vite + CRXJS | Fast builds; native MV3 support; hot reload during development |
| Package manager | npm | Standard; widely documented |
| Primary storage | chrome.storage.local | Fast; 5MB limit; no per-item size restriction |
| Sync storage | chrome.storage.sync | Settings and lightweight indexes only; 100KB total limit; 8KB per-item limit |
| Encryption | Web Crypto API (crypto.subtle) | Browser-native; no dependencies; used for token and PIN hash storage |
| HTTP client | Fetch API | Browser-native; MV3 compatible; no dependencies |
| Icons | Lucide or Heroicons | Consistent; accessible; tree-shakeable |
| Version control | Git + GitHub | Public repository |

**Note on React Router:** Adding React Router is the primary architectural
change introduced by the single-page app navigation model. It handles
routing between modules and tools (e.g. /assignments/bulk-edit,
/grading/overview) within the extension shell without requiring page reloads.

---

## Storage Architecture

Chrome provides two storage areas with different characteristics and purposes.

**chrome.storage.local** is the primary data store. It holds all application
data — templates, change logs, rubrics, comment banks, the DOM recovery log,
and the API response cache. It is fast, has a 5MB limit, and imposes no
per-item size restriction. Data stored here does not sync across devices.

**chrome.storage.sync** holds only settings and lightweight content indexes.
Its 100KB total limit and 8KB per-item limit make it unsuitable for full
content storage. It is used for settings (which are small and benefit from
cross-device sync) and for indexes — lightweight lists of content IDs and
names that allow the Library module and sidebar to reflect the teacher's
content structure on any device. Full content always lives in local storage.

When a teacher switches devices, their settings and content structure sync
automatically. Full content — rubrics, templates, comment banks — requires
a manual export and import via the Library module's backup feature.

---

## Complete Storage Schema

```javascript
// chrome.storage.local — primary data store

{
  account: {
    canvasUrl: "https://yourschool.instructure.com",
    apiToken: "encrypted_string",        // AES-encrypted via crypto.subtle
    lastVerified: "ISO_timestamp",
    verificationStatus: "valid" | "failed" | "unchecked"
  },

  security: {
    pinHash: "sha256_hash",              // SHA-256; plain text never stored
    pinEnabled: false,
    pinMode: "inactivity" | "every_write",
    inactivityTimeoutMinutes: 30,
    failedAttemptCount: 0,
    lockoutUntil: null
  },

  templates: {
    folders: [{ id, name, createdAt }],
    items: [{
      id, folderId, name, createdAt, lastUsed,
      sourceAssignmentId,
      fields: {
        name, description, points, submissionType,
        allowedFormats, assignmentGroup, gradingType,
        peerReview
        // Future: rubricId
      }
    }]
  },

  rubrics: {
    categories: [{ id, name }],
    items: [{
      id, categoryId, name, createdAt, lastUsed,
      pointsPossible,
      criteria: [{
        id, description, longDescription,
        points,
        ratings: [{ id, description, points }]
      }]
    }]
  },

  commentBank: {
    categories: [{ id, name }],
    items: [{
      id, categoryId, text, createdAt, lastUsed
    }]
  },

  announcementTemplates: {
    items: [{
      id, name, subject, body, createdAt, lastUsed
    }]
  },

  changeLogs: {
    "courseId": [ /* up to 10 entries per course */ ]
  },

  auditLog: [ /* up to 50 entries, always active */ ],

  sentLog: [ /* up to 50 communication entries */ ],

  domLog: [ /* up to 100 DOM health entries */ ],

  sessionState: {
    lastUsedCourseId: "12345",
    lastUsedModule: "assignments",
    lastUsedTool: "bulk-edit",
    sidebarCollapsed: false
  },

  meta: {
    version: "1.0.0",
    schemaVersion: 1,
    setupComplete: true,
    firstInstallTimestamp: "ISO_timestamp"
  }
}

// chrome.storage.sync — lightweight sync only

{
  settings: { /* all user preferences — see Document 08 */ },

  indexes: {
    templates: [{ id, name, folderId }],
    rubrics: [{ id, name, categoryId }],
    commentBank: [{ id, categoryId, text_preview }],
    announcementTemplates: [{ id, name }]
  }
}
```

---

## Project File Structure

```
canvas-power-tools/
│
├── manifest.json
│
├── src/
│   ├── shell/                     Application shell
│   │   ├── App.jsx                Root component with React Router
│   │   ├── Sidebar.jsx            Module and tool navigation
│   │   ├── Header.jsx             Logo, course selector, icons
│   │   └── routes.js              All route definitions
│   │
│   ├── content_scripts/           Injected into Canvas pages
│   │   ├── main.js                Page detection and router
│   │   └── ui-injector.js         Trigger button injection
│   │
│   ├── api/                       Canvas API layer
│   │   ├── auth.js
│   │   ├── assignments.js
│   │   ├── courses.js
│   │   ├── grading.js
│   │   ├── people.js
│   │   ├── communication.js
│   │   └── request.js             Base fetch wrapper
│   │
│   ├── storage/                   Storage management
│   │   ├── encryption.js
│   │   ├── migrations.js
│   │   └── defaults.js
│   │
│   ├── security/                  PIN and audit system
│   │   ├── pin.js
│   │   ├── audit-log.js
│   │   └── usePinGate.js
│   │
│   ├── dom/                       DOM resilience (see Doc 06)
│   │   ├── selectors.js
│   │   ├── selector-engine.js
│   │   ├── health-check.js
│   │   └── recovery-log.js
│   │
│   ├── components/                Reusable UI Components
│   │   ├── Modal.jsx
│   │   ├── Toast.jsx
│   │   ├── PreviewDiff.jsx
│   │   ├── FilterBar.jsx
│   │   ├── MultiSelect.jsx
│   │   ├── DatePicker.jsx
│   │   ├── SkeletonRow.jsx
│   │   ├── EmptyState.jsx
│   │   └── PinPrompt.jsx
│   │
│   ├── modules/                   One folder per Module
│   │   ├── assignments/
│   │   │   ├── BulkEdit.jsx
│   │   │   ├── Templates.jsx
│   │   │   ├── Rubrics.jsx
│   │   │   ├── AssignmentGroups.jsx
│   │   │   ├── Duplicate.jsx
│   │   │   ├── QTIImport.jsx      (V3)
│   │   │   └── PeerReview.jsx     (V3)
│   │   ├── grading/
│   │   │   ├── Overview.jsx
│   │   │   ├── MissingWork.jsx
│   │   │   ├── Adjustments.jsx
│   │   │   ├── LatePolicy.jsx
│   │   │   └── AtRisk.jsx         (V3)
│   │   ├── communication/
│   │   │   ├── Nudges.jsx
│   │   │   ├── Threshold.jsx
│   │   │   └── Announcements.jsx
│   │   ├── people/
│   │   │   ├── Groups.jsx
│   │   │   ├── Sections.jsx
│   │   │   ├── Accommodations.jsx
│   │   │   └── Roster.jsx         (V3)
│   │   ├── content/               (V3)
│   │   │   ├── Modules.jsx
│   │   │   ├── Pages.jsx
│   │   │   └── Discussions.jsx
│   │   └── setup/                 (V3)
│   │       ├── Rollover.jsx
│   │       ├── CourseSettings.jsx
│   │       ├── Blueprints.jsx
│   │       └── Standards.jsx
│   │
│   ├── speedgrader/               SpeedGrader injection Tools
│   │   ├── injector.js
│   │   ├── CommentBank.jsx
│   │   ├── ProgressPanel.jsx
│   │   ├── BulkGradeActions.jsx
│   │   └── shortcuts.js
│   │
│   ├── settings/
│   │   └── Settings.jsx
│   │
│   └── popup/
│       ├── popup.html
│       └── Popup.jsx
│
├── public/
│   └── icons/
│
├── docs/
│
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── PRIVACY.md
└── CHANGELOG.md
```

---

## Canvas API Coverage

### V1.0
| Action | Endpoint |
|---|---|
| Verify token | GET /api/v1/users/self |
| List courses | GET /api/v1/courses |
| List assignments | GET /api/v1/courses/:id/assignments |
| Update assignment | PUT /api/v1/courses/:id/assignments/:id |
| Bulk update dates | PUT /api/v1/courses/:id/assignments/bulk_update |
| List assignment groups | GET /api/v1/courses/:id/assignment_groups |
| List modules | GET /api/v1/courses/:id/modules |

### V1.5
| Action | Endpoint |
|---|---|
| Create assignment | POST /api/v1/courses/:id/assignments |
| Duplicate assignment | POST /api/v1/courses/:id/assignments/:id/duplicate |

### V2 (additional)
| Action | Endpoint |
|---|---|
| List students | GET /api/v1/courses/:id/students |
| List sections | GET /api/v1/courses/:id/sections |
| List submissions | GET /api/v1/courses/:id/submissions |
| Update submission | PUT /api/v1/courses/:id/assignments/:id/submissions/:id |
| List groups | GET /api/v1/courses/:id/groups |
| Create group | POST /api/v1/courses/:id/groups |
| Create assignment override | POST /api/v1/courses/:id/assignments/:id/overrides |
| List rubrics | GET /api/v1/courses/:id/rubrics |
| Create rubric | POST /api/v1/courses/:id/rubrics |
| Send conversation | POST /api/v1/conversations |
| Create announcement | POST /api/v1/courses/:id/discussion_topics |

### V3 (additional)
| Action | Endpoint |
|---|---|
| List outcomes | GET /api/v1/courses/:id/outcome_group_links |
| Create outcome alignment | POST /api/v1/courses/:id/outcome_alignments |
| Import QTI content | POST /api/v1/courses/:id/content_migrations |
| List discussions | GET /api/v1/courses/:id/discussion_topics |
| Update module | PUT /api/v1/courses/:id/modules/:id |
| List pages | GET /api/v1/courses/:id/pages |

---

## Distribution

**Chrome Web Store** — primary distribution. Free listing. One-time $5
developer registration. Provides one-click install and automatic updates.

**Microsoft Edge Add-ons Store** — secondary distribution. Edge uses the
same Chromium engine as Chrome and accepts Chrome extensions with minimal
additional submission work. No code changes required.

**GitHub Releases** — tertiary distribution. Downloadable zip for manual
installation via chrome://extensions with Developer Mode enabled. Serves
teachers who want to inspect the source before installing.

---

## Monetization

**V1.0 and V1.5:** Fully free. A donation link (Ko-fi or similar) appears
in Settings. The goal at this stage is adoption and feedback, not revenue.

**V2+:** Freemium with a one-time payment for the full feature set.

The free tier includes the complete Bulk Edit Tool and full change log. These
are core features and safety infrastructure — restricting them would make the
free experience feel deliberately broken, which damages trust and adoption.

| Tier | Includes |
|---|---|
| Free | Bulk Edit (complete), Templates (up to 5), Onboarding, Settings |
| Paid — one time | Unlimited templates, all Modules and Tools from V2 onward |

Exact pricing is deferred until V1 has real users and feedback.

---

## Open Source

**License:** MIT. Anyone may use, modify, and distribute the code. This is
intentional — teachers and institutions can inspect what the extension does,
and developers can contribute features from the roadmap.

The repository is public on GitHub from day one. Transparency is a trust
signal, particularly in an educational context where FERPA compliance matters.

---

## Branding

**Name:** Canvas Power Tools. Working title — may be revisited before launch.

**Icon direction:** A stylized lightning bolt or CPT monogram. Must be
legible at 16x16 pixels since that is the Chrome toolbar size. Use a blue
or teal that is visually distinct from Canvas's own brand blue to avoid
implying an official affiliation with Instructure.

**Required assets before Chrome Web Store submission:**

| Asset | Dimensions |
|---|---|
| Icon | 16×16, 32×32, 48×48, 128×128 PNG |
| Screenshots | 1280×800 PNG (minimum 3) |

---

## Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Canvas UI updates break injection points | Resilient selector system with cascade fallbacks and automatic recovery logging |
| API token compromised | Encrypted via crypto.subtle; never transmitted outside Canvas API calls |
| Canvas rate limiting | Request queue with automatic backoff in the API layer |
| Institution-specific Canvas configuration | Test against multiple sandbox configurations before release |
| Single developer maintenance burden | Open source structure invites contributors as the user base grows |
| chrome.storage.sync item size limit | Full content stored in local; only lightweight indexes in sync |
| MV3 service worker limitations | No persistent background tasks; token verification triggered by page open and auth failures only |
