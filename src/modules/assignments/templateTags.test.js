import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractTags,
  promptedTags,
  buildAutoValues,
  resolveTags,
  resolveTemplateFields,
  isAutoTag,
  AUTO_TAGS,
} from './templateTags.js'

test('extracts tags in first-appearance order and dedupes across sources', () => {
  const tags = extractTags(['Chapter {chapter} Quiz', '<p>Read {pages} for {chapter}.</p>'])
  assert.deepEqual(tags.map(t => t.name), ['chapter', 'pages'])
})

test('classifies registry tags as auto and everything else as prompted', () => {
  const tags = extractTags('{course_name} — Unit {unit}')
  assert.deepEqual(tags, [
    { name: 'course_name', auto: true },
    { name: 'unit', auto: false },
  ])
  assert.deepEqual(promptedTags('{course_name} — Unit {unit}'), ['unit'])
})

test('ignores brace runs that are not valid tag names', () => {
  // too short, uppercase, leading digit, spaces, and non-tag punctuation
  const tags = extractTags('for (let {i} = 0) {Unit} {1st} {two words} {a-b}')
  assert.deepEqual(tags, [])
})

test('doubled braces escape to a literal and are never treated as tags', () => {
  assert.deepEqual(extractTags('Use {{course_name}} to insert the course name'), [])
  assert.equal(
    resolveTags('Use {{course_name}} literally', { course_name: 'Culinary 1' }),
    'Use {course_name} literally',
  )
})

test('resolveTags leaves unknown and blank tags exactly as written', () => {
  assert.equal(resolveTags('Unit {unit} of {course_name}', { course_name: 'Culinary 1' }),
    'Unit {unit} of Culinary 1')
  assert.equal(resolveTags('Unit {unit}', { unit: undefined }), 'Unit {unit}')
})

test('resolveTags substitutes every occurrence of a repeated tag', () => {
  assert.equal(resolveTags('{unit} and {unit} again', { unit: '3' }), '3 and 3 again')
})

test('buildAutoValues resolves course, date, and teacher context', () => {
  const values = buildAutoValues({
    course: { name: 'Culinary 1', courseCode: 'CUL1-03', term: 'Fall 2026' },
    dueAt: '2026-10-03T23:59:00Z',
    today: new Date('2026-09-18T12:00:00Z'),
    teacherName: 'Mr. Lundquist',
  })
  assert.equal(values.course_name, 'Culinary 1')
  assert.equal(values.course_code, 'CUL1-03')
  assert.equal(values.course_term, 'Fall 2026')
  assert.equal(values.teacher_name, 'Mr. Lundquist')
  assert.match(values.due_date, /October 3, 2026/)
  assert.match(values.today, /September 18, 2026/)
})

test('missing context yields empty strings rather than "undefined" text', () => {
  const values = buildAutoValues({})
  // {today} always has a value — it needs no deploy context.
  for (const tag of AUTO_TAGS.filter(t => t.name !== 'today')) {
    assert.equal(values[tag.name], '', `${tag.name} should be empty`)
  }
  assert.ok(values.today.length > 0)
})

test('an unset due date leaves {due_date} empty, not "Invalid Date"', () => {
  const values = buildAutoValues({ dueAt: null })
  assert.equal(values.due_date, '')
})

test('resolveTemplateFields resolves name and description without mutating the template', () => {
  const fields = {
    name: '{course_name} — Unit {unit}',
    description: '<p>Due {due_date}. Read {pages}.</p>',
    points: 20,
  }
  const resolved = resolveTemplateFields(
    fields,
    { course: { name: 'Culinary 1' }, dueAt: '2026-10-03T23:59:00Z' },
    { unit: '3', pages: '112-140' },
  )
  assert.equal(resolved.name, 'Culinary 1 — Unit 3')
  assert.equal(resolved.description, '<p>Due October 3, 2026. Read 112-140.</p>')
  assert.equal(resolved.points, 20)
  assert.equal(fields.name, '{course_name} — Unit {unit}', 'source template untouched')
})

test('a blank prompted value leaves the tag visible instead of deleting content', () => {
  const resolved = resolveTemplateFields(
    { name: 'Unit {unit}', description: '' },
    {},
    { unit: '   ' },
  )
  assert.equal(resolved.name, 'Unit {unit}')
})

test('prompted values cannot override an auto tag with a stale literal', () => {
  // Auto tags win only when the prompted map omits them; an explicit prompted
  // value for an auto name is allowed (teacher override) and must apply.
  const resolved = resolveTemplateFields(
    { name: '{course_name}', description: '' },
    { course: { name: 'Culinary 1' } },
    { course_name: 'Culinary 2' },
  )
  assert.equal(resolved.name, 'Culinary 2')
})

test('isAutoTag agrees with the registry', () => {
  assert.ok(isAutoTag('course_name'))
  assert.ok(!isAutoTag('chapter'))
})
