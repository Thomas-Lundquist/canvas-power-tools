import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQtiPackage, QTI_TYPE_SUPPORT } from './qtiQuizExport.js'

// buildQtiPackage returns { filename, bytes } but the XML is what matters. Pull
// the assessment XML back out of the zip by scanning for the stored entry — the
// archive is uncompressed so the bytes are the literal UTF-8 document.
function assessmentXml(pkg) {
  const text = Buffer.from(pkg.bytes).toString('utf8')
  const start = text.indexOf('<questestinterop')
  const end = text.indexOf('</questestinterop>') + '</questestinterop>'.length
  assert.ok(start > -1 && end > start, 'assessment XML present in package')
  return text.slice(start, end)
}

const fb = { correct: null, incorrect: null }

const ONE_OF_EACH = [
  { type: 'MC', points: 1, stem: 'Capital of France?', options: [{ text: 'Paris', correct: true }, { text: 'Lyon', correct: false }], feedback: fb, row: 1 },
  { type: 'MA', points: 2, stem: 'Primary colors?', options: [{ text: 'Red', correct: true }, { text: 'Green', correct: false }, { text: 'Blue', correct: true }], feedback: fb, row: 2 },
  { type: 'TF', points: 1, stem: 'Sky is blue.', boolAnswer: true, feedback: fb, row: 3 },
  { type: 'ESSAY', points: 4, stem: 'Explain photosynthesis.', feedback: fb, row: 4 },
  { type: 'MATCH', points: 3, stem: 'Match.', pairs: [{ left: 'Dog', right: 'Bark' }, { left: 'Cat', right: 'Meow' }], distractors: [{ text: 'Moo' }], feedback: fb, row: 5 },
  { type: 'FIB', points: 2, stem: 'Water is {{H2O}} and salt is {{NaCl}}.', blanks: [{ answer: 'H2O' }, { answer: 'NaCl' }], feedback: fb, row: 6 },
]

test('package has a zip signature and a .zip filename', () => {
  const pkg = buildQtiPackage(ONE_OF_EACH, { title: 'Science 1' })
  assert.match(pkg.filename, /\.zip$/)
  assert.equal(pkg.bytes[0], 0x50) // 'P'
  assert.equal(pkg.bytes[1], 0x4b) // 'K'
})

test('every question emits an <item> with the right question_type', () => {
  const xml = assessmentXml(buildQtiPackage(ONE_OF_EACH, { title: 'Q' }))
  for (const qt of ['multiple_choice_question', 'multiple_answers_question', 'true_false_question', 'essay_question', 'matching_question', 'fill_in_multiple_blanks_question']) {
    assert.ok(xml.includes(`<fieldentry>${qt}</fieldentry>`), `missing ${qt}`)
  }
  assert.equal((xml.match(/<item ident=/g) || []).length, 6)
})

test('MC scores the correct label and only that one', () => {
  const xml = assessmentXml(buildQtiPackage([ONE_OF_EACH[0]], { title: 'Q' }))
  assert.match(xml, /<varequal respident="q1_r">q1_a1<\/varequal>/)
  assert.doesNotMatch(xml, /<varequal respident="q1_r">q1_a2<\/varequal>/)
})

test('MA requires every correct and negates every incorrect', () => {
  const xml = assessmentXml(buildQtiPackage([ONE_OF_EACH[1]], { title: 'Q' }))
  assert.match(xml, /<and>/)
  assert.match(xml, /<varequal respident="q1_r">q1_a1<\/varequal>/)
  assert.match(xml, /<not><varequal respident="q1_r">q1_a2<\/varequal><\/not>/)
  assert.match(xml, /<varequal respident="q1_r">q1_a3<\/varequal>/)
})

test('TF renders two synthesized choices, True correct', () => {
  const xml = assessmentXml(buildQtiPackage([ONE_OF_EACH[2]], { title: 'Q' }))
  assert.match(xml, /True<\/mattext>/)
  assert.match(xml, /False<\/mattext>/)
  assert.match(xml, /<varequal respident="q1_r">q1_a1<\/varequal>/) // a1 = True
})

test('essay has no auto scoring (conditionvar is <other/>)', () => {
  const xml = assessmentXml(buildQtiPackage([ONE_OF_EACH[3]], { title: 'Q' }))
  assert.match(xml, /<response_str ident="q1_r"/)
  assert.match(xml, /<conditionvar><other\/><\/conditionvar>/)
  assert.doesNotMatch(xml, /setvar/)
})

test('matching: one response_lid per pair, distractor present but never scored', () => {
  const xml = assessmentXml(buildQtiPackage([ONE_OF_EACH[4]], { title: 'Q' }))
  assert.equal((xml.match(/<response_lid ident="q1_p\d+"/g) || []).length, 2)
  assert.match(xml, />Moo<\/mattext>/) // distractor rendered
  assert.doesNotMatch(xml, /<varequal respident="q1_p\d+">q1_d1<\/varequal>/) // never correct
  assert.match(xml, /<setvar action="Add" varname="SCORE">50<\/setvar>/)
})

test('multi-blank FIB: {{token}} → [blankN], response_lid ident is response_blankN', () => {
  const xml = assessmentXml(buildQtiPackage([ONE_OF_EACH[5]], { title: 'Q' }))
  assert.match(xml, /fill_in_multiple_blanks_question/)
  assert.match(xml, /\[blank1\]/)
  assert.match(xml, /\[blank2\]/)
  assert.doesNotMatch(xml, /\{\{/)
  assert.match(xml, /<response_lid ident="response_blank1"/)
  assert.match(xml, /<response_lid ident="response_blank2"/)
  assert.match(xml, /<varequal respident="response_blank1">/)
})

test('single-blank FIB becomes short_answer_question matched by literal text', () => {
  const q = { type: 'FIB', points: 1, stem: 'Hot holding is {{135}} degrees.', blanks: [{ answer: '135' }], feedback: fb, row: 1 }
  const xml = assessmentXml(buildQtiPackage([q], { title: 'Q' }))
  assert.match(xml, /<fieldentry>short_answer_question<\/fieldentry>/)
  assert.doesNotMatch(xml, /fill_in_multiple_blanks_question/)
  assert.match(xml, /<response_str ident="response1"/)
  assert.match(xml, /<varequal respident="response1">135<\/varequal>/)
  assert.doesNotMatch(xml, /\{\{|\[blank/)
})

test('stem HTML and special chars are XML-escaped', () => {
  const q = { type: 'MC', points: 1, stem: 'Is 3 < 5 & "true"?', options: [{ text: 'a<b', correct: true }, { text: 'x', correct: false }], feedback: fb, row: 1 }
  const xml = assessmentXml(buildQtiPackage([q], { title: 'Q' }))
  assert.doesNotMatch(xml, /Is 3 < 5/) // raw < must not survive
  assert.match(xml, /Is 3 &lt; 5 &amp; &quot;true&quot;/)
})

test('feedback becomes itemfeedback blocks referenced from respconditions', () => {
  const q = { type: 'MC', points: 1, stem: 'q', options: [{ text: 'a', correct: true }, { text: 'b', correct: false }], feedback: { correct: 'Nice', incorrect: 'Study more' }, row: 1 }
  const xml = assessmentXml(buildQtiPackage([q], { title: 'Q' }))
  assert.match(xml, /<itemfeedback ident="correct_fb">/)
  assert.match(xml, /<itemfeedback ident="general_incorrect_fb">/)
  assert.match(xml, /<displayfeedback feedbacktype="Response" linkrefid="correct_fb"\/>/)
})

test('QTI_TYPE_SUPPORT flags MATCH and FIB for review', () => {
  assert.equal(QTI_TYPE_SUPPORT.MC, 'full')
  assert.equal(QTI_TYPE_SUPPORT.MATCH, 'review')
  assert.equal(QTI_TYPE_SUPPORT.FIB, 'review')
})
