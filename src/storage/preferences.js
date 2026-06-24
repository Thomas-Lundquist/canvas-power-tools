const DEFAULTS = {
  // General
  shiftAllDatesTogether: true,
  defaultCourse: 'last_used',
  lastUsedCourseId: null,
  autoAddToModule: true,
  buttonColor: '#4f46e5',
  // Bulk Editor
  bulkEditorDefaultSort: 'position',
  bulkEditorDefaultSortDir: 'asc',
  // Templates
  templateSkipDeleteConfirm: false,
  templateAutoExpandFolders: true,
  // Popup — null means "show all tools" (avoids stale lists when new tools are added)
  popupPinnedTools: null,
  popupCourseShortcuts: [],
}

export async function getPreferences() {
  const local = await chrome.storage.local.get('preferences')
  if (local.preferences) return { ...DEFAULTS, ...local.preferences }

  const sync = await chrome.storage.sync.get('preferences')
  const prefs = { ...DEFAULTS, ...(sync.preferences ?? {}) }
  await chrome.storage.local.set({ preferences: prefs })
  return prefs
}

export async function setPreference(key, value) {
  const current = await getPreferences()
  const updated = { ...current, [key]: value }
  await chrome.storage.sync.set({ preferences: updated })
  await chrome.storage.local.set({ preferences: updated })
  return updated
}

export async function setLastUsedCourse(courseId) {
  return setPreference('lastUsedCourseId', courseId)
}
