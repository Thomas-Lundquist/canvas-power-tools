import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveGroupColorTokens,
  groupColorCss,
  GROUP_COLOR_TOKENS,
  NO_GROUP_COLOR,
} from './groupColors.js'

test('auto-assigns a distinct color to each of the first 8 groups', () => {
  const groups = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}` }))
  const map = resolveGroupColorTokens(groups, {})
  const tokens = groups.map(g => map.get(g.id))
  assert.equal(new Set(tokens).size, 8)
})

test('explicit override wins and is excluded from the auto pool', () => {
  const groups = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const map = resolveGroupColorTokens(groups, { a: '--color-cat-3' })
  assert.equal(map.get('a'), '--color-cat-3')
  assert.ok(!['a-color'].includes(map.get('b')))
  assert.notEqual(map.get('b'), '--color-cat-3')
  assert.notEqual(map.get('c'), '--color-cat-3')
})

test('numeric and string group ids resolve the same entry', () => {
  const map = resolveGroupColorTokens([{ id: 42 }], {})
  assert.equal(map.get('42'), GROUP_COLOR_TOKENS[0])
})

test('groupColorCss falls back to the no-group fill', () => {
  const map = resolveGroupColorTokens([{ id: 'x' }], {})
  assert.equal(groupColorCss('x', map), 'var(--color-cat-1)')
  assert.equal(groupColorCss(null, map), NO_GROUP_COLOR)
  assert.equal(groupColorCss('missing', map), NO_GROUP_COLOR)
})
