// Teacher-picked colors for Canvas Assignment Groups.
//
// Canvas has no color field on assignment groups, so picks live in
// chrome.storage.sync — this is index/settings data (group ids + palette token
// names), never student PII, so sync is allowed per the project's storage rules.
// One key per course keeps each entry well under sync's 8KB per-item cap.

const keyFor = courseId => `groupColors_${courseId}`

/** @returns {Promise<Record<string,string>>} { [groupId]: '--color-cat-N' } */
export async function getGroupColorOverrides(courseId) {
  if (!courseId) return {}
  const key = keyFor(courseId)
  const stored = await chrome.storage.sync.get(key)
  return { ...(stored[key] ?? {}) }
}

/**
 * Set (or, with token = null, clear) one group's color override.
 * @returns {Promise<Record<string,string>>} the updated course map
 */
export async function setGroupColorOverride(courseId, groupId, token) {
  const key = keyFor(courseId)
  const stored = await chrome.storage.sync.get(key)
  const map = { ...(stored[key] ?? {}) }
  const id = String(groupId)

  if (token) map[id] = token
  else delete map[id]

  await chrome.storage.sync.set({ [key]: map })
  return map
}
