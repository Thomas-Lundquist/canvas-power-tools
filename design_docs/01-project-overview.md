# Canvas Power Tools — 01: Project Overview

---

## What It Is

Canvas Power Tools is a Chrome browser extension that gives teachers a faster,
smarter interface for common Canvas LMS workflows. It does not replace Canvas —
it sits on top of it, adding functionality that Instructure has been slow to
implement. The core value proposition is reducing friction on high-frequency,
tedious tasks that teachers perform every day.

---

## Delivery Architecture

The extension uses Chrome Manifest V3. Content scripts are injected into Canvas
pages, but their only job is to add a trigger button to the Canvas UI. All real
functionality lives on separate full extension pages that open in a new tab when
the teacher clicks that button. This means:

- The extension does not fight with Canvas's own CSS or JavaScript
- UI has full screen real estate rather than being cramped into a panel
- Canvas UI updates only affect the small injection point, not the whole tool
- All pages are fully controlled by the extension

The extension talks directly to the Canvas REST API using the teacher's own API
token. There is no backend server for V1. Everything runs client-side in the
teacher's browser.

---

## Core Design Principles

These apply to every feature, every screen, and every line of code.

**Privacy First**
No data ever leaves the teacher's device except to their own Canvas instance.
No analytics. No external logging. No third party services touching teacher or
student data. This is not just an ethical decision — it is a selling point and
a FERPA compliance strategy.

**FERPA Aligned**
Student names, grades, emails, and any other PII are fetched on demand from
Canvas and never persisted by the extension. The extension does not store
student data. Ever.

**Preview Before Write**
No bulk operation executes without showing the teacher exactly what will change
first. Every write operation goes through a preview confirmation step showing
old values and new values side by side.

**Revert Everything**
Every write operation is recoverable. A change log tracks the last 10 operations
per course. Any entry can be reverted. Reverts are themselves logged so they are
also recoverable.

**Reusable Architecture**
Functions like getCourses(), getAssignments(), and updateAssignment() are built
once in a shared API layer and used by every feature. UI components like the
multi-select list, date picker, modal, and bulk action bar are built once and
reused everywhere. This reduces bugs, speeds development, and makes the codebase
maintainable.

**Minimal Permissions**
The Chrome manifest requests only the permissions strictly required for each
feature. No broad host permissions beyond what is needed.

**Professional UI**
Clean, professional interface. Icons from a consistent library such as Lucide or
Heroicons. No emojis anywhere in the UI, documentation, or codebase.

**Depth Before Breadth**
Ship one feature done excellently before building the next. Do not spread effort
thin across many half-finished features.

---

## Tech Stack

| Component | Technology | Notes |
|---|---|---|
| Extension Standard | Chrome Manifest V3 | Required for Chrome Web Store |
| Language | JavaScript ES6+ | Migrate to TypeScript in a later version |
| UI Framework | React | Best fit for complex table and form UI |
| Styling | Tailwind CSS | Utility-first, no conflicts with Canvas styles |
| Build Tool | Vite | Fast, modern, excellent MV3 support |
| Extension Plugin | CRXJS (Vite plugin) | Handles MV3 manifest and hot reload |
| Package Manager | npm | Standard, widely documented |
| Local Storage | chrome.storage.local | Fast local cache |
| Sync Storage | chrome.storage.sync | Source of truth, follows teacher across devices |
| Encryption | Web Crypto API / crypto.subtle | Token encryption, built into the browser |
| HTTP Client | Fetch API (native) | No dependencies, MV3 compatible |
| Testing V1 | Manual against Canvas sandbox | Formal test suite added in a later version |
| Version Control | Git + GitHub | Public repository |

---

## Storage Architecture

Two storage layers work together:

chrome.storage.sync is the source of truth. It follows the teacher across all
their Chrome instances. When they log into Chrome on a different computer their
settings and templates are already there.

chrome.storage.local is a speed cache. The extension reads from local first for
instant load times, then syncs in the background. If local and sync ever differ,
sync wins.

**Write strategy:** update sync first, then refresh local cache.
**Read strategy:** read local immediately, sync in background and update UI if
different.

---

## Complete Storage Schema

```
{
  account: {
    canvasUrl: "https://yourschool.instructure.com",
    apiToken: "encrypted_token_string",
    lastVerified: "2025-10-01T14:32:00Z",
    verificationStatus: "valid" | "failed" | "unchecked"
    // Future: institutions array for multi-institution support
  },

  preferences: {
    shiftAllDatesTogether: true,
    defaultCourse: "last_used" | "ask",
    lastUsedCourseId: "12345"
    // Future: per-course overrides object
  },

  changeLogs: {
    "courseId_1": [
      {
        id: "unique_id",
        timestamp: "2025-10-01T14:32:00Z",
        courseId: "12345",
        courseName: "Biology 101 - Fall 2025",
        summary: "3 changes across 2 assignments",
        type: "edit" | "revert",
        revertedFromId: null,
        changes: [
          {
            assignmentId: "67890",
            assignmentName: "Quiz 1",
            field: "dueDate" | "availableFrom" | "availableUntil" |
                   "points" | "published",
            previousValue: "2025-10-01",
            newValue: "2025-10-08"
          }
        ]
      }
    ]
    // Up to 10 entries per course
    // Oldest entry dropped when 11th is added
  },

  templates: {
    folders: [
      {
        id: "folder_1",
        name: "Quizzes",
        createdAt: "2025-09-01T00:00:00Z"
      }
    ],
    items: [
      {
        id: "template_1",
        folderId: "folder_1",
        name: "Weekly Quiz",
        createdAt: "2025-09-01T00:00:00Z",
        lastUsed: "2025-10-01T00:00:00Z",
        sourceAssignmentId: "12345",
        fields: {
          name: "Weekly Quiz",
          description: "Complete all questions.",
          points: 20,
          submissionType: "online",
          allowedFormats: ["online_text_entry", "online_upload"],
          assignmentGroup: "Quizzes",
          gradingType: "points",
          peerReview: false
          // Future: rubricId
        }
      }
    ]
  },

  meta: {
    version: "1.0.0",
    setupComplete: true
  }
}
```

---

## Project Folder Structure

```
canvas-power-tools/
│
├── manifest.json
│
├── src/
│   ├── content_scripts/
│   │   ├── main.js              Entry point, detects page context
│   │   └── ui-injector.js       Injects trigger button into Canvas
│   │
│   ├── api/
│   │   ├── auth.js              Token storage, retrieval, verification
│   │   ├── assignments.js       Assignment CRUD and bulk operations
│   │   ├── courses.js           Course fetching
│   │   └── request.js           Base fetch wrapper, rate limiting, errors
│   │
│   ├── dom/
│   │   ├── selectors.js         Central selector registry
│   │   ├── selector-engine.js   Smart finder with cascade fallbacks
│   │   ├── health-check.js      Local integration health status
│   │   └── recovery-log.js      Failure logging
│   │
│   ├── reporting/
│   │   ├── manual-export.js     GitHub issue generator
│   │   └── privacy-filter.js    Strips PII before any reporting
│   │
│   ├── components/
│   │   ├── Modal.js
│   │   ├── BulkSelector.js
│   │   ├── DatePicker.js
│   │   ├── PreviewDiff.js
│   │   └── FilterBar.js
│   │
│   ├── features/
│   │   ├── assignments/
│   │   │   ├── BulkEditor.js
│   │   │   └── bulkEditorHelpers.js
│   │   └── templates/
│   │       ├── TemplateLibrary.js
│   │       ├── TemplateEditor.js
│   │       ├── DeployTemplate.js
│   │       └── templateHelpers.js
│   │
│   ├── pages/
│   │   ├── bulk-editor/
│   │   │   ├── index.html
│   │   │   └── index.js
│   │   ├── templates/
│   │   │   ├── index.html
│   │   │   └── index.js
│   │   ├── settings/
│   │   │   ├── index.html
│   │   │   └── index.js
│   │   └── onboarding/
│   │       ├── index.html
│   │       └── index.js
│   │
│   └── popup/
│       ├── popup.html
│       └── popup.js
│
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── docs/
│   └── screenshots/
│
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── PRIVACY.md
└── CHANGELOG.md
```

---

## Canvas API Endpoints Used in V1

| Action | Method | Endpoint |
|---|---|---|
| Verify token / get user info | GET | /api/v1/users/self |
| List courses | GET | /api/v1/courses |
| List assignments | GET | /api/v1/courses/:id/assignments |
| Create assignment | POST | /api/v1/courses/:id/assignments |
| Update assignment | PUT | /api/v1/courses/:id/assignments/:id |
| Delete assignment | DELETE | /api/v1/courses/:id/assignments/:id |
| Bulk update dates | PUT | /api/v1/courses/:id/assignments/bulk_update |
| Duplicate assignment | POST | /api/v1/courses/:id/assignments/:id/duplicate |
| List assignment groups | GET | /api/v1/courses/:id/assignment_groups |
| List modules | GET | /api/v1/courses/:id/modules |

All requests include the Authorization header:
Authorization: Bearer YOUR_API_TOKEN

Canvas paginates responses. The request wrapper must handle Link headers to
fetch all pages, not just the first.

---

## Distribution

**Primary:** Chrome Web Store — free listing, one-time $5 developer registration
fee. Gives teachers one-click install and automatic updates.

**Secondary:** GitHub releases — downloadable zip for manual installation via
chrome://extensions with Developer Mode enabled. For teachers who want to
inspect the code before installing.

Both distribution channels are maintained simultaneously. The Web Store listing
links to the GitHub repository. The GitHub repository links to the Web Store.

---

## Monetization Plan

**V1:** Fully free. Donation option via Ko-fi or similar, linked in Settings
and the GitHub repository. Goal is adoption, feedback, and proving value before
charging anything.

**V2+:** Freemium with one-time payment. Free tier remains genuinely useful.
Paid tier unlocks the full feature set.

Free tier includes:
- Bulk Assignment Editor (core functionality)
- Assignment Templates (up to 5 templates)
- Onboarding and Settings

Paid tier (one-time purchase) includes:
- Unlimited templates
- Template folders
- Cross-course template deployment
- Grading Dashboard
- Group Manager
- Change log and revert system
- Advanced column filters

Pricing not yet determined. To be decided once V1 has real users and feedback.

---

## Open Source

License: MIT. Maximum freedom — anyone can use, modify, and distribute the
code. This is intentional. Teachers and institutions can inspect exactly what
the extension does. Developers can contribute features from the roadmap.
The open source nature is a primary trust signal, especially in an educational
context where FERPA compliance matters.

Repository will be public on GitHub from day one.

---

## Future Architecture Consideration — LTI

Long term, the ideal delivery mechanism is LTI (Learning Tools Interoperability)
— the official standard for embedding third party tools natively inside Canvas.
LTI tools appear in the Canvas left navigation sidebar exactly like native
Canvas features. They require a backend server and institutional admin approval,
which is why they are not the V1 approach.

The browser extension is the right first step. It validates the product with
real teachers, builds deep Canvas API knowledge, and generates a user base.
The LTI version is the mature product that follows. All feature designs,
data structures, and UI patterns transfer directly — only the delivery
mechanism changes.

---

## Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Canvas UI updates break injected elements | Resilient DOM selector system with cascade fallbacks |
| API token security | Encrypted with crypto.subtle, never leaves device |
| Canvas rate limiting | Request queue with backoff in the API layer |
| Institution-specific Canvas configuration | Test across multiple sandbox configurations |
| Sole developer maintenance burden | Open source invites contributors over time |
| Chrome MV3 restrictions | Architecture designed around MV3 from the start |
