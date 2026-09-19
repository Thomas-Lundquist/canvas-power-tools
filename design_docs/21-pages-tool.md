# Canvas Power Tools — 21: Pages Tool

## Module Context

Pages is a Tool within the **Content Module**, alongside Modules, Discussions, and Quiz Authoring. Doc 05 already places it there: *"Bulk publish and unpublish Canvas pages. Cross-course page duplication. View all pages in an organized list."*

It lives in Content rather than Assignments because a page is not graded work — it carries no points, no submission, no gradebook presence. The teacher's mental model is "course material," not "something students turn in."

---

## Overview

Canvas gives teachers no way to act on more than one page at a time. Publishing eight pages at the start of a unit means eight round trips through the Pages index, each one a menu click and a confirmation. Locking down student editing across a course means visiting every page individually.

The Pages Tool is the Bulk Editor's shape applied to pages: one course, every page in a table, select many, act once.

---

## Product Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Pages have no availability window.** The tool does not offer one, and says so where a teacher would look for it. | Canvas pages have no `unlock_at`/`lock_at`. The only date field is `publish_at` (Decision 2). Real availability gating for pages comes from **Modules** — module unlock dates and prerequisites. A date UI here would be a lie. |
| 2 | **`publish_at` is out of V1 pending an instance check.** | The Canvas docs state it *"will have no effect unless the 'Scheduled Page Publication' feature is enabled in the account."* Shipping a control that silently does nothing is worse than omitting it. Verify against the target instance first; if enabled, it is a clean V2 addition. |
| 3 | **Bulk rename is not offered.** | Changing a page's title **changes its URL**. Every inbound link — module items, links from other pages, the syllabus — breaks silently. At bulk scale this is course damage a teacher would not discover for weeks. Single-page rename may be offered later with an explicit warning; never in bulk. |
| 4 | **Cross-course duplication is delegated to Templates, not reimplemented.** | Doc 03's *Save as Template* → *Deploy* path already copies a page into other courses. Canvas's own `duplicate` endpoint works only within one course. Building a second cross-course path would be two code paths for one job. |
| 5 | **Per-page revert is a first-class feature, built in from the start.** | The Pages API exposes revisions (list / show / revert). No other Canvas resource the extension touches offers real undo. A bulk content tool with an undo button is a fundamentally safer tool, and retrofitting it later is harder. |
| 6 | **Filtering and search are pushed to Canvas's list endpoint.** | `GET /pages` supports `sort`, `order`, `search_term`, and a `published` filter server-side. Pulling every page down to filter client-side wastes requests and is slower on a large course. |
| 7 | **Block-editor pages are read-only for body edits.** | A page carries `editor: 'rce' \| 'block_editor'`. Block pages store structure in `block_editor_attributes`; writing raw `body` HTML risks corrupting them. The tool shows the editor type and refuses body edits on block pages. Publish, editing-roles, and delete remain safe on both. |

---

## What Canvas Actually Allows

Verified against the Pages API documentation.

**Writable per page:**

| Field | Notes |
|---|---|
| `published` | The core bulk action |
| `title` | ⚠️ changes the page URL — see Decision 3 |
| `body` | HTML; unsafe on block-editor pages (Decision 7) |
| `editing_roles` | `teachers`, `students`, `members`, `public` — comma-separated |
| `front_page` | One per course |
| `publish_at` | Feature-flag gated — see Decision 2 |
| `notify_of_update` | A write-time flag, not stored state |

**Endpoints:** list, show, create, update, delete, duplicate (same course only), revisions (list / show / revert).

**List parameters:** `sort` (`title` | `created_at` | `updated_at`), `order`, `search_term`, `published`, `include[]=body`.

**Read-only lock fields:** `locked_for_user`, `lock_info`, `lock_explanation` reflect *module* locks, not page settings. Surfaced as information; never editable here.

### A surprising interaction

Setting a future `publish_at` **unpublishes a page that is currently published**, and on create it causes `published` to be ignored entirely. If `publish_at` is ever added (Decision 2), this must be stated in the UI at the point of action — a teacher scheduling next week's page would not expect this week's to disappear.

---

## V1 Scope

**Three bulk actions:**

1. **Publish / Unpublish**
2. **Set editing roles** — who may edit the page
3. **Delete**

**Plus:** per-page **Revert** to a previous revision.

### The table

One course at a time. Columns: title, published state, editing roles, last updated, editor type (RCE / Block), front-page indicator.

Follows the Bulk Editor's established patterns — `AssignmentTable`, `FilterBar`, `BulkActionBar`, `PreviewDiff`, `ChangeLog` — including virtual scrolling with `aria-rowcount` / `aria-rowindex` per the accessibility standard.

### Filters

Published state, editing roles, editor type, and a title search. Published state and search map to Canvas's own query parameters (Decision 6); the rest filter client-side over the fetched set.

---

## Safety

Every Canvas write is PIN-gated via `usePinGate` and written to the audit log, per the project security rules. Bulk actions show a `PreviewDiff` before committing — the teacher sees exactly which pages change and how.

Delete is the one irreversible action and uses `forcePrompt` on the PIN gate, matching how other destructive operations in the extension behave.

No student PII is involved at any point — pages are course content. `last_edited_by` is present on the API object and is **not** displayed or stored.

---

## Out of Scope for V1

| Deferred | Why |
|---|---|
| `publish_at` scheduling | Feature-flag gated; verify the instance first (Decision 2) |
| Bulk rename | Breaks inbound links (Decision 3) |
| Cross-course duplication | Already served by Templates (Decision 4) |
| Body editing | Needs an editor surface; block-editor pages make it unsafe (Decision 7) |
| Front-page assignment | Single-value-per-course; a bulk table is the wrong shape for it |

---

## Open Questions

1. **Is "Scheduled Page Publication" enabled in the target Canvas instance?** Decides whether `publish_at` is ever buildable. Five minutes to check.
2. **How common are block-editor pages in practice?** If they are rare, Decision 7's restriction costs nothing. If they are common, body editing may never be worth building.
3. **Should revert be available in bulk** ("undo my last bulk change across these 12 pages"), or only per page? Bulk revert is more useful and more dangerous; per-page ships first either way.

---

## Relationship to Other Tools

```
Templates  ──→  deploys a page INTO a course        (doc 03)
Pages Tool ──→  manages pages already IN a course   (this doc)
Fix Links  ──→  repairs references BETWEEN courses  (doc 22, exploratory)
```

The Pages Tool builds the page-reading and bulk-write plumbing that doc 22 would reuse. That is a reason to build it first.
