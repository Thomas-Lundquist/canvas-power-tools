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

export async function createQuizItem(courseId, assignmentId, question, position) {
  return canvasPost(
    `/api/quiz/v1/courses/${courseId}/quizzes/${assignmentId}/items`,
    { item: buildItemPayload(question, position) },
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
export function buildItemPayload(question, position) {
  return {
    entry_type: 'Item',
    points_possible: question.points,
    position,
    entry: {
      title: `Question ${position}`,
      item_body: buildStemHtml(question),
      calculator_type: 'none',
      feedback: buildFeedback(question.feedback),
      ...buildTypeEntry(question),
    },
  }
}

function buildTypeEntry(question) {
  switch (question.type) {
    case 'MC': return buildChoiceEntry(question, false)
    case 'MA': return buildChoiceEntry(question, true)
    case 'TF': return buildTrueFalseEntry(question)
    case 'ESSAY': return buildEssayEntry()
    case 'MATCH': return buildMatchingEntry(question)
    case 'FIB': return buildFibEntry(question)
    default: throw new Error(`Unsupported question type: ${question.type}`)
  }
}

function buildStemHtml(question) {
  // FIB embeds its blanks as backtick-wrapped text inside item_body — see
  // buildFibEntry, which builds its own item_body and overrides this one.
  return `<p>${escapeHtml(question.stem)}</p>`
}

function buildChoiceEntry(question, isMultiAnswer) {
  const choices = question.options.map((opt, i) => ({
    id: crypto.randomUUID(),
    position: i + 1,
    item_body: `<p>${escapeHtml(opt.text)}</p>`,
  }))
  const correctIds = question.options
    .map((opt, i) => (opt.correct ? choices[i].id : null))
    .filter(Boolean)

  return {
    interaction_type_slug: isMultiAnswer ? 'multi-answer' : 'choice',
    interaction_data: { choices },
    scoring_data: { value: isMultiAnswer ? correctIds : correctIds[0] },
    scoring_algorithm: isMultiAnswer ? 'AllOrNothing' : 'Equivalence',
  }
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

function buildMatchingEntry(question) {
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
    scoring_data: { value },
    scoring_algorithm: 'DeepEquals',
  }
}

// FIB is the one type whose item_body isn't the generic stem wrapper — each
// {{answer}} token becomes backtick-wrapped text per Instructure's rich-fill-
// blank format, cross-referenced by UUID into scoring_data.value[].id.
function buildFibEntry(question) {
  const blankIds = question.blanks.map(() => crypto.randomUUID())
  let bodyHtml = escapeHtml(question.stem)
  question.blanks.forEach(b => {
    bodyHtml = bodyHtml.replace(`{{${b.answer}}}`, `\`${escapeHtml(b.answer)}\``)
  })
  const itemBody = `<p>${bodyHtml}</p>`

  const blanks = question.blanks.map((b, i) => ({ id: blankIds[i], answer_type: 'openEntry' }))
  const scoringValue = question.blanks.map((b, i) => ({
    id: blankIds[i],
    scoring_data: { value: b.answer, blank_text: b.answer, ignore_case: true },
    scoring_algorithm: 'TextCloseEnough',
  }))

  return {
    interaction_type_slug: 'rich-fill-blank',
    item_body: itemBody,
    interaction_data: { blanks, word_bank_choices: [], reuse_word_bank_choices: false },
    scoring_data: { value: scoringValue, working_item_body: itemBody },
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
