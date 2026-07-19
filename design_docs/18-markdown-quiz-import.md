---

## Module Context

The Quiz Builder lives in the **Assignments Module**, alongside Bulk Edit,
Templates, Rubrics, and Duplicate. New Quizzes are assignments under the hood
(Canvas addresses them by assignment ID), and teachers think of quiz creation
in the same mental space as assignment creation. The component itself can live
in `src/modules/content/` (currently an empty placeholder folder) since it is
the first content-creation tool; the implementing session may co-locate it
with assignments instead if that proves cleaner.

# Canvas Power Tools — 18: Quiz Builder & Markdown Quiz Import

**Status: proposed — no implementation yet.**

---

## What It Does

Quiz Builder lets teachers create Canvas **New Quizzes** — the quiz shell,
its settings, and every question — directly from the extension, with two
equal entry points feeding one pipeline:

1. **Built-in question editor** — a form-based UI to add, edit, and reorder
   questions inside the extension. No file or markup knowledge required.
   This is the standalone product feature; it mirrors the TemplateEditor /
   RubricEditor pattern.
2. **Markdown import** — drag in (or paste) a plain-text "Quiz Markdown"
   file. Teachers who keep course material as text files, generate questions
   with external tools, or want quizzes under version control can author
   anywhere and deploy here.

Both entry points produce the same internal question list, which flows
through: **parse/validate → preview → deploy screen → PIN gate → progress →
link to the created quiz**.

Canvas has no way to bulk-author New Quiz questions. The historical
workaround — CSV → QTI XML → Classic Quiz import → "migrate to New Quizzes"
checkbox — is slow, opaque, and unreliable. This feature replaces it
entirely.

---

## Why This Supersedes the "QTI Import" Roadmap Item

The roadmap (doc 05) lists *QTI Import: convert a structured spreadsheet
into valid QTI XML and import it as a Canvas quiz.* That design predates the
public **New Quizzes REST API**, which writes quizzes and questions directly:

- `POST /api/quiz/v1/courses/:course_id/quizzes` — creates a native New Quiz
  with full settings (time limit, attempts, shuffle, result-view
  restrictions, calculator, access codes).
- `POST /api/quiz/v1/courses/:course_id/quizzes/:assignment_id/items` — adds
  one question per call.

No QTI generation, no Classic Quiz intermediary, no migration step. The QTI
Import roadmap item should be marked superseded by this doc.

Official docs (verified 2026-07-12):
- https://developerdocs.instructure.com/services/canvas/resources/new_quizzes
- https://developerdocs.instructure.com/services/canvas/resources/new_quiz_items

---

## Core Rule — Quizzes Are Created Unpublished

The create endpoint does not expose `published`, and we would not use it if
it did. Every quiz this tool creates lands **unpublished** in the course.
The teacher reviews it in Canvas and clicks Publish there. This is the same
philosophy as PreviewDiff: the tool never puts anything in front of students
without the teacher seeing exactly what it made. The success screen links
straight to the quiz so review is one click away.

---

## Quiz Markdown Format (v1)

The format is a product feature, owned and documented by Canvas Power Tools.
Any external tool or workflow can produce conforming files; the extension
depends only on this spec, never on where a file came from.

**Design goals:** easily writeable by hand; explicit question-type tags (zero
ambiguity, self-documenting files); forgiving parser; anything the file does
not specify is chosen on the deploy screen.

```markdown
# Quiz: Food Safety Basics

## MC: Which temperature range is the Danger Zone? (2 pts)
- 0–32°F
* 41–135°F
- 135–212°F
> incorrect: Review the Temperature Danger Zone reference sheet.

## MA: Which foods are TCS? (select all)
* Cooked rice
* Cut melons
- Dry flour

## TF (true): Chicken must reach 165°F internal temperature.

## Essay (4 pts): Explain how to prevent cross-contamination when prepping raw chicken.

## Match: Match each pathogen to its most common source.
Salmonella = raw poultry
E. coli = undercooked ground beef
distractor: cooked rice

## FIB: The minimum internal temperature for ground beef is {{155}}°F.
```

### Rules

| Element | Syntax |
| --- | --- |
| Quiz title | `# Quiz: <title>` (first H1; `Quiz:` prefix optional) |
| Question | `## <TAG>: <stem>` |
| Correct option | line starting `*` |
| Distractor option | line starting `-` |
| Points | `(N pts)` anywhere in the heading; default **1** |
| Feedback | `> correct: …`, `> incorrect: …`, bare `> …` = neutral |
| Matching pair | `left = right` (one per line) |
| Matching distractor | `distractor: <text>` |
| Fill-in-blank answer | `{{answer}}` inline in the stem |

### v1 tags → Canvas interaction type slugs

| Tag | Canvas slug | Notes |
| --- | --- | --- |
| `MC` | `choice` | exactly one `*` |
| `MA` | `multi-answer` | two or more `*` |
| `TF` | `true-false` | answer in heading: `TF (true):` / `TF (false):` |
| `Essay` | `essay` | no option lines |
| `Match` | `matching` | `=` pairs + optional distractors |
| `FIB` | `rich-fill-blank` | `{{…}}` blanks; ignore-case by default |

Phase 3 tags: `Num` → `numeric`, `Order` → `ordering`, `Cat` →
`categorization`; FIB spelling tolerance via the `TextCloseEnough` scoring
algorithm (Levenshtein edit distance). Out of scope for the API entirely:
stimulus items, item banks, and bank-draw entries (Canvas exposes these
read-only; they must be built in the Canvas UI).

### Parser forgiveness rules

- Tags are case-insensitive (`## mc:` works); whitespace is flexible.
- Question with option lines but no tag → assume `MC` if one `*`, `MA` if
  several. Tags override inference.
- Question with no options and no tag → error, not a silent essay
  (prevents a forgotten answer list from becoming an essay question).
- Every parse problem is a structured error `{ line, question, message }` —
  surfaced in the preview screen, never thrown away. A file with errors can
  still preview its valid questions but cannot deploy until errors are
  resolved or the offending questions are removed in the editor.

---

## Canvas API Reference

### Endpoints

| Action | Call |
| --- | --- |
| Create quiz | `POST /api/quiz/v1/courses/:course_id/quizzes` |
| Add question | `POST /api/quiz/v1/courses/:course_id/quizzes/:assignment_id/items` |
| Update quiz/settings | `PATCH /api/quiz/v1/courses/:course_id/quizzes/:assignment_id` |
| List / get / delete | standard GET/DELETE on the same paths |
| Hot-spot image upload | `GET .../items/media_upload_url` (future) |

Authentication is the user's normal bearer token via the existing request
wrapper. The create-quiz response includes the quiz `id` — this is the
**assignment ID** used in all item calls and in the quiz URL
(`/courses/:course_id/assignments/:assignment_id`).

### Item payload shape

Every item POST wraps the question in:

```
item: {
  entry_type: "Item",           // always
  points_possible: <number>,
  position: <1-based integer>,
  entry: {
    item_body: "<p>stem html</p>",
    interaction_type_slug: "<slug>",
    interaction_data: { ... },   // per-type; e.g. choices array for MC
    scoring_algorithm: "<name>", // per-type; e.g. Equivalence for MC/TF
    scoring_data: { value: ... },// per-type; e.g. correct choice UUID
    feedback: { correct, incorrect, neutral }  // each optional, rich text
  }
}
```

Two implementation-critical details:

1. **UUIDs.** Answer choices, matching pairs, and FIB blanks require
   client-generated v4 UUIDs (`crypto.randomUUID()`). The same UUID links an
   answer in `interaction_data` to its entry in `scoring_data`.
2. **Per-type shapes vary.** `interaction_data`, `properties`, and
   `scoring_data` differ per question type, and FIB supports per-blank
   scoring algorithms (`TextCloseEnough`, `TextContainsAnswer`,
   `TextInChoices`, `TextEquivalence`, `TextRegex`). The New Quiz Items
   doc's "Appendix: Question Types" has a complete JSON example per type —
   Phase 1's job is to verify each payload against a sandbox course before
   any UI exists.

---

## Architecture

Follows the established feature pattern (docs 06/07/10):

```
src/pages/quiz-builder/
├── index.html
└── index.jsx                     page entry, renders QuizBuilder in SetupGuard

src/modules/content/
├── QuizBuilder.jsx               state container: question list, entry points, views
├── QuestionEditor.jsx            form-based add/edit (built-in entry point)
├── MarkdownImport.jsx            drop zone + paste box (import entry point)
├── QuizPreview.jsx               rendered questions + validation errors
└── DeployQuiz.jsx                course/settings selection + PIN + progress

src/api/
└── newQuizzes.js                 createQuiz(), createQuizItem(), buildItemPayload()

src/utils/
└── markdownQuizParser.js         pure function: text → { title, questions[], errors[] }
                                  and serialize: questions[] → text (export)
```

**Reused infrastructure:** `request.js` wrapper (auth, rate-limit backoff,
typed errors), `SetupGuard`, `CourseSelector`, `Modal`, `Toast`,
`ProgressBar`, `usePinGate()` on deploy, `changeLogs.js` entry per created
quiz. Register the page in `src/config/tools.jsx` and
`vite.config.js` rollup inputs.

**Firm decisions:**
- `markdownQuizParser.js` is a pure function with zero Canvas coupling — the
  format is line-based, so no markdown library is needed. It must be unit
  testable in isolation.
- The internal question model is the single source of truth; markdown parse
  and form editor both produce it, `buildItemPayload()` consumes it, and the
  markdown **exporter** serializes it back. Export makes the format
  round-trip: build a quiz in the UI, save it as a `.md` file, keep it
  anywhere, re-import next semester.
- Deploy is sequential POSTs with the standard progress pattern. If an item
  POST fails mid-quiz, stop, report which questions landed, and leave the
  partial quiz unpublished for the teacher to inspect or delete — never
  retry blindly.

---

## UX Flow

1. Open Quiz Builder → choose "New quiz" (editor) or "Import markdown".
2. Question list view: add/edit/reorder/delete; imported questions are
   editable the same way; validation errors shown inline per question.
3. Preview: questions rendered approximately as Canvas will show them,
   with points, correct answers, and feedback visible.
4. Deploy screen: course (CourseSelector), assignment group, due/unlock/lock
   dates, shuffle, time limit, attempts. Anything the markdown specified is
   prefilled; the screen always wins.
5. PIN gate → create quiz → items with progress bar → change log entry.
6. Success: link to the unpublished quiz in Canvas + "Export as markdown".

---

## Phasing

1. **Phase 1 — pipeline proof (no UI).** `markdownQuizParser.js` +
   `newQuizzes.js`. Deploy a fixture quiz containing every v1 type to a
   sandbox course from a dev harness. Goal: verified payload shapes.
2. **Phase 2 — Quiz Builder page.** Both entry points, preview, deploy
   screen, PIN, progress, change log.
3. **Phase 3 — format completion.** Num/Order/Cat types, FIB tolerance,
   feedback editing in the form UI, quiz-settings overrides, markdown export.

---

## Verification

- Deploy every v1 question type to a sandbox course; confirm in the Canvas
  UI that stems, options, correct answers, points, and feedback render
  correctly.
- Take the quiz in Student View; confirm scoring (including MA partial
  credit behavior and FIB case-insensitivity).
- Confirm the quiz arrives unpublished and the change log recorded it.
- Round-trip test: build in UI → export markdown → re-import → identical
  question list.
