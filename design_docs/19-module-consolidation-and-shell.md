# Canvas Power Tools — 19: Module Consolidation & Shell Architecture

> **Status:** Plan of record. Covers the module-shell navigation layer and
> consolidation decisions. Revises doc 05.

---

## 1. Context — why this change

The product grows toward ~30 Tools. Two structural problems emerged:

1. **Redundancy.** Several "tools" are one operation along a different axis:
   Nudges vs Threshold (audience filter), Sections vs Accommodations (override
   audience), Content → Modules/Pages/Discussions (resource type). Built
   separately, they duplicate machinery.
2. **Navigation & delivery.** Every Tool is its own extension page; moving
   between them is a full page transition, and the homepage is a flat grid of
   many tiles. This does not scale to 30 tools without feeling busy.

Goal: cut redundancy and unify navigation without a confusing UI, and make a
new tool cheap to add. The lever is composition — build a few engines and reuse
them, expressing each tool as a thin specialization.

---

## 2. Principles

1. **Merge machinery, not mental models.** Combine two things onto one screen
   only when a teacher narrates them as one job. If the framing differs, share
   an engine underneath but keep separate entry points.
2. **Module = workspace · Tool = task.** The Module is the anti-clutter layer:
   the homepage shows ~6 Module cards, not 30 tools.
3. **Composition over specialization.** Engines are built once; screens are
   assembled from shared components.

---

## 3. The three consolidation moves

| Move | What it means | Applies to |
|---|---|---|
| **True merge** — one tool, one axis control | Same verb *and* same mental model, differing by one filter → a toggle, defaulting to the common case | **Message Students** = Nudges + Threshold (+ section/group) · **Content** = Modules + Pages + Discussions (resource switcher) |
| **Shared engine, separate doors** | Different jobs, identical machinery → same code, distinct entry points | Sections + Accommodations + Bulk-Edit dates → one **Override Engine** · Adjustments + Late Policy → one transform engine *(proposed)* |
| **Context-launch** — not a tool | The intent lives inside another surface | **Copy/Duplicate** → assignment row action · **Comment Bank** → inside the Compose surface + SpeedGrader · **Keyboard Shortcuts** → Settings toggle · **Grade-missing-as-zero** → dashboard button |

**Status:** True merges and the Override Engine are **adopted**. Tier-2 merges
(Adjustments + Late Policy; Grading Overview + Missing Work as one dashboard) are
**proposed**, pending per-tool sign-off during implementation.

---

## 4. Navigation architecture — the Module shell (new)

**Today:** Tool = separate extension page; homepage picker; full-page transition
on every jump.

**Target:** **Module = one extension page; Tool = a client-side routed view
inside it.** Full-page transition happens only Home ↔ Module; Tool ↔ Tool — and
screen ↔ screen within a tool — is an instant content-pane swap.

The shell consists of:
- **AppNav** — brand, module switcher, settings
- **Tool rail** — derived from the registry; links to each Tool in the active Module
- **Content pane** — renders the current Tool/screen; swaps on navigation

**Driven by the registry.** `src/config/tools.jsx` (already the single source of
truth) gains routing metadata per tool/screen; the shell derives the rail and
the content pane from it. Adding or moving a tool = one config row, no new page.

---

## 5. Tool classification by interaction pattern

Each Tool fits one of these functional patterns. The pattern informs what the
content pane needs to render, not how it looks.

| Pattern | Shape |
|---|---|
| **Table-Primary** | A virtualized table is the primary surface; row actions and bulk selections are the main interactions |
| **Browse/Library** | Search-and-pick list; content is authored and reused across courses |
| **Resource-Manager** | CRUD a managed collection (groups, rubrics, etc.) |
| **Dashboard** | Metrics and drill-in; read-heavy with some actions |
| **Config/Form-Flow** | Multi-step form or wizard; fields → preview → apply |
| **Compose/Messaging** | Author content, pick recipients, preview, send |
| **Log / Audit Trail** | Read-only time-ordered record |

**Tool → pattern:**

| Module | Tool | Pattern(s) |
|---|---|---|
| **Assignments** | Bulk Editor | Table-Primary |
| | Templates · Rubrics | Browse/Library + Resource-Manager |
| | Assignment Groups | Resource-Manager |
| | Copy | Table-Primary (source) → Config/Form-Flow (target) |
| | QTI Import | Config/Form-Flow |
| | Change Log | Log / Audit Trail |
| | Peer Review | **TBD** — no design doc yet |
| **Grading** | Dashboard · At-Risk | Dashboard |
| | Missing Work | Table-Primary |
| | Adjustments · Late Policy | Config/Form-Flow |
| **Communication** | Grade Outreach | Compose/Messaging |
| | Submission Reminders | Compose/Messaging |
| | Announcements | Compose/Messaging |
| | Sent Log | Log / Audit Trail |
| **People** | Student Groups | Resource-Manager |
| | Sections | Table-Primary |
| | Accommodations | Resource-Manager |
| | Roster | **TBD** — likely Browse/Library, purpose unclear |
| **Content** | Modules | **TBD** — scope (reorder-only vs. full management) unclear |
| | Pages | **TBD** — purpose unclear |
| | Discussions | **TBD** — purpose unclear |
| **Setup** | Rollover | Config/Form-Flow |
| | Course Settings | Browse/Library + Resource-Manager |
| | Audit Log | Log / Audit Trail |
| **TBD module** | Blueprints | Browse/Library + Resource-Manager *(module TBD)* |
| | Standards | Table-Primary *(module TBD)* |

> **Tabled tools (8):** Peer Review, Roster, Modules, Pages, Discussions, Blueprints (module placement), Standards (module placement). Each needs a locked job-to-be-done before its pattern or module can be finalised. Do not implement these until that discussion happens.

**Divergence rule — siblings, not clones.** Converge the frame and interaction
machinery; diverge the content and domain controls. Same job / different resource
→ near-identical (Communication's three Compose tools). Same pattern / different
domain → diverge significantly in content (Bulk Editor vs. Standards; both Table-Primary
but very different domain controls).

---

## 6. Shared engines / primitives (build once)

These are higher-level than individual components — each encodes a recurring
multi-step interaction that appears in several tools.

| Primitive | Born in | Reused by |
|---|---|---|
| `ResourceGrid` (select · filter · preview-diff · PIN apply) | Bulk Editor | Missing Work, Sections, Content, Standards |
| `LibraryShell` (folders · cards · deploy) | Templates | Rubrics, Blueprints, Course Settings, Comment Bank |
| `AudiencePicker` (course/section/group/student) | Message Students | Grading, Overrides, Announcements |
| `Composer` (tokens · Comment Bank · PIN · sent log) | Message Students | Announcements |
| `OverrideEngine` (assign-to across many assignments) | Bulk Editor dates | Sections, Accommodations |
| `PreviewDiff` · `ChangeLog` · `PinGate` · `SentLog` | existing | every write path |

---

## 7. Build / migration path

Each phase is its own Beads issue(s).

| Phase | Work |
|---|---|
| **0 — done** | Token ramps and CSS custom properties foundation (global.css) |
| **1** | Module shell + in-page routing + routing metadata on the registry; convert **Assignments** from separate pages to routed views |
| **2** | Land shared engine components |
| **3** | Migrate the remaining built tools onto the shell |
| **4** | Apply the consolidation merges (Message Students, Content, Override Engine) + context-launch relocations |
| **5** | Build planned tools as engine specializations (QTI, Peer Review, At-Risk, Content, Setup, Roster) |

---

## 8. Non-goals / open questions

- **Exact per-tool UI is not fixed here.** Visual design is derived from the Stitch design files, not from this document.
- **Content & Setup** modules are planned, not built.
- **Tier-2 merges** (Adjustments + Late Policy; Overview + Missing Work) are proposed, not adopted.
- **SpeedGrader** stays injected (content-script), not a picker Module.

---

## 9. References

- UI redesign process (superseded): `17-ui-redesign-process.md`
- Roadmap (revised to the merged tool list): `05-roadmap.md`
