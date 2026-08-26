// Pure CSV -> quiz question model parser. Zero Canvas coupling, unit-testable
// in isolation. This is the CSV producer of the shared internal question
// model described in design_docs/18-markdown-quiz-import.md — a future
// in-extension question editor or Markdown importer would produce the same
// shape, so every downstream consumer (preview, deploy, API payload builder)
// stays agnostic to where the questions came from.
//
// Question model:
//   { type: 'MC'|'MA'|'TF'|'ESSAY'|'MATCH'|'FIB', points, stem, feedback: {correct, incorrect}, row,
//     options?: [{ text, correct }],       // MC/MA
//     boolAnswer?: boolean,                // TF
//     pairs?: [{ left, right }],           // MATCH
//     distractors?: [{ text }],            // MATCH
//     blanks?: [{ answer }] }              // FIB, in stem order

const MAX_OPTION_COLUMNS = 8
const OPTION_COLUMNS = Array.from({ length: MAX_OPTION_COLUMNS }, (_, i) => `option_${i + 1}`)
const VALID_TYPES = new Set(['MC', 'MA', 'TF', 'ESSAY', 'MATCH', 'FIB'])
const REQUIRED_COLUMNS = ['type', 'question']
const BLANK_PATTERN = /\{\{([^{}]+)\}\}/g

export function parseCsvQuiz(csvText) {
  const rawRows = tokenizeCsv(csvText).filter(r => r.cells.some(c => c.trim() !== ''))
  if (rawRows.length === 0) {
    return { questions: [], errors: [{ row: 1, message: 'CSV is empty.' }] }
  }

  const [headerRow, ...dataRows] = rawRows
  const headers = headerRow.cells.map(h => h.trim().toLowerCase())
  const missing = REQUIRED_COLUMNS.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    return {
      questions: [],
      errors: [{ row: headerRow.line, message: `Missing required column(s): ${missing.join(', ')}` }],
    }
  }

  const questions = []
  const errors = []
  for (const dataRow of dataRows) {
    const record = {}
    headers.forEach((h, i) => { record[h] = (dataRow.cells[i] ?? '').trim() })
    const { question, error } = parseRow(record, dataRow.line)
    if (error) errors.push({ row: dataRow.line, message: error })
    else questions.push(question)
  }

  return { questions, errors }
}

function parseRow(record, row) {
  const type = record.type.toUpperCase()
  if (!type) return { error: 'Missing question type.' }
  if (!VALID_TYPES.has(type)) return { error: `Unknown question type "${record.type}". Expected MC, MA, TF, Essay, Match, or FIB.` }

  const stem = record.question
  if (!stem) return { error: 'Missing question text.' }

  const pointsResult = parsePoints(record.points)
  if (pointsResult.error) return pointsResult
  const points = pointsResult.value

  const feedback = {
    correct: record.feedback_correct || null,
    incorrect: record.feedback_incorrect || null,
  }

  const optionCells = OPTION_COLUMNS.map(c => record[c] ?? '').filter(v => v.trim() !== '').map(v => v.trim())

  switch (type) {
    case 'MC':
    case 'MA':
      return parseChoiceRow(type, stem, points, optionCells, record.correct, feedback, row)
    case 'TF':
      return parseTrueFalseRow(stem, points, record.correct, feedback, row)
    case 'ESSAY':
      return { question: { type: 'ESSAY', points, stem, feedback, row } }
    case 'MATCH':
      return parseMatchRow(stem, points, optionCells, feedback, row)
    case 'FIB':
      return parseFibRow(stem, points, feedback, row)
    default:
      return { error: `Unknown question type "${record.type}".` }
  }
}

function parsePoints(raw) {
  if (!raw) return { value: 1 }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return { error: `Invalid points value "${raw}".` }
  return { value: n }
}

function parseChoiceRow(type, stem, points, optionCells, correctRaw, feedback, row) {
  if (optionCells.length < 2) return { error: `${type} needs at least 2 options (option_1, option_2, …).` }

  const correctIndexes = (correctRaw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)

  const outOfRange = correctIndexes.some(n => !Number.isInteger(n) || n < 1 || n > optionCells.length)
  if (correctIndexes.length === 0 || outOfRange) {
    return { error: `"correct" must reference valid option number(s) between 1 and ${optionCells.length}.` }
  }
  if (type === 'MC' && correctIndexes.length !== 1) {
    return { error: 'MC requires exactly one correct option in "correct".' }
  }
  if (type === 'MA' && correctIndexes.length < 2) {
    return { error: 'MA requires two or more correct options in "correct".' }
  }

  const options = optionCells.map((text, i) => ({ text, correct: correctIndexes.includes(i + 1) }))
  return { question: { type, points, stem, options, feedback, row } }
}

function parseTrueFalseRow(stem, points, correctRaw, feedback, row) {
  const v = (correctRaw || '').trim().toLowerCase()
  if (v !== 'true' && v !== 'false') return { error: '"correct" must be "true" or "false" for TF.' }
  return { question: { type: 'TF', points, stem, boolAnswer: v === 'true', feedback, row } }
}

function parseMatchRow(stem, points, optionCells, feedback, row) {
  const pairs = []
  const distractors = []
  for (const cell of optionCells) {
    const eqIndex = cell.indexOf('=')
    if (eqIndex === -1) {
      distractors.push({ text: cell })
      continue
    }
    const left = cell.slice(0, eqIndex).trim()
    const right = cell.slice(eqIndex + 1).trim()
    if (!left || !right) return { error: `Malformed matching pair "${cell}" — expected "left = right".` }
    pairs.push({ left, right })
  }
  if (pairs.length < 2) return { error: 'Match needs at least 2 pairs (e.g. "Salmonella = raw poultry").' }
  return { question: { type: 'MATCH', points, stem, pairs, distractors, feedback, row } }
}

function parseFibRow(stem, points, feedback, row) {
  const blanks = [...stem.matchAll(BLANK_PATTERN)].map(m => ({ answer: m[1].trim() }))
  if (blanks.length === 0) {
    return { error: 'FIB requires at least one {{answer}} blank in the question text.' }
  }
  if (blanks.some(b => !b.answer)) {
    return { error: 'FIB blank cannot be empty — use {{answer}}, not {{}}.' }
  }
  return { question: { type: 'FIB', points, stem, blanks, feedback, row } }
}

// RFC4180-aware tokenizer: quoted fields, embedded commas/newlines, "" escapes.
// Returns rows of { cells, line } — line is the 1-based source line the row started on.
function tokenizeCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let line = 1
  let rowStartLine = 1

  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); rows.push({ cells: row, line: rowStartLine }); row = []; rowStartLine = line }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
        continue
      }
      if (c === '\n') line++
      field += c
      continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === ',') { pushField(); continue }
    if (c === '\r') continue
    if (c === '\n') { line++; pushRow(); continue }
    field += c
  }
  if (field !== '' || row.length > 0) pushRow()

  return rows
}
