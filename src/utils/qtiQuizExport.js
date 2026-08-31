// Pure QTI 1.2 exporter. Turns the internal question model (see csvQuizParser.js)
// into a Common Cartridge-flavored QTI 1.2 package (.zip) that Canvas's
// New Quizzes "Item Banks → Import" accepts. Zero Canvas coupling, zero network
// — the teacher imports the file by hand. Depends only on zipStore.js.
//
// Canvas publishes no spec for this importer; the mapping is modeled on Canvas's
// own Classic-Quiz QTI export. MATCH and FIB are the least reliable round-trips
// (partial-credit scoring, blank references) — QTI_TYPE_SUPPORT flags them so the
// UI can tell the teacher to check the answer key after import.

import { createZip } from './zipStore.js'

export const QTI_TYPE_SUPPORT = {
  MC: 'full',
  MA: 'full',
  TF: 'full',
  ESSAY: 'full',
  MATCH: 'review',
  FIB: 'review',
}

const QTI_QUESTION_TYPE = {
  MC: 'multiple_choice_question',
  MA: 'multiple_answers_question',
  TF: 'true_false_question',
  ESSAY: 'essay_question',
  MATCH: 'matching_question',
  FIB: 'fill_in_multiple_blanks_question',
}

// questions[] + title → { filename, bytes: Uint8Array }
export function buildQtiPackage(questions, { title = 'Quiz' } = {}) {
  const assessmentId = `assessment_${randomToken()}`
  const assessmentXml = buildAssessmentXml(assessmentId, title, questions)
  const manifestXml = buildManifestXml(assessmentId)

  const bytes = createZip([
    { name: 'imsmanifest.xml', data: manifestXml },
    { name: `${assessmentId}/${assessmentId}.xml`, data: assessmentXml },
  ])

  return { filename: `${slugify(title)}-qti.zip`, bytes }
}

// ── package documents ────────────────────────────────────────────────────────

function buildManifestXml(assessmentId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="manifest_${randomToken()}" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd">
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.1.3</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="${assessmentId}" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment" href="${assessmentId}/${assessmentId}.xml">
      <file href="${assessmentId}/${assessmentId}.xml"/>
    </resource>
  </resources>
</manifest>
`
}

function buildAssessmentXml(assessmentId, title, questions) {
  const items = questions.map((q, i) => buildItemXml(q, i + 1)).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${assessmentId}" title="${escapeXml(title)}">
    <qtimetadata>
      <qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>
`
}

// ── item ─────────────────────────────────────────────────────────────────────

function buildItemXml(question, position) {
  const ident = `q${position}`
  const type = buildTypeXml(question, ident)
  const meta = [
    field('question_type', type.questionType || QTI_QUESTION_TYPE[question.type]),
    field('points_possible', String(question.points)),
    ...(type.extraMeta || []),
  ].join('\n')

  return `      <item ident="${ident}" title="${escapeXml(`Question ${position}`)}">
        <itemmetadata>
          <qtimetadata>
${indent(meta, 12)}
          </qtimetadata>
        </itemmetadata>
        <presentation>
${indent(type.presentation, 10)}
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
${indent(type.resprocessing, 10)}
        </resprocessing>
${itemFeedbackXml(question.feedback)}      </item>`
}

function buildTypeXml(question, ident) {
  switch (question.type) {
    case 'MC': return choiceXml(question, ident, false)
    case 'MA': return choiceXml(question, ident, true)
    case 'TF': return trueFalseXml(question, ident)
    case 'ESSAY': return essayXml(question, ident)
    case 'MATCH': return matchingXml(question, ident)
    case 'FIB': return fibXml(question, ident)
    default: throw new Error(`Unsupported question type: ${question.type}`)
  }
}

// ── per-type ─────────────────────────────────────────────────────────────────

function choiceXml(question, ident, isMultiAnswer) {
  const resp = `${ident}_r`
  const labels = question.options.map((opt, i) => ({
    id: `${ident}_a${i + 1}`,
    correct: opt.correct,
    text: opt.text,
  }))

  const presentation = [
    htmlMaterial(question.stem),
    `<response_lid ident="${resp}" rcardinality="${isMultiAnswer ? 'Multiple' : 'Single'}">`,
    `  <render_choice>`,
    ...labels.map(l =>
      `    <response_label ident="${l.id}">${plainMaterial(l.text)}</response_label>`),
    `  </render_choice>`,
    `</response_lid>`,
  ].join('\n')

  let conditionVar
  if (isMultiAnswer) {
    const clauses = labels.map(l =>
      l.correct
        ? `  <varequal respident="${resp}">${l.id}</varequal>`
        : `  <not><varequal respident="${resp}">${l.id}</varequal></not>`)
    conditionVar = ['<and>', ...clauses, '</and>'].join('\n')
  } else {
    const correct = labels.find(l => l.correct)
    conditionVar = `<varequal respident="${resp}">${correct.id}</varequal>`
  }

  const resprocessing = [
    `<respcondition continue="No">`,
    `  <conditionvar>`,
    indent(conditionVar, 4),
    `  </conditionvar>`,
    `  <setvar action="Set" varname="SCORE">100</setvar>`,
    displayFeedback(question.feedback, 'correct'),
    `</respcondition>`,
    incorrectRespcondition(question.feedback),
  ].filter(Boolean).join('\n')

  return {
    presentation,
    resprocessing,
    extraMeta: [field('original_answer_ids', labels.map(l => l.id).join(','))],
  }
}

function trueFalseXml(question, ident) {
  const synthetic = {
    stem: question.stem,
    options: [
      { text: 'True', correct: question.boolAnswer === true },
      { text: 'False', correct: question.boolAnswer === false },
    ],
    feedback: question.feedback,
  }
  return choiceXml(synthetic, ident, false)
}

function essayXml(question, ident) {
  const resp = `${ident}_r`
  const presentation = [
    htmlMaterial(question.stem),
    `<response_str ident="${resp}" rcardinality="Single">`,
    `  <render_fib><response_label ident="${ident}_a1" rshuffle="No"/></render_fib>`,
    `</response_str>`,
  ].join('\n')
  const resprocessing = [
    `<respcondition continue="No">`,
    `  <conditionvar><other/></conditionvar>`,
    `</respcondition>`,
  ].join('\n')
  return { presentation, resprocessing }
}

function matchingXml(question, ident) {
  const answers = [
    ...question.pairs.map((p, i) => ({ id: `${ident}_m${i + 1}`, text: p.right })),
    ...question.distractors.map((d, i) => ({ id: `${ident}_d${i + 1}`, text: d.text })),
  ]
  const share = round2(100 / question.pairs.length)

  const prompts = question.pairs.map((pair, i) => {
    const resp = `${ident}_p${i + 1}`
    const block = [
      `<response_lid ident="${resp}" rcardinality="Single">`,
      indent(plainMaterial(pair.left), 2),
      `  <render_choice>`,
      ...answers.map(a =>
        `    <response_label ident="${a.id}">${plainMaterial(a.text)}</response_label>`),
      `  </render_choice>`,
      `</response_lid>`,
    ].join('\n')
    const correct = answers.find(a => a.text === pair.right)
    const condition = [
      `<respcondition continue="No">`,
      `  <conditionvar><varequal respident="${resp}">${correct.id}</varequal></conditionvar>`,
      `  <setvar action="Add" varname="SCORE">${share}</setvar>`,
      `</respcondition>`,
    ].join('\n')
    return { block, condition }
  })

  const presentation = [
    htmlMaterial(question.stem),
    ...prompts.map(p => p.block),
  ].join('\n')
  const resprocessing = prompts.map(p => p.condition).join('\n')

  return {
    presentation,
    resprocessing,
    extraMeta: question.distractors.length
      ? [field('matching_answer_incorrect_matches', question.distractors.map(d => d.text).join('\n'))]
      : [],
  }
}

// One blank → short_answer_question (Canvas "Fill in the Blank"): the most
// reliable importer path — the stem carries no bracket ref and the answer is
// matched by literal text. Two or more → fill_in_multiple_blanks_question, where
// each {{answer}} becomes a [blankN] ref that must resolve to a response_lid
// whose ident is exactly `response_blankN`.
function fibXml(question, ident) {
  if (question.blanks.length === 1) return shortAnswerXml(question, ident)

  const blanks = question.blanks.map((b, i) => ({
    name: `blank${i + 1}`,
    resp: `response_blank${i + 1}`,
    answerId: `${ident}_b${i + 1}_a1`,
    answer: b.answer,
  }))

  // Rewrite each {{answer}} token to a [blankN] reference, in stem order.
  let stem = question.stem
  blanks.forEach(b => { stem = stem.replace(`{{${b.answer}}}`, `[${b.name}]`) })
  const share = round2(100 / blanks.length)

  const presentation = [
    htmlMaterial(stem),
    ...blanks.map(b => [
      `<response_lid ident="${b.resp}" rcardinality="Single">`,
      indent(plainMaterial(b.name), 2),
      `  <render_choice>`,
      `    <response_label ident="${b.answerId}">${plainMaterial(b.answer)}</response_label>`,
      `  </render_choice>`,
      `</response_lid>`,
    ].join('\n')),
  ].join('\n')

  const resprocessing = blanks.map(b => [
    `<respcondition continue="No">`,
    `  <conditionvar><varequal respident="${b.resp}">${b.answerId}</varequal></conditionvar>`,
    `  <setvar action="Add" varname="SCORE">${share}</setvar>`,
    `</respcondition>`,
  ].join('\n')).join('\n')

  return { presentation, resprocessing }
}

function shortAnswerXml(question, ident) {
  const resp = 'response1'
  const answer = question.blanks[0].answer
  // Drop the {{answer}} token from the stem — short answer shows a single input.
  const stem = question.stem.replace(`{{${answer}}}`, '_____')

  const presentation = [
    htmlMaterial(stem),
    `<response_str ident="${resp}" rcardinality="Single">`,
    `  <render_fib><response_label ident="${ident}_a1" rshuffle="No"/></render_fib>`,
    `</response_str>`,
  ].join('\n')

  const resprocessing = [
    `<respcondition continue="No">`,
    `  <conditionvar><varequal respident="${resp}">${escapeXml(answer)}</varequal></conditionvar>`,
    `  <setvar action="Set" varname="SCORE">100</setvar>`,
    `</respcondition>`,
  ].join('\n')

  return { presentation, resprocessing, questionType: 'short_answer_question' }
}

// ── feedback ─────────────────────────────────────────────────────────────────

function itemFeedbackXml(feedback) {
  if (!feedback) return ''
  const blocks = []
  if (feedback.correct) blocks.push(feedbackBlock('correct_fb', feedback.correct))
  if (feedback.incorrect) blocks.push(feedbackBlock('general_incorrect_fb', feedback.incorrect))
  return blocks.length ? `${indent(blocks.join('\n'), 8)}\n` : ''
}

function feedbackBlock(id, html) {
  return `<itemfeedback ident="${id}">
  <flow_mat><material>${htmlMattext(html)}</material></flow_mat>
</itemfeedback>`
}

function displayFeedback(feedback, kind) {
  const id = kind === 'correct' ? 'correct_fb' : 'general_incorrect_fb'
  const value = kind === 'correct' ? feedback?.correct : feedback?.incorrect
  return value ? `  <displayfeedback feedbacktype="Response" linkrefid="${id}"/>` : ''
}

function incorrectRespcondition(feedback) {
  if (!feedback?.incorrect) return ''
  return [
    `<respcondition continue="Yes">`,
    `  <conditionvar><other/></conditionvar>`,
    `  <displayfeedback feedbacktype="Response" linkrefid="general_incorrect_fb"/>`,
    `</respcondition>`,
  ].join('\n')
}

// ── xml helpers ──────────────────────────────────────────────────────────────

function field(label, entry) {
  return `<qtimetadatafield><fieldlabel>${label}</fieldlabel><fieldentry>${escapeXml(entry)}</fieldentry></qtimetadatafield>`
}

function htmlMaterial(html) {
  return `<material>${htmlMattext(html)}</material>`
}

function htmlMattext(html) {
  return `<mattext texttype="text/html">${escapeXml(`<p>${html}</p>`)}</mattext>`
}

function plainMaterial(text) {
  return `<material><mattext texttype="text/plain">${escapeXml(text)}</mattext></material>`
}

function escapeXml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text.split('\n').map(line => (line ? pad + line : line)).join('\n')
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function slugify(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'quiz'
}

function randomToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
