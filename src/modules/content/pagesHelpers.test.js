import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPageChanges,
  groupChangesByPage,
  applyPageFilters,
  publishedParamFromFilters,
  countActiveFields,
  formatEditingRoles,
  editingRolesKey,
  sortRoles,
} from './pagesHelpers.js'

function page(overrides = {}) {
  return {
    url: 'syllabus',
    title: 'Syllabus',
    published: false,
    editingRoles: ['teachers'],
    editor: 'rce',
    frontPage: false,
    updatedAt: '2026-01-05T12:00:00Z',
    ...overrides,
  }
}

const NO_ACTIONS = { status: null, editingRoles: '' }

// ── editing roles normalisation ──────────────────────────────────────────────

test('sortRoles uses the canonical ladder order, not alphabetical', () => {
  assert.deepEqual(sortRoles(['students', 'teachers']), ['teachers', 'students'])
  assert.deepEqual(sortRoles(['public', 'members', 'teachers']), ['teachers', 'members', 'public'])
})

test('sortRoles removes duplicates', () => {
  assert.deepEqual(sortRoles(['teachers', 'teachers', 'students']), ['teachers', 'students'])
})

test('editingRolesKey is stable regardless of input order', () => {
  assert.equal(editingRolesKey(['students', 'teachers']), editingRolesKey(['teachers', 'students']))
})

test('formatEditingRoles labels the known presets', () => {
  assert.equal(formatEditingRoles(['teachers']), 'Teachers only')
  assert.equal(formatEditingRoles(['students', 'teachers']), 'Teachers and students')
})

test('formatEditingRoles falls back to a joined list for non-preset sets', () => {
  // Canvas allows role sets this tool never writes — a page edited elsewhere.
  assert.equal(formatEditingRoles(['students', 'members']), 'Students, Members')
})

// ── change building ──────────────────────────────────────────────────────────

test('buildPageChanges produces no rows when no action is set', () => {
  assert.deepEqual(buildPageChanges([page()], NO_ACTIONS), [])
})

test('buildPageChanges skips pages that already hold the target value', () => {
  const pages = [page({ url: 'a', published: true }), page({ url: 'b', published: false })]
  const changes = buildPageChanges(pages, { ...NO_ACTIONS, status: 'publish' })
  assert.equal(changes.length, 1)
  assert.equal(changes[0].pageUrl, 'b')
  assert.equal(changes[0].previousValue, false)
  assert.equal(changes[0].newValue, true)
})

test('buildPageChanges emits an unpublish row only for published pages', () => {
  const pages = [page({ url: 'a', published: true }), page({ url: 'b', published: false })]
  const changes = buildPageChanges(pages, { ...NO_ACTIONS, status: 'unpublish' })
  assert.deepEqual(changes.map(c => c.pageUrl), ['a'])
  assert.equal(changes[0].newValue, false)
})

test('buildPageChanges compares editing roles by canonical key, not array identity', () => {
  const pages = [page({ url: 'a', editingRoles: ['students', 'teachers'] })]
  const changes = buildPageChanges(pages, { ...NO_ACTIONS, editingRoles: 'teachers,students' })
  assert.deepEqual(changes, [])
})

test('buildPageChanges emits an editing-roles row when the set differs', () => {
  const pages = [page({ url: 'a', editingRoles: ['teachers'] })]
  const changes = buildPageChanges(pages, { ...NO_ACTIONS, editingRoles: 'teachers,students' })
  assert.equal(changes.length, 1)
  assert.equal(changes[0].field, 'editingRoles')
  assert.deepEqual(changes[0].newValue, ['teachers', 'students'])
})

test('buildPageChanges emits both fields for one page', () => {
  const pages = [page({ url: 'a', published: false, editingRoles: ['teachers'] })]
  const changes = buildPageChanges(pages, { status: 'publish', editingRoles: 'teachers,students' })
  assert.equal(changes.length, 2)
})

test('groupChangesByPage collapses a page to one entry carrying both fields', () => {
  const pages = [page({ url: 'a' }), page({ url: 'b' })]
  const grouped = groupChangesByPage(
    buildPageChanges(pages, { status: 'publish', editingRoles: 'teachers,students' }),
  )
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].fields.length, 2)
})

test('countActiveFields counts only the fields a teacher actually set', () => {
  assert.equal(countActiveFields(NO_ACTIONS), 0)
  assert.equal(countActiveFields({ status: 'publish', editingRoles: '' }), 1)
  assert.equal(countActiveFields({ status: 'publish', editingRoles: 'teachers' }), 2)
})

// ── filtering ────────────────────────────────────────────────────────────────

test('applyPageFilters matches titles case-insensitively', () => {
  const pages = [page({ url: 'a', title: 'Unit One Overview' }), page({ url: 'b', title: 'Rubric' })]
  assert.deepEqual(applyPageFilters(pages, 'unit', []).map(p => p.url), ['a'])
})

test('applyPageFilters narrows by published state', () => {
  const pages = [page({ url: 'a', published: true }), page({ url: 'b', published: false })]
  const filters = [{ id: 'status', value: { value: 'unpublished' } }]
  assert.deepEqual(applyPageFilters(pages, '', filters).map(p => p.url), ['b'])
})

test('applyPageFilters narrows by editing roles and editor type', () => {
  const pages = [
    page({ url: 'a', editingRoles: ['teachers', 'students'], editor: 'rce' }),
    page({ url: 'b', editingRoles: ['teachers'], editor: 'block_editor' }),
  ]
  assert.deepEqual(
    applyPageFilters(pages, '', [{ id: 'editingRoles', value: { value: 'teachers,students' } }]).map(p => p.url),
    ['a'],
  )
  assert.deepEqual(
    applyPageFilters(pages, '', [{ id: 'editor', value: { value: 'block_editor' } }]).map(p => p.url),
    ['b'],
  )
})

test('applyPageFilters applies every active filter', () => {
  const pages = [
    page({ url: 'a', title: 'Unit One', published: true, editor: 'rce' }),
    page({ url: 'b', title: 'Unit Two', published: true, editor: 'block_editor' }),
  ]
  const filters = [
    { id: 'status', value: { value: 'published' } },
    { id: 'editor', value: { value: 'rce' } },
  ]
  assert.deepEqual(applyPageFilters(pages, 'unit', filters).map(p => p.url), ['a'])
})

test('publishedParamFromFilters returns null when no status filter is active', () => {
  assert.equal(publishedParamFromFilters([]), null)
  assert.equal(publishedParamFromFilters([{ id: 'editor', value: { value: 'rce' } }]), null)
})

test('publishedParamFromFilters maps the status filter to a boolean', () => {
  assert.equal(publishedParamFromFilters([{ id: 'status', value: { value: 'published' } }]), true)
  assert.equal(publishedParamFromFilters([{ id: 'status', value: { value: 'unpublished' } }]), false)
})
