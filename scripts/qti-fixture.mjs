// Dev harness: emit a QTI package for manual import testing against a Canvas
// sandbox. Not shipped. Run: node scripts/qti-fixture.mjs [path/to/quiz.csv]
//
// With no argument it uses a built-in fixture covering every v1 question type.
// With a CSV path it runs that file through the real csvQuizParser first.

import { writeFileSync, readFileSync } from 'node:fs'
import { parseCsvQuiz } from '../src/utils/csvQuizParser.js'
import { buildQtiPackage } from '../src/utils/qtiQuizExport.js'

const fb = { correct: null, incorrect: null }

const BUILT_IN = [
  { type: 'MC', points: 1, stem: 'The Temperature Danger Zone is:', options: [{ text: '0–32°F', correct: false }, { text: '41–135°F', correct: true }, { text: '135–212°F', correct: false }], feedback: { correct: 'Correct.', incorrect: 'Review the danger zone.' }, row: 1 },
  { type: 'MA', points: 2, stem: 'Which foods are TCS?', options: [{ text: 'Cooked rice', correct: true }, { text: 'Cut melons', correct: true }, { text: 'Dry flour', correct: false }], feedback: fb, row: 2 },
  { type: 'TF', points: 1, stem: 'Chicken must reach 165°F internal temperature.', boolAnswer: true, feedback: fb, row: 3 },
  { type: 'ESSAY', points: 4, stem: 'Explain how to prevent cross-contamination when prepping raw chicken.', feedback: fb, row: 4 },
  { type: 'MATCH', points: 3, stem: 'Match each pathogen to its most common source.', pairs: [{ left: 'Salmonella', right: 'raw poultry' }, { left: 'E. coli', right: 'undercooked ground beef' }], distractors: [{ text: 'cooked rice' }], feedback: fb, row: 5 },
  { type: 'FIB', points: 2, stem: 'TCS stands for {{Time}}/{{Temperature}} Control for Safety.', blanks: [{ answer: 'Time' }, { answer: 'Temperature' }], feedback: fb, row: 6 },
  { type: 'FIB', points: 1, stem: 'Hold hot foods at {{135}} degrees F or above.', blanks: [{ answer: '135' }], feedback: fb, row: 7 },
]

const csvPath = process.argv[2]
let questions = BUILT_IN
let title = 'QTI Fixture — every type'

if (csvPath) {
  const { questions: parsed, errors } = parseCsvQuiz(readFileSync(csvPath, 'utf8'))
  if (errors.length) {
    console.error(`${errors.length} parse error(s):`)
    for (const e of errors) console.error(`  row ${e.row}: ${e.message}`)
    process.exit(1)
  }
  questions = parsed
  title = csvPath.replace(/.*[/\\]/, '').replace(/\.[^.]+$/, '')
}

const { filename, bytes } = buildQtiPackage(questions, { title })
writeFileSync(filename, bytes)
console.log(`wrote ${filename} — ${questions.length} questions, ${bytes.length} bytes`)
