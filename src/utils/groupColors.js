// Deterministic color coding for Canvas Assignment Groups (design_docs/10 §
// Data Tables — "4px domain accent indicator" per row). Groups are teacher-
// defined per course with no fixed set, so colors are hashed from the group's
// own id rather than assigned by fetch order — the same group renders the
// same color across reloads, filters, and re-sorts.

const PALETTE_TOKENS = [
  '--color-cat-1',
  '--color-cat-2',
  '--color-cat-3',
  '--color-cat-4',
  '--color-cat-5',
  '--color-cat-6',
  '--color-cat-7',
  '--color-cat-8',
]

// djb2 string hash — stable, fast, good-enough distribution for a palette
// this small. Not used for anything security-sensitive.
function hashString(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * getGroupColor(groupId) — the CSS color for an assignment group's accent.
 * Ungrouped assignments (no assignmentGroupId) get the neutral disabled token
 * rather than a palette color, since "no group" isn't itself a category.
 *
 * @param {string|number|null|undefined} groupId
 * @returns {string} a `var(--token)` reference, safe to use directly in a style prop
 */
export function getGroupColor(groupId) {
  if (groupId === null || groupId === undefined || groupId === '') {
    return 'var(--color-text-disabled)'
  }
  const index = hashString(String(groupId)) % PALETTE_TOKENS.length
  return `var(${PALETTE_TOKENS[index]})`
}
