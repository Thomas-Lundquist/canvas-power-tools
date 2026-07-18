# Canvas Power Tools — 17: UI Redesign Process (Per-Tool)

This is the **repeatable process** for redesigning each tool's UI from the ground up,
applying Refactoring UI principles feature-first. Follow it identically for every tool
so the collaboration stays consistent and the design docs never drift again.

Parent epic: `canvas-power-tools-1yr` · Per-tool rebuild tracker: `canvas-power-tools-1yr.4`

---

## The Rule That Prevents Drift

> **Decisions get written into the tool's design doc the moment they're made — not later.**

Design docs are the source of truth (the *how*). Beads is the work queue (the *what*).
Git is the record. Conversation is where we think, but nothing is "decided" until it's
in the doc.

---

## The Seven Steps (same for every tool)

**1. Read the current design doc first.**
Build on what's documented; never guess at a prior decision. Understand the tool's
existing spec before proposing changes.

**2. State the core action in one sentence (feature-first).**
"What does the teacher actually do with this tool?" The layout must emerge from this
answer — Refactoring UI Ch. 1. Never start from an existing layout and adjust.

**3. Walk the primary flow.**
The concrete step-by-step a teacher takes, start to finish. This surfaces every screen
and state the UI has to cover.

**4. Identify the real decision points and present trade-offs.**
Only the choices that genuinely have multiple valid answers. Present as labeled options
(A / B / C) with the trade-off named for each. Recommend one, but it's the user's call.
Do not narrate choices with an obvious default — just take those.

**5. Lock each decision into the design doc immediately, with rationale.**
- Add/update a **"UI Design Decisions (Locked)"** table near the top of the doc.
- Expand the relevant body sections with the full spec (layout sketch, states, behavior).
- Include the *why*, so future-us doesn't re-litigate it.

**6. Create a beads sub-issue under `1yr.4` for the rebuild.**
`bd create --title="Rebuild <Tool> UI (feature-first)" --parent=canvas-power-tools-1yr.4`
Description points at the tool's design doc as the spec. Stays open until implemented.

**7. Move to the next tool** in roadmap order (below).

---

## Refactoring UI Principles We Apply Every Time

- **Feature first, layout second** (Ch. 1). The primary content is the tool; everything
  else serves it.
- **Visual weight matches importance, not quantity** (Ch. 4). Failures/actions get weight
  even when they're few; reassurance stays calm even when it's many.
- **Elevation signals interaction, not decoration** (Ch. 7). Shadow = "this floats above,
  it's an action layer," not ornament. Cards: border only. Dropdowns: shadow-md. Modals:
  shadow-lg. Floating action layers: shadow-lg.
- **Don't rely on layout alone for meaning** (Ch. diff/color). Old→new diffs use muted old,
  accent arrow, strong new — color + weight + glyph all reinforce.
- **Translate on the stable contract, not the unstable surface.** HTTP status codes over
  message-string matching. (A robustness principle, applied to error UX.)
- **Meaningful numbers** communicate consequence ("15 fields to change"), not UI state.

---

## Tool Order (roadmap)

1. ✅ **Bulk Editor** — `design_docs/02` · beads `1yr.4.1`
2. ✅ **Templates** — `design_docs/03` · design locked · beads `1yr.4.2` (implementation pending)
3. **Grade Outreach / Threshold** — `design_docs/14`
4. **Nudge Tool** — `design_docs/14`
5. **Announcements** — `design_docs/14`
6. **Accommodations** — `design_docs/13`
7. *(then Grading module tools: Overview, Missing Work, Adjustments, Late Policy — `design_docs/15`)*

Update this list's checkmarks as each tool's design is locked.

---

## Session Resume Checklist

1. `bd prime` — session context.
2. Read this doc (`design_docs/17`).
3. Find the next unchecked tool in the order above.
4. Start at Step 1 (read that tool's design doc).
