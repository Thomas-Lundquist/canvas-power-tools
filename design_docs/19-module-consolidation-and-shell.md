# Canvas Power Tools — 19: Module Consolidation & Shell Architecture

> **Status:** Plan of record. Adds the **module-shell navigation layer** and the
> **consolidation decisions**; it adopts the **six archetypes and interaction
> grammar already defined in doc 10** (§"Interaction Grammar & Archetypes,
> 1yr.2") — it does *not* introduce a new taxonomy.
> Origin: the `feat/shell/module-nav-prototype` spike (throwaway reference — its
> exact UI, its hand-rolled components, and its simplified 5-archetype set are
> **not** the spec). Sits alongside `17-ui-redesign-process.md`; revises doc 05.

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

Goal: **cut redundancy and unify navigation without a confusing UI**, and make a
new tool cheap to add. The lever is composition — build a few engines and reuse
the doc-10 archetypes, expressing each tool as a thin specialization.

---

## 2. Principles

1. **Merge machinery, not mental models.** Combine two things onto one screen
   *only* when a teacher narrates them as one job. If the framing differs, share
   an engine underneath but keep separate entry points.
2. **Module = workspace · Tool = task · Archetype = shape.** The Module is the
   anti-clutter layer: the homepage shows ~6 Module cards, not 30 tools.
3. **Composition over specialization.** Engines are built once; screens are
   assembled from the doc-10 atoms so they are grammar-compliant *by
   construction*. Nothing is hand-rolled that an atom already covers.

---

## 3. The three consolidation moves

| Move | What it means | Applies to |
|---|---|---|
| **True merge** — one tool, one axis control | Same verb *and* same mental model, differing by one filter → a `SegmentedToggle`, defaulting to the common case | **Message Students** = Nudges + Threshold (+ section/group) · **Content** = Modules + Pages + Discussions (resource switcher) |
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
screen ↔ screen *within* a tool — is an instant content-pane swap.

```
┌ AppNav ─ brand · module switcher ▾ · settings ───────────────┐
├──────────────┬───────────────────────────────────────────────┤
│  Tool rail   │   Content pane = the current screen's archetype│
│  (from       │   (swaps instantly)                            │
│   registry)  │                                                │
│  ‹ All Mods  │                                                │
└──────────────┴───────────────────────────────────────────────┘
```

**Driven by the registry.** `src/config/tools.jsx` (already the single source of
truth) gains an `archetype` field per tool/screen; the shell derives the rail and
the content pane from it. Adding or moving a tool = **one config row**, no new
page. The spike proved this with its `MODULES_SPEC` table.

This shell is the piece doc 10 does not yet cover: its archetypes describe a
*screen's* shape; the shell is the *frame* every screen renders inside. Doc 10 is
extended with a short "Module Shell" note pointing here.

---

## 5. Archetypes — adopt the canonical six (doc 10)

Doc 10 already defines six page archetypes, their enforcing atoms, grammar
posture, and a **per-screen** classification tree. This plan uses them unchanged.
The spike's five were an expedient simplification — the mapping:

| Doc-10 archetype | Shape | Spike stand-in |
|---|---|---|
| **B1 Table-Primary** | virtualized table *is* the page | "Grid" |
| **B2 Browse/Library** | search-and-pick list | "Library" (read side) |
| **B5 Resource-Manager** | CRUD a managed collection | "Library" (manage side) |
| **B3 Dashboard** | metrics + drill-in | "Dashboard" |
| **B4 Config/Form-Flow** | fields · steps · wizard | "Wizard" |
| **B6 Compose/Messaging** | author + send | "Composer" |
| **B7 Log / Audit Trail** | read-only time-ordered record | *(no spike stand-in — new)* |

**Classify per screen, not per tool.** Copy is Table-Primary on its source step
and Config/Form-Flow on its target step; the shell routes between a tool's
screens exactly as it routes between tools.

**Tool → archetype (per the doc-10 classifier):**

| Module | Tool | Archetype(s) |
|---|---|---|
| **Assignments** | Bulk Editor | B1 Table-Primary |
| | Templates · Rubrics | B2 Browse/Library + B5 Resource-Manager |
| | Assignment Groups | B5 Resource-Manager |
| | Copy | B1 Table-Primary (source) → B4 Config/Form-Flow (target) |
| | QTI Import | B4 Config/Form-Flow |
| | Change Log | B7 Log / Audit Trail |
| | Peer Review | **TBD** — no design doc yet |
| **Grading** | Dashboard · At-Risk | B3 Dashboard |
| | Missing Work | B1 Table-Primary |
| | Adjustments · Late Policy | B4 Config/Form-Flow |
| **Communication** | Grade Outreach | B6 Compose/Messaging |
| | Submission Reminders | B6 Compose/Messaging |
| | Announcements | B6 Compose/Messaging |
| | Sent Log | B7 Log / Audit Trail |
| **People** | Student Groups | B5 Resource-Manager |
| | Sections | B1 Table-Primary |
| | Accommodations | B5 Resource-Manager |
| | Roster | **TBD** — likely B2, purpose unclear |
| **Content** | Modules | **TBD** — scope (reorder-only vs. full management) unclear |
| | Pages | **TBD** — purpose unclear |
| | Discussions | **TBD** — purpose unclear |
| **Setup** | Rollover | B4 Config/Form-Flow |
| | Course Settings | B2 Browse/Library + B5 Resource-Manager |
| | Audit Log | B7 Log / Audit Trail |
| **TBD module** | Blueprints | B2 Browse/Library + B5 Resource-Manager *(module TBD)* |
| | Standards | B1 Table-Primary *(module TBD)* |

> **Tabled tools (8):** Peer Review, Roster, Modules, Pages, Discussions, Blueprints (module placement), Standards (module placement). Each needs a locked job-to-be-done before its archetype or module can be finalised. Do not implement these until that discussion happens.

**Divergence rule — siblings, not clones.** Converge the *frame, grammar, and
enforcing atoms*; diverge the *content and domain controls*. Same job / different
resource → near-identical (Communication's three Compose tools). Same archetype /
different domain → diverge (Bulk Editor's editable date cells + change log vs
Standards' outcome chips + coverage map; both Table-Primary).

---

## 6. Shared engines / primitives (build once)

Higher-level than atoms; each composes the doc-10 atoms of its archetype.

| Primitive | Born in | Reused by | Composes |
|---|---|---|---|
| `ResourceGrid` (select · filter · preview-diff · PIN apply) | Bulk Editor | Missing Work, Sections, Content, Standards | `AssignmentTable`, `Toolbar`, `Badge`, `Actions` |
| `LibraryShell` (folders · cards · deploy) | Templates | Rubrics, Blueprints, Course Settings, Comment Bank | `ListRow`, `ListGroup`, `SearchInput`, `EmptyState` |
| `AudiencePicker` (course/section/group/student) | Message Students | Grading, Overrides, Announcements | `Select`, chips, `ListRow` |
| `Composer` (tokens · Comment Bank · PIN · sent log) | Message Students | Announcements | `TextField`, `Actions`, `Callout` |
| `OverrideEngine` (assign-to across many assignments) | Bulk Editor dates | Sections, Accommodations | `ResourceGrid` + date fields |
| `PreviewDiff` · `ChangeLog` · `PinGate` · `SentLog` | existing | every write path | — |

---

## 7. Design-system reconciliation (the gap the spike exposed)

The prototype hand-rolled its own `IconBtn` and bare `.btn` markup with arbitrary
Tailwind spacing. **That is not the standard.** Real archetypes:

- Compose doc-10 **atoms** — `Button`, `IconButton`, `Badge`, `Actions`,
  `StatCard`, `ListRow`, `Toolbar`, `Callout`, `EmptyState`, `Skeleton`, `Modal`,
  `TextField` / `Select` / `RadioGroup` / `SegmentedToggle` — never bare classes.
- Take all spacing from `--space-*`, all color from semantic tokens / ramps, all
  accent from `--cpt-color` / `--primary-*` (themed by `applyTheme()`).
- Inherit the **interaction grammar** by construction (one primary bottom-right
  via `Actions`; color = meaning; checkbox selects / row-click opens; focus
  trap + restore; never color as the sole signal).

---

## 8. Build / migration path

Each phase is its own Beads issue(s).

| Phase | Work |
|---|---|
| **0 — done** | Design language, atoms, token ramps, interaction grammar + six archetypes (doc 10, beads 1yr.1 / 1yr.2 / 1yr.5 / czg) |
| **1** | Module shell + in-page routing + `archetype` field on the registry; convert **Assignments** from separate pages to routed views |
| **2** | Land the archetype scaffolds as shared components on the doc-10 atoms |
| **3** | Migrate the remaining built tools onto their archetype |
| **4** | Apply the consolidation merges (Message Students, Content, Override Engine) + context-launch relocations |
| **5** | Build planned tools as archetype specializations (QTI, Peer Review, At-Risk, Content, Setup, Roster) |

---

## 9. Non-goals / open questions

- **Exact per-tool UI is not fixed here.** Tools specialize within their
  archetype at implementation time.
- **Content & Setup** modules are planned, not built.
- **Tier-2 merges** (Adjustments + Late Policy; Overview + Missing Work) are
  proposed, not adopted.
- **SpeedGrader** stays injected (content-script), not a picker Module.

---

## 10. References

- Prototype spike: branch `feat/shell/module-nav-prototype` → `src/pages/module/`
- Design language, atoms, interaction grammar & six archetypes: doc 10
- UI redesign process: doc `17-ui-redesign-process.md`
- Roadmap (revised to the merged tool list): doc `05-roadmap.md`
