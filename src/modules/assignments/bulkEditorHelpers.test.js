import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSectionOverrideDates,
  buildChangesFromInlineEdits,
} from './bulkEditorHelpers.js'

// --- buildSectionOverrideDates: the date-loss ("footgun") guard ---------------

test('new override seeds untouched dates from the base assignment', () => {
  const base = {
    dueAt: '2026-08-01T23:59:00Z',
    unlockAt: '2026-07-01T23:59:00Z',
    lockAt: '2026-09-01T23:59:00Z',
  }
  // Teacher changes only the due date on a section that had no override.
  const dates = buildSectionOverrideDates(null, [{ field: 'dueAt', newValue: '2026-08-15T23:59:00Z' }], base)

  assert.equal(dates.dueAt, '2026-08-15T23:59:00Z')     // changed
  assert.equal(dates.unlockAt, '2026-07-01T23:59:00Z')  // kept from base, NOT null
  assert.equal(dates.lockAt, '2026-09-01T23:59:00Z')    // kept from base, NOT null
})

test('existing override dates win over the base fallback', () => {
  const existing = { dueAt: '2026-05-01T23:59:00Z', unlockAt: null, lockAt: '2026-06-01T23:59:00Z' }
  const base = { dueAt: '2026-08-01T23:59:00Z', unlockAt: '2026-07-01T23:59:00Z', lockAt: '2026-09-01T23:59:00Z' }
  const dates = buildSectionOverrideDates(existing, [{ field: 'dueAt', newValue: '2026-05-10T23:59:00Z' }], base)

  assert.equal(dates.dueAt, '2026-05-10T23:59:00Z')     // changed
  assert.equal(dates.unlockAt, null)                    // override's own null, not base
  assert.equal(dates.lockAt, '2026-06-01T23:59:00Z')    // override's own value
})

test('with no override and no base fallback, untouched dates stay null', () => {
  const dates = buildSectionOverrideDates(null, [{ field: 'dueAt', newValue: '2026-08-15T23:59:00Z' }])
  assert.deepEqual(dates, { dueAt: '2026-08-15T23:59:00Z', unlockAt: null, lockAt: null })
})

// --- buildChangesFromInlineEdits: staged edits -> flat changes[] --------------

const SECTIONS = [{ id: 's1', name: 'Period 1' }, { id: 's2', name: 'Period 2' }]

function makeAssignment(over = {}) {
  return {
    id: 'a1',
    name: 'Quiz 1',
    dueAt: '2026-08-01T23:59:00Z',
    unlockAt: null,
    lockAt: null,
    published: false,
    assignmentGroupId: 'g1',
    overrides: [],
    ...over,
  }
}

test('base date edit converts to ISO and is assignment-scoped', () => {
  const edits = { a1: { base: { dueAt: '2026-09-01' } } }
  const changes = buildChangesFromInlineEdits(edits, [makeAssignment()], SECTIONS)

  assert.equal(changes.length, 1)
  assert.deepEqual(changes[0], {
    assignmentId: 'a1',
    assignmentName: 'Quiz 1',
    field: 'dueAt',
    previousValue: '2026-08-01T23:59:00Z',
    newValue: '2026-09-01T23:59:00Z',
    scope: 'assignment',
  })
})

test('clearing a base date yields a null newValue', () => {
  const edits = { a1: { base: { dueAt: null } } }
  const changes = buildChangesFromInlineEdits(edits, [makeAssignment()], SECTIONS)
  assert.equal(changes[0].newValue, null)
})

test('a staged value equal to the current value is dropped as a no-op', () => {
  const edits = { a1: { base: { dueAt: '2026-08-01' } } } // same day as current
  const changes = buildChangesFromInlineEdits(edits, [makeAssignment()], SECTIONS)
  assert.equal(changes.length, 0)
})

test('section edit on an inherited section is section-scoped with the base as previous', () => {
  const edits = { a1: { sections: { s2: { dueAt: '2026-10-01' } } } }
  const changes = buildChangesFromInlineEdits(edits, [makeAssignment()], SECTIONS)

  assert.equal(changes.length, 1)
  assert.deepEqual(changes[0], {
    assignmentId: 'a1',
    assignmentName: 'Quiz 1',
    field: 'dueAt',
    previousValue: '2026-08-01T23:59:00Z', // inherited base
    newValue: '2026-10-01T23:59:00Z',
    scope: 'section',
    sectionId: 's2',
    sectionName: 'Period 2',
    overrideId: null,
  })
})

test('section edit on an existing override reads previous from that override', () => {
  const assignment = makeAssignment({
    overrides: [{ id: 'o9', courseSectionId: 's1', dueAt: '2026-07-01T23:59:00Z', unlockAt: null, lockAt: null }],
  })
  const edits = { a1: { sections: { s1: { dueAt: '2026-07-15' } } } }
  const changes = buildChangesFromInlineEdits(edits, [assignment], SECTIONS)

  assert.equal(changes[0].previousValue, '2026-07-01T23:59:00Z')
  assert.equal(changes[0].overrideId, 'o9')
})

test('course-wide field edits (status, group) are assignment-scoped', () => {
  const edits = { a1: { fields: { published: true, assignmentGroupId: 'g2' } } }
  const changes = buildChangesFromInlineEdits(edits, [makeAssignment()], SECTIONS)

  const byField = Object.fromEntries(changes.map(c => [c.field, c]))
  assert.equal(byField.published.newValue, true)
  assert.equal(byField.published.previousValue, false)
  assert.equal(byField.published.scope, 'assignment')
  assert.equal(byField.assignmentGroupId.newValue, 'g2')
  assert.equal(byField.assignmentGroupId.previousValue, 'g1')
})

test('an assignment id with no matching assignment is skipped', () => {
  const edits = { ghost: { base: { dueAt: '2026-09-01' } } }
  const changes = buildChangesFromInlineEdits(edits, [makeAssignment()], SECTIONS)
  assert.equal(changes.length, 0)
})
