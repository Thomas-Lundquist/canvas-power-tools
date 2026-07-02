import { getPreferences } from './preferences.js'

function storageKey(courseId) {
  return `changeLog_${courseId}`
}

export async function getChangeLog(courseId) {
  const result = await chrome.storage.local.get(storageKey(courseId))
  return result[storageKey(courseId)] ?? []
}

export async function addChangeLogEntry(entry) {
  const prefs = await getPreferences()
  const maxEntries = prefs.changeLogRetentionPerCourse ?? 10
  const existing = await getChangeLog(entry.courseId)
  const updated = [entry, ...existing].slice(0, maxEntries)
  await chrome.storage.local.set({ [storageKey(entry.courseId)]: updated })
  return updated
}

export async function buildChangeLogEntry({ courseId, courseName, changes, type = 'edit', revertedFromId = null }) {
  const id = `clog_${Date.now()}`
  return {
    id,
    timestamp: new Date().toISOString(),
    courseId,
    courseName,
    summary: summarize(changes),
    type,
    revertedFromId,
    changes,
  }
}

export async function clearAllChangeLogs() {
  const all = await chrome.storage.local.get(null)
  const keys = Object.keys(all).filter(k => k.startsWith('changeLog_'))
  if (keys.length > 0) await chrome.storage.local.remove(keys)
}

export async function purgeOldChangeLogs(days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const all = await chrome.storage.local.get(null)
  const updates = {}
  for (const [key, entries] of Object.entries(all)) {
    if (!key.startsWith('changeLog_') || !Array.isArray(entries)) continue
    const filtered = entries.filter(e => {
      const ts = new Date(e.timestamp).getTime()
      return isNaN(ts) || ts >= cutoff
    })
    if (filtered.length !== entries.length) updates[key] = filtered
  }
  if (Object.keys(updates).length > 0) await chrome.storage.local.set(updates)
}

function summarize(changes) {
  const assignmentIds = new Set(changes.map(c => c.assignmentId))
  return `${changes.length} change${changes.length !== 1 ? 's' : ''} across ${assignmentIds.size} assignment${assignmentIds.size !== 1 ? 's' : ''}`
}
