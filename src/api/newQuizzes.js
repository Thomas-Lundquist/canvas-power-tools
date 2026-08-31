// New Quizzes REST API (Instructure's /api/quiz/v1 surface — not Classic
// Quizzes). Field shapes verified against
// https://developerdocs.instructure.com/services/canvas/resources/new_quizzes
// and .../new_quiz_items (2026-08-26). The docs' examples are form-encoded
// (quiz[title]=...); this module sends the equivalent nested JSON body, same
// convention already used for Classic Assignments in assignments.js — Canvas's
// Rails-style params parsing accepts both. Reverify against a sandbox course
// before shipping, per design_docs/18-markdown-quiz-import.md Phase 1.
import { canvasPost } from './request.js'

const SECONDS_PER_MINUTE = 60

export async function createQuiz(courseId, settings) {
  const raw = await canvasPost(`/api/quiz/v1/courses/${courseId}/quizzes`, buildQuizPayload(settings))
  return mapQuiz(raw)
}

export async function createQuizItem(courseId, assignmentId, question, position, options = {}) {
  return canvasPost(
    `/api/quiz/v1/courses/${courseId}/quizzes/${assignmentId}/items`,
    { item: buildItemPayload(question, position, options) },
  )
}

function mapQuiz(raw) {
  return {
    id: String(raw.id),
    title: raw.title,
    pointsPossible: raw.points_possible ?? null,
  }
}

function buildQuizPayload(settings) {
  const quiz = { title: settings.title }
  if (settings.assignmentGroupId) quiz.assignment_group_id = settings.assignmentGroupId
  if (settings.dueAt) quiz.due_at = settings.dueAt
  if (settings.unlockAt) quiz.unlock_at = settings.unlockAt
  if (settings.lockAt) quiz.lock_at = settings.lockAt

  const quizSettings = {}
  if (settings.shuffleQuestions != null) quizSettings.shuffle_questions = settings.shuffleQuestions
  if (settings.shuffleAnswers != null) quizSettings.shuffle_answers = settings.shuffleAnswers
  if (settings.timeLimitMinutes != null) {
    quizSettings.has_time_limit = true
    quizSettings.session_time_limit_in_seconds = settings.timeLimitMinutes * SECONDS_PER_MINUTE
  }
  if (settings.allowedAttempts != null && settings.allowedAttempts > 1) {
    quizSettings.multiple_attempts = {
      multiple_attempts_enabled: true,
      attempt_limit: true,
      max_attempts: settings.allowedAttempts,
    }
  }
  if (Object.keys(quizSettings).length > 0) quiz.quiz_settings = quizSettings

  // No `published` field exists on this endpoint — every quiz this tool
  // creates lands unpublished by construction. See doc 18, "Core Rule."
  return { quiz }
}

// entry_type/points_possible/position wrap every item; `entry` varies per type.
// options.shuffleAnswers flips the per-question shuffle_rules for MC/MA/matching.
export function buildItemPayload(question, position, { shuffleAnswers = false } = {}) {
  return {
    entry_type: 'Item',
    points_possible: question.points,
    position,
    entry: {
      title: `Question ${position}`,
      item_body: buildStemHtml(question),
      calculator_type: 'none',
      feedback: buildFeedback(question.feedback),
      ...buildTypeEntry(question, shuffleAnswers),
    },
  }
}

function buildTypeEntry(question, shuffleAnswers) {
  switch (question.type) {
    case 'MC': return buildChoiceEntry(question, false, shuffleAnswers)
    case 'MA': return buildChoiceEntry(question, true, shuffleAnswers)
    case 'TF': return buildTrueFalseEntry(question)
    case 'ESSAY': return buildEssayEntry()
    case 'MATCH': return buildMatchingEntry(question, shuffleAnswers)
    case 'FIB': return buildFibEntry(question)
    default: throw new Error(`Unsupported question type: ${question.type}`)
  }
}

function buildStemHtml(question) {
  // FIB overrides this with its own item_body (blanks as <span> placeholders) —
  // see buildFibEntry.
  return `<p>${escapeHtml(question.stem)}</p>`
}

function buildChoiceEntry(question, isMultiAnswer, shuffleAnswers) {
  const choices = question.options.map((opt, i) => ({
    id: crypto.randomUUID(),
    position: i + 1,
    item_body: `<p>${escapeHtml(opt.text)}</p>`,
  }))
  const correctIds = question.options
    .map((opt, i) => (opt.correct ? choices[i].id : null))
    .filter(Boolean)

  const entry = {
    interaction_type_slug: isMultiAnswer ? 'multi-answer' : 'choice',
    interaction_data: { choices },
    scoring_data: { value: isMultiAnswer ? correctIds : correctIds[0] },
    scoring_algorithm: isMultiAnswer ? 'AllOrNothing' : 'Equivalence',
  }
  if (shuffleAnswers) entry.properties = { shuffle_rules: { choices: { shuffled: true } } }
  return entry
}

function buildTrueFalseEntry(question) {
  return {
    interaction_type_slug: 'true-false',
    interaction_data: { true_choice: 'True', false_choice: 'False' },
    scoring_data: { value: question.boolAnswer },
    scoring_algorithm: 'Equivalence',
  }
}

function buildEssayEntry() {
  return {
    interaction_type_slug: 'essay',
    interaction_data: {
      rce: true,
      word_count: false,
      file_upload: false,
      spell_check: true,
      word_limit_enabled: false,
    },
    scoring_data: { value: '' },
    scoring_algorithm: 'None',
  }
}

// Shape verified against a live New Quizzes matching item (2026-08):
// interaction_data.answers is a flat string list of every right-side value plus
// distractors; scoring_data.value maps each left prompt's id to its correct
// answer string; scoring_data.edit_data mirrors that for the authoring UI.
// PartialDeep (not DeepEquals) is what the UI writes — it awards partial credit.
function buildMatchingEntry(question, shuffleAnswers) {
  const questions = question.pairs.map(pair => ({ id: crypto.randomUUID(), item_body: pair.left }))
  const answers = [
    ...question.pairs.map(p => p.right),
    ...question.distractors.map(d => d.text),
  ]
  const value = {}
  question.pairs.forEach((pair, i) => { value[questions[i].id] = pair.right })

  return {
    interaction_type_slug: 'matching',
    interaction_data: { questions, answers },
    properties: { shuffle_rules: { questions: { shuffled: !!shuffleAnswers } } },
    scoring_data: {
      value,
      edit_data: {
        matches: question.pairs.map((pair, i) => ({
          answer_body: pair.right,
          question_id: questions[i].id,
          question_body: pair.left,
        })),
        distractors: question.distractors.map(d => d.text),
      },
    },
    scoring_algorithm: 'PartialDeep',
  }
}

// FIB is the one type whose item_body isn't the generic stem wrapper. Shape
// verified against a live New Quizzes item (Instructure quiz-lti, 2026-08):
// every {{answer}} token becomes an empty <span id="blank_<uuid>"> in item_body,
// while scoring_data.working_item_body carries the same sentence with the
// answers backtick-wrapped. The bare uuid (no blank_ prefix) is the cross-
// reference into interaction_data.blanks[] and scoring_data.value[].
function buildFibEntry(question) {
  const blankIds = question.blanks.map(() => crypto.randomUUID())

  let bodyHtml = escapeHtml(question.stem)
  let workingHtml = escapeHtml(question.stem)
  question.blanks.forEach((b, i) => {
    const token = `{{${b.answer}}}`
    bodyHtml = bodyHtml.replace(token, `<span id="blank_${blankIds[i]}"></span>`)
    workingHtml = workingHtml.replace(token, `\`${escapeHtml(b.answer)}\``)
  })

  const blanks = question.blanks.map((b, i) => ({ id: blankIds[i], answer_type: 'openEntry' }))
  const scoringValue = question.blanks.map((b, i) => ({
    id: blankIds[i],
    scoring_data: { value: b.answer, blank_text: b.answer },
    scoring_algorithm: 'TextEquivalence',
  }))

  return {
    interaction_type_slug: 'rich-fill-blank',
    item_body: `<p>${bodyHtml}</p>`,
    interaction_data: { blanks },
    properties: { shuffle_rules: { blanks: {} } },
    scoring_data: {
      value: scoringValue,
      case_sensitive: false,
      working_item_body: `<p>${workingHtml}</p>`,
    },
    scoring_algorithm: 'MultipleMethods',
  }
}

function buildFeedback(feedback) {
  if (!feedback) return undefined
  const out = {}
  if (feedback.correct) out.correct = `<p>${escapeHtml(feedback.correct)}</p>`
  if (feedback.incorrect) out.incorrect = `<p>${escapeHtml(feedback.incorrect)}</p>`
  return Object.keys(out).length > 0 ? out : undefined
}

function escapeHtml(str) {
  return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
