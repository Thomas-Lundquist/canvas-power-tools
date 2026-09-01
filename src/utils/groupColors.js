// Color coding for Canvas Assignment Groups (design_docs/10 § Categorical Color
// Coding). Canvas's Assignment Group API has no color field, so a teacher's
// picks are stored locally (src/storage/groupColors.js, keyed by course + group
// id). Groups with no explicit pick are auto-assigned a *distinct* color by
// their position in the course's group order, so a fresh course still reads
// with every group a different color; the teacher can then override any of them.

export const GROUP_COLOR_TOKENS = [
  '--color-cat-1',
  '--color-cat-2',
  '--color-cat-3',
  '--color-cat-4',
  '--color-cat-5',
  '--color-cat-6',
  '--color-cat-7',
  '--color-cat-8',
]

// Neutral fill for assignments with no group — "no group" is not a category.
export const NO_GROUP_COLOR = 'var(--color-text-disabled)'

/** cssVar('--color-cat-3') → 'var(--color-cat-3)'. Safe for a style prop. */
export function cssVar(token) {
  return `var(${token})`
}

/**
 * resolveGroupColorTokens(orderedGroups, overrides)
 *
 * @param {{id: string|number}[]} orderedGroups  groups in course (position) order
 * @param {Record<string, string>} [overrides]   { [groupId]: '--color-cat-N' }
 * @returns {Map<string, string>}  groupId (string) → token name
 *
 * Explicit overrides win. Remaining groups are handed the palette tokens not
 * already claimed by an override, in order, wrapping only if there are more
 * un-overridden groups than free colors.
 */
export function resolveGroupColorTokens(orderedGroups = [], overrides = {}) {
  const map = new Map()
  const claimed = new Set(Object.values(overrides))
  const pool = GROUP_COLOR_TOKENS.filter(t => !claimed.has(t))
  let i = 0

  for (const g of orderedGroups) {
    const id = String(g.id)
    if (overrides[id]) {
      map.set(id, overrides[id])
      continue
    }
    const source = pool.length > 0 ? pool : GROUP_COLOR_TOKENS
    map.set(id, source[i % source.length])
    i++
  }
  return map
}

/**
 * groupColorCss(groupId, tokenMap) — the CSS color for one group's swatch,
 * falling back to the neutral no-group fill when the id isn't in the map
 * (ungrouped assignment, or map not loaded yet).
 */
export function groupColorCss(groupId, tokenMap) {
  if (groupId === null || groupId === undefined || groupId === '') return NO_GROUP_COLOR
  const token = tokenMap?.get(String(groupId))
  return token ? cssVar(token) : NO_GROUP_COLOR
}
