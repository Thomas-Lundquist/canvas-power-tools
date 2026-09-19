# Canvas Power Tools — 22: Fix Links (Exploratory)

**Status: Idea only — not a committed design, not scheduled, not scoped.**

This document records a problem worth solving and one plausible approach, so the
thinking is not lost. Nothing here is decided. The open questions at the end are
real blockers, not polish — several of them could kill the idea outright.

Do not build from this document. It is a starting point for a design, not a design.

---

## The Problem

Canvas content is full of absolute course-scoped URLs:

```html
<a href="/courses/12345/assignments/678">Read the lab writeup</a>
<img src="/courses/12345/files/910/preview">
```

Those URLs hardcode a course ID. When content moves between courses, the links keep
pointing at the **origin** course. Two ways this happens in normal use:

1. **Semester rollover.** Last year's course is copied forward. Canvas's own course
   copy rewrites most internal links — but not all, and not content added afterward.
2. **Template deploy.** Doc 03 documents this explicitly as a known limitation:
   instructions HTML is stored verbatim, so a template deployed into a new course
   carries links back to wherever it was captured.

The symptom is quiet. Everything looks fine to the teacher, who still has access to
the old course. Students get a permission error or a 404. It often surfaces weeks
later, reported by a confused student.

---

## Why Not Just Use Canvas's Validator

Canvas has **Course Settings → Validate Links in Content**, which finds broken links.
Two reasons it does not solve this:

1. **It is not in the public API.** The documented Courses API has no link-validation
   endpoint. The UI feature is backed by an internal route. Building a Chrome Web
   Store product on an undocumented endpoint means shipping something that can break
   without notice and without recourse.
2. **It only reports.** Even used manually, it hands the teacher a list. Every fix is
   still opened and edited by hand — which is the entire cost of the problem.

So detection would be ours to write regardless. That reframes the question: if we are
writing the scan anyway, the valuable half is the **fix**, which Canvas does not offer
at all.

---

## Narrowing to What Is Actually Tractable

"Link fixer" could mean several different tools. Most are bad ideas:

| Interpretation | Verdict |
|---|---|
| Detect stale `/courses/OTHER_ID/...` references and remap them to the current course | **The tractable one.** Deterministic, verifiable, no guessing. |
| Check every external URL for a 404 | Slow, noisy, rate-limit-hostile, and half-served by Canvas already. |
| Find links to deleted content and guess the replacement | Requires fuzzy name matching. A wrong guess silently points a student at the wrong assignment. Worse than a broken link. |
| Fix file links across courses | The file does not exist in the target course. A real fix means re-uploading and rewriting — a much larger feature. |

Only the first is both safe and useful. Any exploration should start there and treat
the rest as separate questions.

---

## Sketch of an Approach

**Scan.** Read the HTML-bearing fields across a course: page bodies, assignment
descriptions, discussion and announcement messages, the syllabus body, and module
item external URLs. Extract every `/courses/:id/...` reference where `:id` is not the
current course.

**Group.** Present findings grouped by *source course*, because the fix is usually
uniform: "all 47 links point at last year's Culinary 1 — remap them all."

**Preview.** Per-link before/after, using the existing `PreviewDiff` component. No
blind writes.

**Rewrite.** Replace the course ID in matched URLs. Write the fields back.

### One rule that is not negotiable

**Never parse and re-serialize the HTML.** Targeted string replacement on the matched
URL substrings only.

A `DOMParser` round-trip silently rewrites entity encoding, attribute quoting,
self-closing tags, and whitespace. On one page that is invisible. Across a whole
course it is content corruption that no one notices until a teacher asks why their
formatting changed — and by then the original is gone.

This constraint is the single most important thing in this document. Any
implementation that ignores it should be rejected in review regardless of how clean
the rest looks.

---

## Why This Is Higher Risk Than Anything Currently Shipped

Every other tool in the extension edits *structured fields*: a due date, a points
value, a published flag. This one rewrites **teacher-authored content in bulk**. A bug
does not produce a wrong date — it produces mangled HTML across dozens of pages.

If it is ever built, it needs more safety than the current standard, not the same:

- `PreviewDiff` on every single link, not a summary count
- PIN gate with `forcePrompt` — this is not a routine write
- Full change-log entries capturing the before state
- Page revisions (doc 21, Decision 5) as genuine undo for the page half
- Serious consideration of a dry-run-only first release

Note that **assignments, discussions, and the syllabus have no revision API**. Undo
would cover pages only. That asymmetry is itself an argument for shipping a
report-only version first.

---

## Open Questions

These are unresolved and several are potentially fatal.

1. **Is a report-only tool enough?** A scan that produces an accurate list of stale
   links, with direct edit links, might capture most of the value at a fraction of the
   risk. This should be honestly evaluated before any rewriting is built — it may be
   the whole answer.
2. **How does this interact with Canvas course copy?** If Canvas's rollover already
   rewrites most links, the real-world remainder may be small enough not to justify
   the tool. **This needs measuring against a real rolled-over course before anything
   is designed.** If the answer is "Canvas already handles 95% of it," this idea
   should be dropped.
3. **What about `/courses/:id/files/:id`?** Course ID remapping does not fix a file
   link, because the file is not in the target course. Detect-and-report is the only
   honest option without building media rehoming — which doc 03 already lists as a
   separate future concern.
4. **Which content types are in scope?** Each one is another API surface to read and
   write. Pages and assignments alone may cover most real cases.
5. **Is per-link approval usable at scale?** A course with 200 stale links makes
   link-by-link review unusable, but "approve all" discards the safety the preview
   exists to provide. This UX problem has no obvious answer.

---

## Dependencies

Builds on doc 21's page-reading and bulk-write plumbing. There is no reason to explore
this before the Pages Tool exists — and good reason not to.

---

## Relationship to Other Tools

```
Templates  ──→  deploys content INTO a course       (doc 03)
Pages Tool ──→  manages pages already IN a course   (doc 21)
Fix Links  ──→  repairs references BETWEEN courses  (this doc — idea only)
```

Doc 03's "Known Limitation — Course-Scoped Media" is the same underlying problem seen
from the deploy side. If this is ever built, that section should link here.
