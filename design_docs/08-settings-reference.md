# Canvas Power Tools — 08: Settings Reference

---

## Philosophy

Settings exist to make the extension work the way the teacher expects, not the
way the developer assumed. If a behavior could reasonably differ from the
default, it should be configurable. The teacher's workflow is the authority.

Settings are organized into three visibility tiers:

- Standard — visible by default, most teachers will use these
- Advanced — collapsed by default, revealed by expanding the section
- Developer — hidden entirely until unlocked via a secret gesture

The developer tier is unlocked by clicking the version number in the About
section seven times in a row. This prevents teacher confusion while keeping
diagnostic tools accessible.

---

## Critical Implementation Notes

### API Token and Settings Export
The settings export feature must never include the API token. If a teacher
exports settings as a backup file, the token is explicitly excluded. On import,
the teacher is prompted to re-enter and re-verify their token separately. The
UI states this clearly: "Your API token is not included in exports for security
reasons."

### Storage Allocation
chrome.storage.sync has a 100KB limit. Allocate storage deliberately:

```
chrome.storage.sync   Settings and preferences
                      Templates (primary source of truth)

chrome.storage.local  Change logs (written frequently, can be large)
                      DOM recovery log
                      API response cache
                      Template cache (speed copy of sync data)
```

### Timezone Handling
Canvas stores all dates in UTC. The extension must convert correctly to the
teacher's local timezone for display and back to UTC for writes. All date
display settings depend on this being implemented correctly first. This is a
technical requirement, not just a settings decision.

### Quizzes and Graded Discussions
Classic Quizzes use a separate Canvas API endpoint from the Assignments API.
New Quizzes appear as assignment objects. Graded discussions have associated
assignment objects. Before building the "Include quizzes" and "Include graded
discussions" toggles, verify which quiz engine is in use and plan accordingly.

### Null Date Shifting
The "Shift null dates" setting is high stakes. The default must be Skip. Shifting
undated assignments could accidentally publish or date assignments the teacher
did not intend to change. The setting must carry a clear warning in the UI.

### Settings Phasing
Not all settings need to be built at once. See the phasing plan at the end of
this document.

---

## Settings Storage Schema

```javascript
{
  settings: {
    general: {
      theme: "system",               // "system" | "light" | "dark"
      accentColor: "blue",           // "blue" | "teal" | "green" | "purple" |
                                     // "orange" | "slate" | "indigo"
      textSize: "medium",            // "small" | "medium" | "large" | "extra-large"
      dateFormat: "MM/DD/YYYY",      // "MM/DD/YYYY" | "DD/MM/YYYY" |
                                     // "YYYY-MM-DD" | "Month D YYYY"
      timeFormat: "12h",             // "12h" | "24h"
      timezone: "canvas",            // "canvas" | "system"
      defaultLandingPage: "last",    // "last" | specific module/tool path
      defaultCourse: "last",         // "last" | "ask"
      defaultDueTime: "23:59",       // HH:MM
      defaultAvailableFromTime: "00:00",
      defaultAvailableUntilTime: "23:59",
      firstDayOfWeek: "sunday",      // "sunday" | "monday"
      showCourseTerm: true,
      courseDisplayFormat: "full"    // "full" | "code" | "both"
    },


    security: {
      pinEnabled: false,
      pinHash: null,              // SHA-256 hash — plain text never stored
      pinMode: "inactivity",      // "inactivity" | "every_write"
      inactivityTimeoutMinutes: 30, // 15 | 30 | 60 | 240 | null (never)
      failedAttemptCount: 0,
      lockoutUntil: null          // timestamp if currently locked out
    },


    navigation: {
      defaultModule: "last_used",    // "last_used" | specific module key
      defaultTool: "last_used",      // "last_used" | specific tool key
      sidebarDefault: "expanded",    // "expanded" | "collapsed"
      rememberLastTool: true
    },

    account: {
      verificationFrequency: "page_open", // "page_open" | "auth_failure_only"
      showConnectionInPopup: true,
      apiTimeout: 10000,             // milliseconds
      resultsPerPage: 100,           // 50 | 100
      rateLimitBehavior: "queue",    // "queue" | "warn" | "silent"
      showRateLimitWarnings: true
    },

    bulkEditor: {
      defaultSortColumn: "dueAt",    // "name" | "group" | "module" |
                                     // "dueAt" | "points" | "status"
      defaultSortDirection: "asc",   // "asc" | "desc"
      shiftAllDatesTogether: true,
      defaultShiftAmount: 7,         // number of days
      defaultShiftDirection: "forward",// "forward" | "backward"
      requirePreview: true,
      confirmBulkPublish: true,
      confirmBulkUnpublish: true,
      afterApply: "stay",            // "stay" | "scroll_top" | "results_only"
      visibleColumns: {
        name: true,
        group: true,
        module: true,
        dueAt: true,
        unlockAt: true,
        lockAt: true,
        points: true,
        status: true
      },
      columnOrder: [
        "name", "group", "module", "dueAt",
        "unlockAt", "lockAt", "points", "status"
      ],
      rowsPerPage: 25,               // 10 | 25 | 50 | 100 | "all"
      selectAllBehavior: "filtered", // "filtered" | "all"
      includeGradedDiscussions: true,
      includeQuizzes: true,
      includeUngraded: true,
      includeLocked: true,
      includeUnpublished: true,
      requireDueDateToPublish: false,
      pointsDisplayFormat: "points", // "points" | "percentage" | "both"
      statusDisplayStyle: "both",    // "text" | "icon" | "both"
      rememberLastBulkAction: false,
      autoRefreshAfterApply: true,
      showSuccessNotification: true,
      successNotificationDuration: 5000, // milliseconds, -1 = until dismissed
      errorDisplayStyle: "full",     // "full" | "summary"
      shiftNullDates: "skip",        // "skip" | "set"
      defaultDateRangeFilter: "none" // "none" | "week" | "month" | "semester"
    },

    changeLog: {
      retentionPerCourse: 10,        // 5 | 10 | 20 | 50
      confirmBeforeRevert: true,
      showRevertSummary: "always",   // "always" | "partial_failure" | "never"
      accessibleFrom: "both",        // "both" | "settings_only"
      displayOrder: "newest",        // "newest" | "oldest"
      autoExpandLatest: false,
      showRevertsDifferently: true,
      timestampDetail: "datetime",   // "datetime" | "date"
      autoClearOlderThan: null,      // null | days as integer
      showFailedRevertNotification: true,
      continueRevertPastFailures: true
    },

    templates: {
      sortOrder: "last_used",        // "last_used" | "name_asc" |
                                     // "name_desc" | "created"
      defaultFolder: "last_used",    // "last_used" | "unfiled" | "ask"
      afterDeploy: "results",        // "bulk_editor" | "library" | "results"
      showActiveCoursesOnly: true,
      defaultCourseSelection: "none",// "none" | "last" | "all"
      promptForFolderOnNew: false,
      autoOpenEditorAfterSaveAs: false,
      searchScope: "name",           // "name" | "name_desc" | "all"
      showNeverUsedDifferently: false,
      saveAsTemplateButtonVisible: true,
      defaultSubmissionType: "online",
      defaultGradingType: "points",
      defaultPoints: 0,
      defaultPeerReview: false
    },

    popup: {
      courseDisplayMode: "active",   // "active" | "recent" | "custom"
      maxCoursesShown: 5,
      quickLaunchTools: {
        bulkEditor: true
        // Additional tools added here as features are built
      },
      courseSortOrder: "recent",     // "name_asc" | "recent" | "custom"
      customCourseIds: [],
      quickLinksPerCourse: {
        grades: true,
        canvasHome: true,
        assignments: false,
        people: false,
        modules: false,
        announcements: false
      },
      popupClickBehavior: "popup",   // "popup" | "last_tool"
      showTermLabel: true,
      showConnectionStatus: true,
      showCourseCode: false
    },

    confirmations: {
      requirePreviewBeforeApply: true,
      confirmBulkPublish: true,
      confirmBulkUnpublish: true,
      confirmBulkPointChange: false,
      confirmDeleteTemplate: true,
      confirmClearAllLogs: true,
      confirmRevert: true,
      skipConfirmForSingleAssignment: false,
      skipPreviewForSingleField: false,
      rememberDismissed: false
    },

    canvasIntegration: {
      showHealthNotices: true,
      runHealthCheckOnStartup: true,
      healthCheckFrequency: "daily", // "every_load" | "daily" | "weekly" | "manual"
      domLogRetention: 100,          // 50 | 100 | 500
      showCanvasVersionInHealth: true,
      autoExpandFailedSelectors: true
    },

    developer: {
      // Unlocked by clicking version number 7 times in About section
      unlocked: false,
      logSelectorResolutions: false,
      logApiRequests: false,
      showStrategyInHealthDashboard: false,
      simulateSelectorFailure: null  // null | selector key string
    }
  }
}
```

---

## Settings Page Layout

```
Settings

[Search settings...                              ]

── ACCOUNT ───────────────────────────────────────────────────────

── NAVIGATION ────────────────────────────────────────────────────
  Default module and tool on open
  Sidebar default state (expanded or collapsed)
  Remember last used tool

── SECURITY ──────────────────────────────────────────────────────
  PIN protection toggle
  PIN mode (on inactivity / on every write)
  Inactivity timeout
  Change PIN
  Reset PIN
  Audit log viewer

  Canvas URL
  API Token
  Connection status and verification
  Advanced: timeout, results per page, rate limit behavior

── GENERAL ───────────────────────────────────────────────────────
  Theme
  Date and time format
  Timezone
  Default landing page and course
  Advanced: default times, first day of week, course display format

── BULK EDITOR ───────────────────────────────────────────────────
  Date shift behavior
  Confirmations and preview
  After apply behavior
  Advanced: columns, rows per page, content inclusion,
            display formats, null date handling

── TEMPLATES ─────────────────────────────────────────────────────
  Sort order and default folder
  Deploy behavior
  Advanced: search scope, default field values, button visibility

── CHANGE LOG ────────────────────────────────────────────────────
  Retention per course
  Revert confirmation and summary
  Advanced: display order, auto-clear, timestamp detail

── POPUP ─────────────────────────────────────────────────────────
  Course display mode and limit
  Quick launch tools
  Per-course quick links
  Advanced: click behavior, labels, sort order

── CONFIRMATIONS ─────────────────────────────────────────────────
  All confirmation toggles in one place
  Advanced: skip rules

── CANVAS INTEGRATION ────────────────────────────────────────────
  Health notices
  Health check frequency
  Advanced: log retention, selector display options

── DATA ──────────────────────────────────────────────────────────
  Storage usage (sync and local)
  Clear change logs
  Clear templates
  Export settings (token excluded)
  Import settings

── ADVANCED ──────────────────────────────────────────────────────  [collapsed]
  API behavior
  Cache and sync strategy
  Per-section reset to defaults
  Developer tools toggle (hidden — unlocked via About)

── ABOUT ─────────────────────────────────────────────────────────
  Version number (click 7 times to unlock developer settings)
  License
  GitHub repository link
  Privacy policy link
  Help and tutorial link
```

---

## Per-Section Reset to Defaults

Each settings section has a reset button that restores only that section to
factory defaults. This allows a teacher who has tinkered with bulk editor
settings and gotten confused to reset just that section without losing their
account, templates, preferences in other sections, or change log.

```
── BULK EDITOR ───────────────────── [Reset to defaults]
```

Clicking Reset to defaults on a section prompts a confirmation:
"Reset Bulk Editor settings to defaults? Your other settings are not affected."

---

## Settings Search

The search bar at the top of the settings page filters settings in real time.
Searching "date" surfaces every date-related setting across all sections
without the teacher having to scroll through everything.

Search matches against:
- Setting label text
- Setting description text
- Section name

Results are shown as a flat list with the section name shown above each result
as context. Clearing the search restores the full sectioned layout.

---

## Export and Import

### Export
Generates a JSON file containing all settings and templates. Explicitly
excludes the API token. The export file is named:
canvas-power-tools-backup-YYYY-MM-DD.json

The export dialog states clearly:
"Your API token is not included in this export for your security. You will
need to re-enter it if you restore from this backup."

### Import
Accepts a previously exported backup file. Validates the file format before
applying. Warns the teacher that importing will overwrite their current
settings and templates. Does not overwrite the current API token or Canvas URL.
After import, prompts the teacher to verify their connection.

Import conflict options:
- Replace all current settings with backup
- Merge — backup wins on conflict
- Merge — current wins on conflict

---

## Settings Phasing Plan

Not all settings should be built at once. This phasing prevents over-engineering
before real user feedback reveals which settings teachers actually need.

### Essential — Build First

```
Account
  Canvas URL, API token, verification frequency, connection status in popup

General
  Theme, date format, time format, timezone, default landing page, default course

Bulk Editor
  Shift all dates together, require preview, confirm bulk publish,
  confirm bulk unpublish, visible columns, rows per page,
  include unpublished, shift null dates (with warning)

Change Log
  Retention per course, confirm before revert, show revert summary

Confirmations
  All standard tier confirmations

About
  Version, GitHub link, privacy policy, help link
```

### Template Settings

```
Templates
  Sort order, default folder, after deploy behavior, active courses only
```

### Advanced — Add as Features Stabilize

```
General advanced settings
Bulk Editor advanced settings
Templates advanced settings (added alongside template feature)
Change Log advanced settings
Settings search bar
Per-section reset to defaults
```

### Later

```
Popup settings (once popup is more fully designed)
Canvas Integration advanced settings
Developer settings section
Export and Import
Data section with storage visualization
```

---

## Handling Missing Settings in Storage

When a setting key is absent from storage — for example on first install,
after an import that predates certain settings, or after an extension update
adds new settings — the extension must fall back to the default value without
error.

```javascript
// settings-defaults.js
// Single source of truth for all default values
// Used both to initialize settings and as fallback for missing keys

export const DEFAULTS = {
  general: {
    theme: "system",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    // ... all defaults
  },
  bulkEditor: {
    shiftAllDatesTogether: true,
    requirePreview: true,
    // ... all defaults
  }
  // ... all sections
}

// settings-service.js
// Merges stored settings with defaults so missing keys never cause errors

export async function getSetting(path) {
  const stored = await chrome.storage.sync.get('settings')
  return getNestedValue(stored.settings, path)
      ?? getNestedValue(DEFAULTS, path)
}
```

This pattern ensures the extension is always robust against partial or
missing settings data regardless of how it got into that state.
