export const DEFAULTS = {
  // Account
  verificationFrequency: 'daily',        // 'startup' | 'daily' | 'weekly' | 'never'
  showConnectionInPopup: true,
  apiTimeout: 10000,                     // milliseconds
  resultsPerPage: 100,                   // 50 | 100
  rateLimitBehavior: 'queue',            // 'queue' | 'warn' | 'silent'

  // General
  dateFormat: 'MM/DD/YYYY',             // 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'Month D YYYY'
  timeFormat: '12h',                    // '12h' | '24h'
  timezone: 'canvas',                   // 'canvas' | 'system'
  defaultLandingPage: 'last',           // 'last' | 'bulk_editor' | 'template_library' | 'settings'
  defaultCourse: 'last_used',           // 'last_used' | 'ask'
  autoAddToModule: true,
  buttonColor: '#4f46e5',
  themeMode: 'system',                  // 'light' | 'dark' | 'system'
  homepageDisplayMode: 'tiles',         // 'tiles' | 'list'

  // General - advanced
  defaultDueTime: '23:59',
  defaultAvailableFromTime: '00:00',
  defaultAvailableUntilTime: '23:59',
  firstDayOfWeek: 'sunday',             // 'sunday' | 'monday'
  showCourseTerm: true,
  courseDisplayFormat: 'full',          // 'full' | 'code' | 'both'

  // Bulk Editor
  shiftAllDatesTogether: true,
  bulkEditorDefaultSort: 'dueAt',       // 'name' | 'group' | 'module' | 'dueAt' | 'points' | 'status'
  bulkEditorDefaultSortDir: 'asc',      // 'asc' | 'desc'
  bulkEditorDefaultDateShiftDays: 7,
  bulkEditorDefaultShiftDirection: 'forward', // 'forward' | 'backward'
  bulkEditorShowChangeLogAfterSave: false,
  bulkEditorShiftNullDates: 'skip',     // 'skip' | 'set' — WARNING: 'set' affects undated assignments

  // Bulk Editor - advanced
  bulkEditorRowsPerPage: 25,            // 10 | 25 | 50 | 100 | 'all'
  bulkEditorVisibleColumns: {
    name: true, group: true, module: true, dueAt: true,
    unlockAt: true, lockAt: true, points: true, status: true,
  },
  bulkEditorIncludeGradedDiscussions: true,
  bulkEditorIncludeQuizzes: true,
  bulkEditorIncludeUngraded: true,
  bulkEditorIncludeLocked: true,
  bulkEditorIncludeUnpublished: true,

  // Templates
  templatesSort: 'last_used',           // 'last_used' | 'name_asc' | 'name_desc' | 'created'
  templatesDefaultFolder: 'last_used',  // 'last_used' | 'unfiled' | 'ask'
  templatesAfterDeploy: 'results',      // 'bulk_editor' | 'library' | 'results'
  templatesActiveCoursesOnly: true,
  templateAutoExpandFolders: true,
  templateSkipDeleteConfirm: false,

  // Templates - advanced
  templatesSearchScope: 'name',         // 'name' | 'name_desc' | 'all'
  templatesDefaultSubmissionType: 'online',
  templatesDefaultGradingType: 'points',
  templatesDefaultPoints: 0,
  templatesDefaultPeerReview: false,

  // Copy Assignments
  copyDefaultDateMode: 'keep',          // 'keep' | 'clear' | 'shift'
  copyDefaultShiftDays: 7,
  copyDefaultPublishMode: 'keep',       // 'keep' | 'published' | 'unpublished'

  // Change Log
  changeLogRetentionPerCourse: 10,      // 5 | 10 | 20 | 50
  changeLogConfirmRevert: true,
  changeLogShowRevertSummary: 'always', // 'always' | 'partial_failure' | 'never'

  // Change Log - advanced
  changeLogDisplayOrder: 'newest',      // 'newest' | 'oldest'
  changeLogTimestampDetail: 'datetime', // 'datetime' | 'date'
  changeLogAutoClearOlderThan: null,    // null | days as integer

  // Confirmations
  confirmRequirePreviewBeforeApply: true,
  confirmBulkPublish: true,
  confirmBulkUnpublish: true,
  confirmBulkPointChange: false,
  confirmDeleteTemplate: true,
  confirmClearAllLogs: true,
  confirmRevert: true,

  // Confirmations - advanced
  confirmSkipForSingle: false,
  confirmSkipPreviewForSingleField: false,
  confirmRememberDismissed: false,

  // Navigation
  navDefaultModule: 'last_used',        // 'last_used' | module id
  rememberLastTool: true,
  sidebarDefault: 'expanded',           // 'expanded' | 'collapsed'

  // Popup
  popupPinnedTools: null,               // null = show all tools
  popupCourseShortcuts: [],             // [{ id, name }]

  // Developer (unlocked via 7-click on version number)
  devLogSelectorResolutions: false,
  devLogApiRequests: false,
  devShowStrategyInHealth: false,
  devSimulateSelectorFailure: null,     // null | selector key string

  // Internal
  lastUsedCourseId: null,
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

export async function resetPreferences(keys) {
  const current = await getPreferences()
  const resets = Object.fromEntries(keys.map(k => [k, DEFAULTS[k]]))
  const updated = { ...current, ...resets }
  await chrome.storage.sync.set({ preferences: updated })
  await chrome.storage.local.set({ preferences: updated })
  return updated
}

export async function setLastUsedCourse(courseId) {
  return setPreference('lastUsedCourseId', courseId)
}
