import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, Loader,
  Search, ExternalLink, ChevronRight, ChevronDown, RotateCcw, X, Settings, Sun, Moon,
  Download, Upload, Lock, ShieldOff,
} from 'lucide-react'
import AppNav, { BrandLogo } from '../components/AppNav.jsx'
import SkipLink from '../components/SkipLink.jsx'
import Modal from '../components/Modal.jsx'
import { useKeyboardShortcuts } from '../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../components/ShortcutsPanel.jsx'
import { ToastProvider, useToast } from '../components/Toast.jsx'
import SetupGuard from '../components/SetupGuard.jsx'
import { TOOLS } from '../config/tools.jsx'
import { getAccount, updateVerificationStatus, saveAccount, markSetupComplete } from '../storage/account.js'
import { getPreferences, setPreference, resetPreferences, DEFAULTS } from '../storage/preferences.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../utils/color.js'
import { clearAllChangeLogs } from '../storage/changeLogs.js'
import { getTemplates, saveTemplate, saveFolder } from '../storage/templates.js'
import { verifyToken } from '../api/auth.js'
import { getDecryptedToken } from '../storage/encryption.js'
import { getCourses } from '../api/courses.js'
import { getSecuritySettings, setupPin, clearPin, verifyPin, saveSecuritySettings } from '../security/pin.js'
import { getAuditLog, clearAuditLog, exportAuditLogCsv } from '../security/audit-log.js'
import '../styles/global.css'
import { PinGateProvider } from '../security/usePinGate.jsx'

// ─── Brand colors ─────────────────────────────────────────────────────────────


// ─── Section reset key maps ────────────────────────────────────────────────────

const SECTION_KEYS = {
  account: ['verificationFrequency', 'showConnectionInPopup', 'showRateLimitWarnings', 'apiTimeout', 'resultsPerPage', 'rateLimitBehavior'],
  navigation: ['navDefaultModule', 'rememberLastTool', 'defaultLandingPage', 'defaultCourse', 'sidebarDefault'],
  general: ['textSize', 'dateFormat', 'timeFormat', 'timezone', 'autoAddToModule', 'palette', 'themeMode', 'homepageDisplayMode', 'defaultDueTime', 'defaultAvailableFromTime', 'defaultAvailableUntilTime', 'firstDayOfWeek', 'showCourseTerm', 'courseDisplayFormat'],
  bulkEditor: ['shiftAllDatesTogether', 'bulkEditorAfterApply', 'bulkEditorSelectAllBehavior', 'bulkEditorDefaultSort', 'bulkEditorDefaultSortDir', 'bulkEditorDefaultDateShiftDays', 'bulkEditorDefaultShiftDirection', 'bulkEditorShowChangeLogAfterSave', 'bulkEditorShiftNullDates', 'bulkEditorRowsPerPage', 'bulkEditorVisibleColumns', 'bulkEditorIncludeGradedDiscussions', 'bulkEditorIncludeQuizzes', 'bulkEditorIncludeUngraded', 'bulkEditorIncludeLocked', 'bulkEditorIncludeUnpublished'],
  templates: ['templatesSort', 'templatesDefaultFolder', 'templatesAfterDeploy', 'templatesActiveCoursesOnly', 'templateSkipDeleteConfirm', 'templatesSearchScope', 'templatesDefaultSubmissionType', 'templatesDefaultGradingType', 'templatesDefaultPoints', 'templatesDefaultPeerReview'],
  copyAssignments: ['copyDefaultDateMode', 'copyDefaultShiftDays', 'copyDefaultPublishMode'],
  changeLog: ['changeLogRetentionPerCourse', 'changeLogConfirmRevert', 'changeLogShowRevertSummary', 'changeLogAutoExpandLatest', 'changeLogContinueRevertPastFailures', 'changeLogDisplayOrder', 'changeLogTimestampDetail', 'changeLogAutoClearOlderThan'],
  popup: ['popupPinnedTools', 'popupCourseShortcuts'],
  confirmations: ['confirmRequirePreviewBeforeApply', 'confirmBulkPublish', 'confirmBulkUnpublish', 'confirmBulkPointChange', 'confirmDeleteTemplate', 'confirmClearAllLogs', 'confirmRevert', 'confirmSkipForSingle', 'confirmSkipPreviewForSingleField', 'confirmRememberDismissed'],
}

// ─── Searchable settings index ─────────────────────────────────────────────────
// render(prefs, setPref) is called at render time with live state.
// Complex settings (token, color picker, course shortcuts) are inline-only.

const SETTINGS_INDEX = [
  // Navigation ──────────────────────────────────────────────────────────────────
  { section: 'navigation', sectionTitle: 'Navigation', tier: 'standard',
    label: 'Default module on open', description: 'Which module to open when launching Canvas Power Tools.',
    render: (p, set) => (
      <select value={p.navDefaultModule ?? 'last_used'} onChange={e => set('navDefaultModule', e.target.value)} className="input text-sm">
        <option value="last_used">Last used</option>
        <option value="assignments">Assignments</option>
        <option value="grading">Grading</option>
        <option value="communication">Communication</option>
        <option value="people">People</option>
      </select>
    ),
  },
  { section: 'navigation', sectionTitle: 'Navigation', tier: 'standard',
    label: 'Remember last used tool', description: 'Return to the same tool within a module when switching back to it.',
    render: (p, set) => <Toggle checked={p.rememberLastTool ?? true} onChange={v => set('rememberLastTool', v)} />,
  },
  { section: 'navigation', sectionTitle: 'Navigation', tier: 'standard',
    label: 'Default landing page', description: 'Which page to open when launching Canvas Power Tools.',
    render: (p, set) => (
      <select value={p.defaultLandingPage} onChange={e => set('defaultLandingPage', e.target.value)} className="input text-sm">
        <option value="last">Last visited page</option>
        <option value="bulk_editor">Bulk Editor</option>
        <option value="template_library">Template Library</option>
        <option value="settings">Settings</option>
      </select>
    ),
  },
  { section: 'navigation', sectionTitle: 'Navigation', tier: 'standard',
    label: 'Default course', description: 'Which course to open when launching the Bulk Editor.',
    render: (p, set) => (
      <select value={p.defaultCourse} onChange={e => set('defaultCourse', e.target.value)} className="input text-sm">
        <option value="last_used">Last used course</option>
        <option value="ask">Always ask</option>
      </select>
    ),
  },
  { section: 'navigation', sectionTitle: 'Navigation', tier: 'advanced',
    label: 'Sidebar default state', description: 'Whether the sidebar starts expanded or collapsed when a tool opens.',
    render: (p, set) => (
      <select value={p.sidebarDefault ?? 'expanded'} onChange={e => set('sidebarDefault', e.target.value)} className="input text-sm">
        <option value="expanded">Expanded</option>
        <option value="collapsed">Collapsed</option>
      </select>
    ),
  },

  // Account ────────────────────────────────────────────────────────────────────
  { section: 'account', sectionTitle: 'Account', tier: 'standard',
    label: 'Verification frequency', description: 'How often to automatically re-check your API token.',
    render: (p, set) => (
      <select value={p.verificationFrequency} onChange={e => set('verificationFrequency', e.target.value)} className="input text-sm">
        <option value="startup">On startup</option>
        <option value="daily">Daily (recommended)</option>
        <option value="weekly">Weekly</option>
        <option value="never">Never</option>
      </select>
    ),
  },
  { section: 'account', sectionTitle: 'Account', tier: 'standard',
    label: 'Show connection status in popup', description: 'Display a connection indicator when you open the extension popup.',
    render: (p, set) => <Toggle checked={p.showConnectionInPopup} onChange={v => set('showConnectionInPopup', v)} />,
  },
  { section: 'account', sectionTitle: 'Account', tier: 'standard',
    label: 'Show rate limit warnings', description: 'Display a notice when Canvas API rate limits are reached.',
    render: (p, set) => <Toggle checked={p.showRateLimitWarnings ?? true} onChange={v => set('showRateLimitWarnings', v)} />,
  },
  { section: 'account', sectionTitle: 'Account', tier: 'advanced',
    label: 'API request timeout', description: 'How long to wait before cancelling a Canvas API request.',
    render: (p, set) => (
      <div className="flex items-center gap-1.5">
        <input type="number" min="1000" max="60000" step="1000"
          value={p.apiTimeout} onChange={e => set('apiTimeout', Math.max(1000, parseInt(e.target.value) || 10000))}
          className="input w-24 text-sm" />
        <span className="text-xs text-gray-400">ms</span>
      </div>
    ),
  },
  { section: 'account', sectionTitle: 'Account', tier: 'advanced',
    label: 'Results per page', description: 'Number of assignments to fetch per API request.',
    render: (p, set) => (
      <select value={p.resultsPerPage} onChange={e => set('resultsPerPage', parseInt(e.target.value))} className="input w-28 text-sm">
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
    ),
  },
  { section: 'account', sectionTitle: 'Account', tier: 'advanced',
    label: 'Rate limit behavior', description: 'What to do when Canvas API rate limits are hit.',
    render: (p, set) => (
      <select value={p.rateLimitBehavior} onChange={e => set('rateLimitBehavior', e.target.value)} className="input text-sm">
        <option value="queue">Queue and retry</option>
        <option value="warn">Warn and continue</option>
        <option value="silent">Continue silently</option>
      </select>
    ),
  },

  // General ────────────────────────────────────────────────────────────────────
  { section: 'general', sectionTitle: 'General', tier: 'standard',
    label: 'Text size', description: 'Scale text and UI elements for readability.',
    render: (p, set) => (
      <select value={p.textSize ?? 'medium'} onChange={e => set('textSize', e.target.value)} className="input text-sm">
        <option value="small">Small</option>
        <option value="medium">Medium (default)</option>
        <option value="large">Large</option>
        <option value="extra-large">Extra large</option>
      </select>
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'standard',
    label: 'Date format', description: 'How dates are displayed throughout the extension.',
    render: (p, set) => (
      <select value={p.dateFormat} onChange={e => set('dateFormat', e.target.value)} className="input text-sm">
        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        <option value="Month D YYYY">Month D, YYYY</option>
      </select>
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'standard',
    label: 'Time format', description: '12-hour or 24-hour clock display.',
    render: (p, set) => (
      <select value={p.timeFormat} onChange={e => set('timeFormat', e.target.value)} className="input text-sm">
        <option value="12h">12-hour (2:30 PM)</option>
        <option value="24h">24-hour (14:30)</option>
      </select>
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'standard',
    label: 'Timezone', description: 'Which timezone to use when displaying Canvas dates.',
    render: (p, set) => (
      <select value={p.timezone} onChange={e => set('timezone', e.target.value)} className="input text-sm">
        <option value="canvas">Canvas course timezone</option>
        <option value="system">My local timezone</option>
      </select>
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'standard',
    label: 'Auto-add to module after deploy', description: 'When deploying a template from a module\'s Power Tools button, automatically add the new assignment to that module.',
    render: (p, set) => <Toggle checked={p.autoAddToModule} onChange={v => set('autoAddToModule', v)} />,
  },
  { section: 'general', sectionTitle: 'General', tier: 'advanced',
    label: 'Default due time', description: 'Time pre-filled when setting a due date with no existing time.',
    render: (p, set) => (
      <input type="time" value={p.defaultDueTime} onChange={e => set('defaultDueTime', e.target.value)} className="input w-32 text-sm" />
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'advanced',
    label: 'Default available from time', description: 'Time pre-filled for the "Available from" field.',
    render: (p, set) => (
      <input type="time" value={p.defaultAvailableFromTime} onChange={e => set('defaultAvailableFromTime', e.target.value)} className="input w-32 text-sm" />
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'advanced',
    label: 'Default available until time', description: 'Time pre-filled for the "Available until" field.',
    render: (p, set) => (
      <input type="time" value={p.defaultAvailableUntilTime} onChange={e => set('defaultAvailableUntilTime', e.target.value)} className="input w-32 text-sm" />
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'advanced',
    label: 'First day of week', description: 'Used in calendar and date pickers.',
    render: (p, set) => (
      <select value={p.firstDayOfWeek} onChange={e => set('firstDayOfWeek', e.target.value)} className="input text-sm">
        <option value="sunday">Sunday</option>
        <option value="monday">Monday</option>
      </select>
    ),
  },
  { section: 'general', sectionTitle: 'General', tier: 'advanced',
    label: 'Show course term', description: 'Display the term/semester label alongside course names.',
    render: (p, set) => <Toggle checked={p.showCourseTerm} onChange={v => set('showCourseTerm', v)} />,
  },
  { section: 'general', sectionTitle: 'General', tier: 'advanced',
    label: 'Course display format', description: 'How course names appear in dropdowns.',
    render: (p, set) => (
      <select value={p.courseDisplayFormat} onChange={e => set('courseDisplayFormat', e.target.value)} className="input text-sm">
        <option value="full">Full name</option>
        <option value="code">Course code</option>
        <option value="both">Both</option>
      </select>
    ),
  },

  // Bulk Editor ─────────────────────────────────────────────────────────────────
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'standard',
    label: 'Shift all date fields together', description: 'When shifting dates, apply the same shift to Due Date, Available From, and Available Until simultaneously.',
    render: (p, set) => <Toggle checked={p.shiftAllDatesTogether} onChange={v => set('shiftAllDatesTogether', v)} />,
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'standard',
    label: 'Default date shift amount', description: 'Number of days pre-filled when you activate Shift mode on a date field.',
    render: (p, set) => (
      <div className="flex items-center gap-1.5">
        <input type="number" min="1" max="365"
          value={p.bulkEditorDefaultDateShiftDays}
          onChange={e => set('bulkEditorDefaultDateShiftDays', Math.max(1, parseInt(e.target.value) || 7))}
          className="input w-20 text-sm" />
        <span className="text-xs text-gray-400">days</span>
      </div>
    ),
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'standard',
    label: 'Default shift direction', description: 'Whether date shifts move assignments forward or backward in time.',
    render: (p, set) => (
      <select value={p.bulkEditorDefaultShiftDirection} onChange={e => set('bulkEditorDefaultShiftDirection', e.target.value)} className="input text-sm">
        <option value="forward">Forward</option>
        <option value="backward">Backward</option>
      </select>
    ),
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'standard',
    label: 'Default sort', description: 'Initial sort order when opening the Bulk Editor.',
    render: (p, set) => (
      <div className="flex items-center gap-2">
        <select value={p.bulkEditorDefaultSort} onChange={e => set('bulkEditorDefaultSort', e.target.value)} className="input text-sm">
          <option value="name">Name</option>
          <option value="group">Group</option>
          <option value="module">Module</option>
          <option value="dueAt">Due date</option>
          <option value="points">Points</option>
          <option value="status">Status</option>
        </select>
        <select value={p.bulkEditorDefaultSortDir} onChange={e => set('bulkEditorDefaultSortDir', e.target.value)} className="input text-sm w-28">
          <option value="asc">A → Z</option>
          <option value="desc">Z → A</option>
        </select>
      </div>
    ),
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'standard',
    label: 'Show change log after saving', description: 'Automatically expand the change log panel after a successful bulk edit.',
    render: (p, set) => <Toggle checked={p.bulkEditorShowChangeLogAfterSave} onChange={v => set('bulkEditorShowChangeLogAfterSave', v)} />,
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'standard',
    label: 'Shift null dates', description: 'What to do with assignments that have no due date when a date shift is applied.',
    render: (p, set) => (
      <select value={p.bulkEditorShiftNullDates} onChange={e => set('bulkEditorShiftNullDates', e.target.value)} className="input text-sm">
        <option value="skip">Skip (leave undated)</option>
        <option value="set">Set a new date</option>
      </select>
    ),
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'standard',
    label: 'After applying changes', description: 'What happens to the view after a bulk edit is saved to Canvas.',
    render: (p, set) => (
      <select value={p.bulkEditorAfterApply ?? 'stay'} onChange={e => set('bulkEditorAfterApply', e.target.value)} className="input text-sm">
        <option value="stay">Stay in place</option>
        <option value="scroll_top">Scroll to top</option>
        <option value="results_only">Show changed rows only</option>
      </select>
    ),
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'advanced',
    label: 'Select All behavior', description: 'Whether "Select All" selects every row or only visible filtered rows.',
    render: (p, set) => (
      <select value={p.bulkEditorSelectAllBehavior ?? 'filtered'} onChange={e => set('bulkEditorSelectAllBehavior', e.target.value)} className="input text-sm">
        <option value="filtered">Filtered rows only</option>
        <option value="all">All rows</option>
      </select>
    ),
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'advanced',
    label: 'Rows per page', description: 'Number of assignments shown per page in the Bulk Editor table.',
    render: (p, set) => (
      <select value={p.bulkEditorRowsPerPage} onChange={e => set('bulkEditorRowsPerPage', e.target.value === 'all' ? 'all' : parseInt(e.target.value))} className="input w-28 text-sm">
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
        <option value="all">All</option>
      </select>
    ),
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'advanced',
    label: 'Include graded discussions', description: 'Show graded discussions alongside assignments in the Bulk Editor.',
    render: (p, set) => <Toggle checked={p.bulkEditorIncludeGradedDiscussions} onChange={v => set('bulkEditorIncludeGradedDiscussions', v)} />,
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'advanced',
    label: 'Include quizzes', description: 'Show quizzes alongside assignments in the Bulk Editor.',
    render: (p, set) => <Toggle checked={p.bulkEditorIncludeQuizzes} onChange={v => set('bulkEditorIncludeQuizzes', v)} />,
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'advanced',
    label: 'Include ungraded items', description: 'Include assignments worth zero points.',
    render: (p, set) => <Toggle checked={p.bulkEditorIncludeUngraded} onChange={v => set('bulkEditorIncludeUngraded', v)} />,
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'advanced',
    label: 'Include locked assignments', description: 'Include assignments that are locked from student edits.',
    render: (p, set) => <Toggle checked={p.bulkEditorIncludeLocked} onChange={v => set('bulkEditorIncludeLocked', v)} />,
  },
  { section: 'bulkEditor', sectionTitle: 'Bulk Editor', tier: 'advanced',
    label: 'Include unpublished assignments', description: 'Include draft assignments in the Bulk Editor.',
    render: (p, set) => <Toggle checked={p.bulkEditorIncludeUnpublished} onChange={v => set('bulkEditorIncludeUnpublished', v)} />,
  },

  // Templates ───────────────────────────────────────────────────────────────────
  { section: 'templates', sectionTitle: 'Templates', tier: 'standard',
    label: 'Sort order', description: 'How templates are ordered in the library.',
    render: (p, set) => (
      <select value={p.templatesSort} onChange={e => set('templatesSort', e.target.value)} className="input text-sm">
        <option value="last_used">Last used</option>
        <option value="name_asc">Name (A–Z)</option>
        <option value="name_desc">Name (Z–A)</option>
        <option value="created">Date created</option>
      </select>
    ),
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'standard',
    label: 'Default folder', description: 'Which folder a new template is saved into by default.',
    render: (p, set) => (
      <select value={p.templatesDefaultFolder} onChange={e => set('templatesDefaultFolder', e.target.value)} className="input text-sm">
        <option value="last_used">Last used folder</option>
        <option value="unfiled">Unfiled</option>
        <option value="ask">Always ask</option>
      </select>
    ),
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'standard',
    label: 'After deploy', description: 'Where to go after deploying a template to Canvas.',
    render: (p, set) => (
      <select value={p.templatesAfterDeploy} onChange={e => set('templatesAfterDeploy', e.target.value)} className="input text-sm">
        <option value="results">Stay on results</option>
        <option value="library">Return to library</option>
        <option value="bulk_editor">Open in Bulk Editor</option>
      </select>
    ),
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'standard',
    label: 'Active courses only', description: 'Only show active courses in the deploy course picker.',
    render: (p, set) => <Toggle checked={p.templatesActiveCoursesOnly} onChange={v => set('templatesActiveCoursesOnly', v)} />,
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'standard',
    label: 'Skip delete confirmation', description: 'Delete templates and folders immediately without a confirmation prompt.',
    render: (p, set) => <Toggle checked={p.templateSkipDeleteConfirm} onChange={v => set('templateSkipDeleteConfirm', v)} />,
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'advanced',
    label: 'Search scope', description: 'Which fields are searched when filtering the template library.',
    render: (p, set) => (
      <select value={p.templatesSearchScope} onChange={e => set('templatesSearchScope', e.target.value)} className="input text-sm">
        <option value="name">Name only</option>
        <option value="name_desc">Name and description</option>
        <option value="all">All fields</option>
      </select>
    ),
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'advanced',
    label: 'Default submission type', description: 'Pre-filled submission type for new templates.',
    render: (p, set) => (
      <select value={p.templatesDefaultSubmissionType} onChange={e => set('templatesDefaultSubmissionType', e.target.value)} className="input text-sm">
        <option value="online">Online</option>
        <option value="on_paper">On paper</option>
        <option value="no_submission">No submission</option>
        <option value="external_tool">External tool</option>
      </select>
    ),
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'advanced',
    label: 'Default grading type', description: 'Pre-filled grading type for new templates.',
    render: (p, set) => (
      <select value={p.templatesDefaultGradingType} onChange={e => set('templatesDefaultGradingType', e.target.value)} className="input text-sm">
        <option value="points">Points</option>
        <option value="percent">Percentage</option>
        <option value="letter_grade">Letter grade</option>
        <option value="gpa_scale">GPA scale</option>
        <option value="pass_fail">Pass / fail</option>
        <option value="not_graded">Not graded</option>
      </select>
    ),
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'advanced',
    label: 'Default points', description: 'Points value pre-filled on new templates.',
    render: (p, set) => (
      <input type="number" min="0" value={p.templatesDefaultPoints}
        onChange={e => set('templatesDefaultPoints', Math.max(0, parseFloat(e.target.value) || 0))}
        className="input w-24 text-sm" />
    ),
  },
  { section: 'templates', sectionTitle: 'Templates', tier: 'advanced',
    label: 'Default peer review', description: 'Enable peer review by default on new templates.',
    render: (p, set) => <Toggle checked={p.templatesDefaultPeerReview} onChange={v => set('templatesDefaultPeerReview', v)} />,
  },

  // Copy Assignments ─────────────────────────────────────────────────────────────
  { section: 'copyAssignments', sectionTitle: 'Copy Assignments', tier: 'standard',
    label: 'Default date handling', description: 'How dates are handled when copying assignments to another course.',
    render: (p, set) => (
      <select value={p.copyDefaultDateMode} onChange={e => set('copyDefaultDateMode', e.target.value)} className="input text-sm">
        <option value="keep">Keep original dates</option>
        <option value="clear">Clear all dates</option>
        <option value="shift">Shift dates</option>
      </select>
    ),
  },
  { section: 'copyAssignments', sectionTitle: 'Copy Assignments', tier: 'standard',
    label: 'Default shift amount', description: 'Number of days pre-filled when copying with date shifting enabled.',
    render: (p, set) => (
      <div className="flex items-center gap-1.5">
        <input type="number" min="1" max="365"
          value={p.copyDefaultShiftDays}
          onChange={e => set('copyDefaultShiftDays', Math.max(1, parseInt(e.target.value) || 7))}
          className="input w-20 text-sm" />
        <span className="text-xs text-gray-400">days</span>
      </div>
    ),
  },
  { section: 'copyAssignments', sectionTitle: 'Copy Assignments', tier: 'standard',
    label: 'Default publish state', description: 'Publish state for assignments after they are copied to the target course.',
    render: (p, set) => (
      <select value={p.copyDefaultPublishMode} onChange={e => set('copyDefaultPublishMode', e.target.value)} className="input text-sm">
        <option value="keep">Keep original</option>
        <option value="published">Always publish</option>
        <option value="unpublished">Always unpublish</option>
      </select>
    ),
  },

  // Change Log ──────────────────────────────────────────────────────────────────
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'standard',
    label: 'Retention per course', description: 'Maximum number of change log entries kept per course. Older entries are removed automatically.',
    render: (p, set) => (
      <select value={p.changeLogRetentionPerCourse} onChange={e => set('changeLogRetentionPerCourse', parseInt(e.target.value))} className="input w-28 text-sm">
        <option value={5}>5 entries</option>
        <option value={10}>10 entries</option>
        <option value={20}>20 entries</option>
        <option value={50}>50 entries</option>
      </select>
    ),
  },
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'standard',
    label: 'Confirm before reverting', description: 'Show a confirmation prompt before reverting a bulk edit.',
    render: (p, set) => <Toggle checked={p.changeLogConfirmRevert} onChange={v => set('changeLogConfirmRevert', v)} />,
  },
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'standard',
    label: 'Show revert summary', description: 'Display a results summary after a revert completes.',
    render: (p, set) => (
      <select value={p.changeLogShowRevertSummary} onChange={e => set('changeLogShowRevertSummary', e.target.value)} className="input text-sm">
        <option value="always">Always</option>
        <option value="partial_failure">Only on partial failure</option>
        <option value="never">Never</option>
      </select>
    ),
  },
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'advanced',
    label: 'Auto-expand latest entry', description: 'Automatically open the most recent change log entry when the log loads.',
    render: (p, set) => <Toggle checked={p.changeLogAutoExpandLatest ?? false} onChange={v => set('changeLogAutoExpandLatest', v)} />,
  },
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'advanced',
    label: 'Continue revert past failures', description: 'When reverting a bulk edit, keep going if some assignments fail rather than stopping at the first error.',
    render: (p, set) => <Toggle checked={p.changeLogContinueRevertPastFailures ?? true} onChange={v => set('changeLogContinueRevertPastFailures', v)} />,
  },
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'advanced',
    label: 'Display order', description: 'Order in which change log entries are shown.',
    render: (p, set) => (
      <select value={p.changeLogDisplayOrder} onChange={e => set('changeLogDisplayOrder', e.target.value)} className="input text-sm">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    ),
  },
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'advanced',
    label: 'Timestamp detail', description: 'How much detail to show in change log timestamps.',
    render: (p, set) => (
      <select value={p.changeLogTimestampDetail} onChange={e => set('changeLogTimestampDetail', e.target.value)} className="input text-sm">
        <option value="datetime">Date and time</option>
        <option value="date">Date only</option>
      </select>
    ),
  },
  { section: 'changeLog', sectionTitle: 'Change Log', tier: 'advanced',
    label: 'Auto-clear entries older than', description: 'Automatically remove log entries older than this many days. Leave blank to keep all entries.',
    render: (p, set) => (
      <div className="flex items-center gap-1.5">
        <input type="number" min="1" max="365"
          value={p.changeLogAutoClearOlderThan ?? ''}
          placeholder="Off"
          onChange={e => set('changeLogAutoClearOlderThan', e.target.value ? Math.max(1, parseInt(e.target.value)) : null)}
          className="input w-24 text-sm" />
        <span className="text-xs text-gray-400">days</span>
      </div>
    ),
  },

  // Confirmations ───────────────────────────────────────────────────────────────
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'standard',
    label: 'Require preview before applying', description: 'Always show a diff preview before bulk changes are written to Canvas.',
    render: (p, set) => <Toggle checked={p.confirmRequirePreviewBeforeApply} onChange={v => set('confirmRequirePreviewBeforeApply', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'standard',
    label: 'Confirm bulk publish', description: 'Show a confirmation prompt before bulk-publishing assignments.',
    render: (p, set) => <Toggle checked={p.confirmBulkPublish} onChange={v => set('confirmBulkPublish', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'standard',
    label: 'Confirm bulk unpublish', description: 'Show a confirmation prompt before bulk-unpublishing assignments.',
    render: (p, set) => <Toggle checked={p.confirmBulkUnpublish} onChange={v => set('confirmBulkUnpublish', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'standard',
    label: 'Confirm bulk point change', description: 'Show a confirmation prompt before changing points on multiple assignments at once.',
    render: (p, set) => <Toggle checked={p.confirmBulkPointChange} onChange={v => set('confirmBulkPointChange', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'standard',
    label: 'Confirm template deletion', description: 'Require confirmation before deleting a template or folder.',
    render: (p, set) => <Toggle checked={p.confirmDeleteTemplate} onChange={v => set('confirmDeleteTemplate', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'standard',
    label: 'Confirm clearing all logs', description: 'Require confirmation before clearing all change log entries.',
    render: (p, set) => <Toggle checked={p.confirmClearAllLogs} onChange={v => set('confirmClearAllLogs', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'standard',
    label: 'Confirm reverting changes', description: 'Require confirmation before reverting a bulk edit from the change log.',
    render: (p, set) => <Toggle checked={p.confirmRevert} onChange={v => set('confirmRevert', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'advanced',
    label: 'Skip confirmation for single assignment', description: 'Skip publish/unpublish confirmations when only one assignment is selected.',
    render: (p, set) => <Toggle checked={p.confirmSkipForSingle} onChange={v => set('confirmSkipForSingle', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'advanced',
    label: 'Skip preview for single field change', description: 'Skip the diff preview when only one field type is being edited.',
    render: (p, set) => <Toggle checked={p.confirmSkipPreviewForSingleField} onChange={v => set('confirmSkipPreviewForSingleField', v)} />,
  },
  { section: 'confirmations', sectionTitle: 'Confirmations', tier: 'advanced',
    label: 'Remember dismissed confirmations', description: 'When you dismiss a confirmation with "Don\'t show again", remember that choice.',
    render: (p, set) => <Toggle checked={p.confirmRememberDismissed} onChange={v => set('confirmRememberDismissed', v)} />,
  },

  // Developer ───────────────────────────────────────────────────────────────────
  { section: 'developer', sectionTitle: 'Developer', tier: 'standard',
    label: 'Log selector resolutions', description: 'Print DOM selector resolution results to the browser console.',
    render: (p, set) => <Toggle checked={p.devLogSelectorResolutions} onChange={v => set('devLogSelectorResolutions', v)} />,
  },
  { section: 'developer', sectionTitle: 'Developer', tier: 'standard',
    label: 'Log API requests', description: 'Print every Canvas API request and response to the browser console.',
    render: (p, set) => <Toggle checked={p.devLogApiRequests} onChange={v => set('devLogApiRequests', v)} />,
  },
  { section: 'developer', sectionTitle: 'Developer', tier: 'standard',
    label: 'Show selector strategy in health dashboard', description: 'Display which selector tier resolved each element in the Canvas integration health view.',
    render: (p, set) => <Toggle checked={p.devShowStrategyInHealth} onChange={v => set('devShowStrategyInHealth', v)} />,
  },
]

// ─── Helper components ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? '' : 'bg-gray-300'}`}
      style={checked ? { backgroundColor: 'var(--cpt-color)' } : undefined}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        style={{ backgroundColor: 'white' }}
      />
    </button>
  )
}

function PrefRow({ title, description, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function StyledCheck({ checked }) {
  return (
    <span
      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${checked ? '' : 'bg-white border-gray-300'}`}
      style={checked ? { backgroundColor: 'var(--cpt-color)', borderColor: 'var(--cpt-color)' } : undefined}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5L4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

function SectionCard({ id, title, advancedOpen, onToggleAdvanced, resetConfirm, onResetRequest, onResetConfirm, onResetCancel, hasAdvanced, children, advancedChildren }) {
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">{title}</h2>
        <div className="flex items-center gap-2">
          {resetConfirm ? (
            <>
              <span className="text-xs text-gray-600">Reset {title} to defaults?</span>
              <button onClick={onResetConfirm} className="btn-danger text-xs px-2 py-1">Reset</button>
              <button onClick={onResetCancel} className="btn-ghost text-xs px-2 py-1">Cancel</button>
            </>
          ) : (
            <button onClick={onResetRequest} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
              <RotateCcw size={11} /> Reset to defaults
            </button>
          )}
        </div>
      </div>
      <div className="space-y-0 divide-y divide-gray-100">
        {children}
      </div>
      {hasAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={onToggleAdvanced}
            aria-expanded={advancedOpen}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight size={12} className={`transition-transform ${advancedOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
            Advanced
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-0 divide-y divide-gray-100">
              {advancedChildren}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function matchesSearch(q, label, description) {
  const s = q.toLowerCase()
  return label.toLowerCase().includes(s) || (description ?? '').toLowerCase().includes(s)
}

// ─── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [account, setAccount]           = useState(null)
  const [prefs, setPrefs]               = useState(null)
  const [showToken, setShowToken]       = useState(false)
  const [decryptedToken, setDecryptedToken] = useState(null)
  const [verifying, setVerifying]       = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [courses, setCourses]           = useState([])
  const [courseSearch, setCourseSearch] = useState('')
  const [storageUsage, setStorageUsage] = useState(null)
  const [confirmClearLogs, setConfirmClearLogs]     = useState(false)
  const [confirmClearTemplates, setConfirmClearTemplates] = useState(false)
  const [search, setSearch]             = useState('')
  const [advancedOpen, setAdvancedOpen] = useState({})
  const [resetConfirm, setResetConfirm] = useState(null)
  const [devClickCount, setDevClickCount] = useState(0)
  const [devUnlocked, setDevUnlocked]   = useState(false)
  const [secSettings, setSecSettings]   = useState(null)
  const [auditEntries, setAuditEntries] = useState([])
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [changePinCurrent, setChangePinCurrent] = useState('')
  const [changePinNew, setChangePinNew] = useState('')
  const [changePinConfirm, setChangePinConfirm] = useState('')
  const [changePinError, setChangePinError] = useState(null)
  const [changePinSaving, setChangePinSaving] = useState(false)
  const [confirmDisablePin, setConfirmDisablePin] = useState(false)
  const [confirmClearAudit, setConfirmClearAudit] = useState(false)
  const [reconnectOpen, setReconnectOpen]         = useState(false)
  const [importError, setImportError]             = useState(null)
  const toast = useToast()
  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  useEffect(() => {
    Promise.all([getAccount(), getPreferences()]).then(([acc, p]) => {
      setAccount(acc)
      setPrefs(p)
      applyPalette(p.palette)
      applyDarkMode(p.themeMode ?? 'system')
      applyTextSize(p.textSize ?? 'medium')
    })
    getCourses().then(setCourses).catch(() => {})
    getSecuritySettings().then(setSecSettings)
    getAuditLog().then(entries => setAuditEntries(entries.slice(0, 10)))
    Promise.all([
      new Promise(r => chrome.storage.local.getBytesInUse(null, r)),
      new Promise(r => chrome.storage.sync.getBytesInUse(null, r)),
    ]).then(([local, sync]) => setStorageUsage({ local, sync }))
  }, [])

  async function setPref(key, value) {
    const updated = await setPreference(key, value)
    setPrefs(updated)
    if (key === 'palette') applyPalette(value)
    if (key === 'themeMode') applyDarkMode(value)
    if (key === 'textSize') applyTextSize(value)
  }

  async function doResetSection(sectionId) {
    const keys = SECTION_KEYS[sectionId]
    if (!keys) return
    const updated = await resetPreferences(keys)
    setPrefs(updated)
    applyPalette(updated.palette)
    applyDarkMode(updated.themeMode ?? 'system')
    applyTextSize(updated.textSize ?? 'medium')
    setResetConfirm(null)
  }

  async function revealToken() {
    if (!showToken) setDecryptedToken(await getDecryptedToken())
    setShowToken(!showToken)
  }

  async function verifyNow() {
    setVerifying(true)
    setVerifyStatus(null)
    try {
      const token = await getDecryptedToken()
      await verifyToken(account.canvasUrl, token)
      await updateVerificationStatus('valid')
      setVerifyStatus('valid')
      setAccount(await getAccount())
    } catch {
      await updateVerificationStatus('failed')
      setVerifyStatus('failed')
    } finally {
      setVerifying(false)
    }
  }

  async function clearLogs() {
    await clearAllChangeLogs()
    setConfirmClearLogs(false)
  }

  async function clearTemplates() {
    await chrome.storage.sync.remove('templates')
    await chrome.storage.local.remove('templates')
    setConfirmClearTemplates(false)
  }

  function toggleAdvanced(sectionId) {
    setAdvancedOpen(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  function handleVersionClick() {
    if (devUnlocked) return
    const next = devClickCount + 1
    setDevClickCount(next)
    if (next >= 7) {
      setDevUnlocked(true)
      toast('Developer mode unlocked', 'success')
    }
  }

  async function handleDisablePin() {
    await clearPin()
    setSecSettings(await getSecuritySettings())
    setConfirmDisablePin(false)
    toast('PIN disabled', 'success')
  }

  async function handleSaveNewPin() {
    if (changePinNew.length < 4) { setChangePinError('PIN must be at least 4 digits.'); return }
    if (changePinNew !== changePinConfirm) { setChangePinError('PINs do not match.'); return }
    if (secSettings?.pinEnabled && secSettings?.pinHash) {
      const correct = await verifyPin(changePinCurrent)
      if (!correct) { setChangePinError('Current PIN is incorrect.'); return }
    }
    setChangePinSaving(true)
    await setupPin(changePinNew)
    setSecSettings(await getSecuritySettings())
    setChangePinOpen(false)
    setChangePinCurrent('')
    setChangePinNew('')
    setChangePinConfirm('')
    setChangePinError(null)
    setChangePinSaving(false)
    toast('PIN updated', 'success')
  }

  async function handleSaveTimeout(minutes) {
    await saveSecuritySettings({ inactivityTimeoutMinutes: minutes })
    setSecSettings(await getSecuritySettings())
  }

  async function handleExportAuditLog() {
    const csv = await exportAuditLogCsv()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cpt-audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleClearAuditLog() {
    await clearAuditLog()
    setAuditEntries([])
    setConfirmClearAudit(false)
    toast('Audit log cleared', 'success')
  }

  function handleExportSettings() {
    const { lastUsedCourseId, popupCourseShortcuts, ...portablePrefs } = prefs
    const payload = { version: 1, exportedAt: new Date().toISOString(), preferences: portablePrefs }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cpt-settings-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportSettings(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    let payload
    try {
      payload = JSON.parse(await file.text())
    } catch {
      setImportError('Could not read file — make sure it is a valid Canvas Power Tools backup.')
      return
    }
    if (!payload.preferences || typeof payload.preferences !== 'object' || Array.isArray(payload.preferences)) {
      setImportError('Invalid settings file — "preferences" key not found.')
      return
    }
    const { lastUsedCourseId: _lcid, popupCourseShortcuts: _pcs, ...importablePrefs } = payload.preferences
    const updated = { ...DEFAULTS, ...importablePrefs }
    if (!Array.isArray(updated.popupPinnedTools))         updated.popupPinnedTools         = DEFAULTS.popupPinnedTools
    if (!Array.isArray(updated.bulkEditorVisibleColumns)) updated.bulkEditorVisibleColumns  = DEFAULTS.bulkEditorVisibleColumns
    try {
      await chrome.storage.sync.set({ preferences: updated })
      await chrome.storage.local.set({ preferences: updated })
      setPrefs(updated)
      applyPalette(updated.palette)
      applyDarkMode(updated.themeMode ?? 'system')
      applyTextSize(updated.textSize ?? 'medium')
      toast('Settings imported successfully', 'success')
    } catch {
      setImportError('Could not save settings — storage quota may be exceeded.')
    } finally {
      e.target.value = ''
    }
  }

  function sectionProps(id) {
    return {
      id,
      advancedOpen: advancedOpen[id] ?? false,
      onToggleAdvanced: () => toggleAdvanced(id),
      resetConfirm: resetConfirm === id,
      onResetRequest: () => setResetConfirm(id),
      onResetConfirm: () => doResetSection(id),
      onResetCancel: () => setResetConfirm(null),
    }
  }

  function renderIndexItems(sectionId, tier) {
    return SETTINGS_INDEX
      .filter(item => item.section === sectionId && item.tier === tier)
      .map(item => (
        <PrefRow key={item.label} title={item.label} description={item.description}>
          {item.render(prefs, setPref)}
        </PrefRow>
      ))
  }

  const filteredCourses = courseSearch.trim()
    ? courses.filter(c => c.name.toLowerCase().includes(courseSearch.toLowerCase()))
    : courses

  function toggleCourseShortcut(course) {
    const current = prefs.popupCourseShortcuts ?? []
    const exists = current.find(c => c.id === course.id)
    const next = exists
      ? current.filter(c => c.id !== course.id)
      : [...current, { id: course.id, name: course.name }]
    setPref('popupCourseShortcuts', next)
  }

  if (!account || !prefs) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader size={32} className="animate-spin" style={{ color: 'var(--cpt-color)' }} />
      </div>
    )
  }

  const statusColor = account.verificationStatus === 'valid' ? 'text-green-600' : 'text-red-600'
  const StatusIcon  = account.verificationStatus === 'valid' ? CheckCircle : AlertCircle
  const version     = chrome.runtime.getManifest().version

  // ── Search results view ──────────────────────────────────────────────────────
  const searchResults = search.trim()
    ? SETTINGS_INDEX.filter(item =>
        matchesSearch(search, item.label, item.description) ||
        item.sectionTitle.toLowerCase().includes(search.toLowerCase())
      )
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <SkipLink />
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <BrandLogo />
          <AppNav current={null} />
        </div>
      </div>

      <div id="main-content" className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Search bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search settings…"
            className="input pl-9 text-sm w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Search results ── */}
        {searchResults ? (
          searchResults.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-400">
              No settings match "{search}"
            </div>
          ) : (
            <div className="card p-6 space-y-0 divide-y divide-gray-100">
              <p className="section-title pb-3">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
              {searchResults.map((item, i) => {
                const showSection = i === 0 || searchResults[i - 1].sectionTitle !== item.sectionTitle
                return (
                  <div key={`${item.section}-${item.label}`}>
                    {showSection && (
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-3 pb-1 first:pt-0">
                        {item.sectionTitle}
                      </p>
                    )}
                    <PrefRow title={item.label} description={item.description}>
                      {item.render(prefs, setPref)}
                    </PrefRow>
                  </div>
                )
              })}
            </div>
          )
        ) : (
        <>

        {/* ── Account ── */}
        <SectionCard {...sectionProps('account')} title="Account" hasAdvanced>
          {/* Canvas URL — read only */}
          <PrefRow title="Canvas URL" description="Your institution's Canvas domain.">
            <p className="text-sm text-gray-700 max-w-xs truncate">{account.canvasUrl}</p>
          </PrefRow>

          {/* API Token */}
          <PrefRow title="API Token" description="Your personal Canvas API token. Used for all requests.">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-700 tracking-wider">
                {showToken && decryptedToken ? decryptedToken.slice(0, 20) + '…' : '••••••••••••••••'}
              </span>
              <button className="btn-secondary text-xs px-2 py-1" onClick={revealToken}>
                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </PrefRow>

          {/* Connection status */}
          <PrefRow title="Connection" description="Status of your Canvas API connection.">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-sm font-medium ${statusColor}`}>
                <StatusIcon size={13} />
                {account.verificationStatus === 'valid' ? 'Connected' : 'Failed'}
              </span>
              <button className="btn-secondary text-xs px-2 py-1 flex items-center gap-1" onClick={verifyNow} disabled={verifying}>
                {verifying ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Verify
              </button>
              <button className="btn-ghost text-xs" onClick={() => setReconnectOpen(true)}>
                Redo setup
              </button>
            </div>
          </PrefRow>
          {verifyStatus === 'valid' && <p className="text-xs text-green-600 flex items-center gap-1 py-1"><CheckCircle size={12} /> Verified successfully.</p>}
          {verifyStatus === 'failed' && <p className="text-xs text-red-600 flex items-center gap-1 py-1"><AlertCircle size={12} /> Token is invalid or expired.</p>}

          {renderIndexItems('account', 'standard')}

          <>{/* advanced */}</>
          {advancedOpen.account && renderIndexItems('account', 'advanced')}
        </SectionCard>

        {/* ── Navigation ── */}
        <SectionCard {...sectionProps('navigation')} title="Navigation" hasAdvanced>
          {renderIndexItems('navigation', 'standard')}
          {advancedOpen.navigation && renderIndexItems('navigation', 'advanced')}
        </SectionCard>

        {/* ── Security ── */}
        {secSettings && (
          <section className="card p-6">
            <h2 className="section-title mb-4">Security</h2>
            <div className="space-y-0 divide-y divide-gray-100">

              {/* PIN enable/disable */}
              <PrefRow
                title="PIN Protection"
                description="Require a PIN before any change is made to Canvas."
              >
                <Toggle
                  checked={secSettings.pinEnabled}
                  onChange={checked => {
                    if (!checked) {
                      setConfirmDisablePin(true)
                    } else {
                      setChangePinOpen(true)
                    }
                  }}
                />
              </PrefRow>

              {/* Disable confirmation */}
              {confirmDisablePin && (
                <div className="py-3">
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <ShieldOff size={15} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-800 font-medium">Disable PIN protection?</p>
                      <p className="text-xs text-amber-700 mt-0.5">Anyone who opens this extension will be able to make changes to your Canvas courses.</p>
                      <div className="flex gap-2 mt-2">
                        <button className="btn-danger text-xs px-2 py-1 flex items-center gap-1" onClick={handleDisablePin}>
                          <ShieldOff size={11} /> Disable PIN
                        </button>
                        <button className="btn-ghost text-xs px-2 py-1" onClick={() => setConfirmDisablePin(false)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Inactivity timeout */}
              {secSettings.pinEnabled && (
                <PrefRow
                  title="Auto-lock after"
                  description="How long the extension stays unlocked when idle."
                >
                  <select
                    value={secSettings.inactivityTimeoutMinutes}
                    onChange={e => handleSaveTimeout(Number(e.target.value))}
                    className="input text-sm"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={240}>4 hours</option>
                  </select>
                </PrefRow>
              )}

              {/* Change PIN */}
              {secSettings.pinEnabled && !changePinOpen && (
                <div className="py-3">
                  <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => setChangePinOpen(true)}>
                    <Lock size={12} /> Change PIN
                  </button>
                </div>
              )}

              {/* Change PIN inline form */}
              {changePinOpen && (
                <div className="py-4 space-y-3">
                  <p className="text-sm font-medium text-gray-900">{secSettings.pinEnabled && secSettings.pinHash ? 'Change PIN' : 'Set PIN'}</p>
                  {secSettings.pinEnabled && secSettings.pinHash && (
                    <div>
                      <label className="label">Current PIN</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={changePinCurrent}
                        onChange={e => { setChangePinCurrent(e.target.value.replace(/\D/g, '').slice(0, 6)); setChangePinError(null) }}
                        placeholder="••••"
                        className="input w-32 text-center text-lg tracking-[0.4em] font-mono"
                        autoFocus
                      />
                    </div>
                  )}
                  <div>
                    <label className="label">New PIN (4–6 digits)</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={changePinNew}
                      onChange={e => { setChangePinNew(e.target.value.replace(/\D/g, '').slice(0, 6)); setChangePinError(null) }}
                      placeholder="••••"
                      className="input w-32 text-center text-lg tracking-[0.4em] font-mono"
                      autoFocus={!secSettings.pinHash}
                    />
                  </div>
                  <div>
                    <label className="label">Confirm new PIN</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={changePinConfirm}
                      onChange={e => { setChangePinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6)); setChangePinError(null) }}
                      placeholder="••••"
                      className="input w-32 text-center text-lg tracking-[0.4em] font-mono"
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveNewPin() }}
                    />
                  </div>
                  {changePinError && (
                    <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} />{changePinError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-sm"
                      disabled={changePinNew.length < 4 || changePinConfirm.length < 4 || changePinSaving}
                      onClick={handleSaveNewPin}
                    >
                      {changePinSaving ? <Loader size={13} className="animate-spin" /> : null}
                      Save PIN
                    </button>
                    <button className="btn-ghost text-sm" onClick={() => { setChangePinOpen(false); setChangePinCurrent(''); setChangePinNew(''); setChangePinConfirm(''); setChangePinError(null) }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Log */}
              <div className="pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-900">Audit Log</p>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary text-xs flex items-center gap-1"
                      onClick={handleExportAuditLog}
                      disabled={auditEntries.length === 0}
                    >
                      <Download size={11} /> Export CSV
                    </button>
                    {confirmClearAudit ? (
                      <>
                        <span className="text-xs text-gray-600">Clear all entries?</span>
                        <button className="btn-danger text-xs px-2 py-1" onClick={handleClearAuditLog}>Clear</button>
                        <button className="btn-ghost text-xs px-2 py-1" onClick={() => setConfirmClearAudit(false)}>Cancel</button>
                      </>
                    ) : (
                      <button
                        className="text-xs text-gray-400 hover:text-gray-600"
                        onClick={() => setConfirmClearAudit(true)}
                        disabled={auditEntries.length === 0}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {auditEntries.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">No activity logged yet.</p>
                ) : (
                  <div className="space-y-1">
                    {auditEntries.map(entry => (
                      <div key={entry.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-gray-400 shrink-0 w-32">
                          {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className="text-gray-700 flex-1">{entry.summary}</span>
                        <span className={`shrink-0 ${entry.pinVerified === true ? 'text-green-600' : 'text-gray-400'}`}>
                          {entry.pinVerified === true ? 'PIN ✓' : 'No PIN'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </section>
        )}

        {/* ── General ── */}
        <SectionCard {...sectionProps('general')} title="General" hasAdvanced>
          {/* Theme */}
          <PrefRow title="Theme" description="Color scheme used throughout the extension.">
            <div className="flex gap-2">
              {[
                { value: 'system', label: 'System', Icon: Settings },
                { value: 'light',  label: 'Light',  Icon: Sun      },
                { value: 'dark',   label: 'Dark',   Icon: Moon     },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setPref('themeMode', value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    (prefs.themeMode ?? 'system') === value
                      ? 'text-white border-transparent'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  style={(prefs.themeMode ?? 'system') === value
                    ? { backgroundColor: 'var(--cpt-color)', borderColor: 'var(--cpt-color)' }
                    : undefined}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </PrefRow>

          {/* Homepage layout */}
          <PrefRow title="Homepage layout" description="How tools are displayed on the homepage.">
            <div className="flex gap-2">
              {[
                { value: 'tiles', label: 'Tiles' },
                { value: 'list',  label: 'List'  },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPref('homepageDisplayMode', value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    (prefs.homepageDisplayMode ?? 'tiles') === value
                      ? 'text-white border-transparent'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  style={(prefs.homepageDisplayMode ?? 'tiles') === value
                    ? { backgroundColor: 'var(--cpt-color)', borderColor: 'var(--cpt-color)' }
                    : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </PrefRow>

          {/* Palette theme */}
          <PrefRow title="Style" description="Full visual style used throughout the extension, including the injected Canvas button. No per-color customization.">
            <div className="flex gap-2">
              {[
                { value: 'bauhaus', label: 'Bauhaus', title: 'Flat surfaces, no shadows, per-module accent colors' },
                { value: 'default', label: 'Default',  title: 'Accessible & Ethical — WCAG AAA contrast target' },
              ].map(({ value, label, title }) => (
                <button
                  key={value}
                  title={title}
                  aria-pressed={(prefs.palette ?? 'bauhaus') === value}
                  onClick={() => setPref('palette', value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    (prefs.palette ?? 'bauhaus') === value
                      ? 'text-white border-transparent'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  style={(prefs.palette ?? 'bauhaus') === value
                    ? { backgroundColor: 'var(--cpt-color)', borderColor: 'var(--cpt-color)' }
                    : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </PrefRow>

          {renderIndexItems('general', 'standard')}

          {advancedOpen.general && renderIndexItems('general', 'advanced')}
        </SectionCard>

        {/* ── Bulk Editor ── */}
        <SectionCard
          {...sectionProps('bulkEditor')} title="Bulk Editor" hasAdvanced
          advancedChildren={
            <>
              {renderIndexItems('bulkEditor', 'advanced')}
              {/* Visible columns (complex object — inline) */}
              <div className="py-2.5">
                <p className="text-sm font-medium text-gray-900 mb-2">Visible columns</p>
                <p className="text-xs text-gray-500 mb-3">Choose which columns appear in the Bulk Editor table.</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(prefs.bulkEditorVisibleColumns ?? DEFAULTS.bulkEditorVisibleColumns).map(([col, visible]) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setPref('bulkEditorVisibleColumns', { ...(prefs.bulkEditorVisibleColumns ?? DEFAULTS.bulkEditorVisibleColumns), [col]: !visible })}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors text-left"
                    >
                      <StyledCheck checked={visible} />
                      <span className="text-sm text-gray-700 capitalize">{col === 'dueAt' ? 'Due date' : col === 'unlockAt' ? 'Available from' : col === 'lockAt' ? 'Available until' : col}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          }
        >
          {renderIndexItems('bulkEditor', 'standard')}

          {/* Shift null dates warning */}
          {prefs.bulkEditorShiftNullDates === 'set' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 mt-1">
              Warning: "Set a new date" will create due dates on assignments that currently have none. This may affect teacher workflows or Canvas visibility. Default is Skip.
            </div>
          )}
        </SectionCard>

        {/* ── Templates ── */}
        <SectionCard
          {...sectionProps('templates')} title="Templates" hasAdvanced
          advancedChildren={renderIndexItems('templates', 'advanced')}
        >
          {renderIndexItems('templates', 'standard')}
        </SectionCard>

        {/* ── Copy Assignments ── */}
        <SectionCard {...sectionProps('copyAssignments')} title="Copy Assignments" hasAdvanced={false}>
          {renderIndexItems('copyAssignments', 'standard')}
        </SectionCard>

        {/* ── Change Log ── */}
        <SectionCard
          {...sectionProps('changeLog')} title="Change Log" hasAdvanced
          advancedChildren={renderIndexItems('changeLog', 'advanced')}
        >
          {renderIndexItems('changeLog', 'standard')}
        </SectionCard>

        {/* ── Popup ── */}
        <SectionCard {...sectionProps('popup')} title="Popup" hasAdvanced={false}>
          {/* Pinned tools */}
          <div className="py-2.5">
            <p className="text-sm font-medium text-gray-900 mb-0.5">Pinned tools</p>
            <p className="text-xs text-gray-500 mb-2">Deselecting all shows every tool.</p>
            <div className="space-y-0.5">
              {TOOLS.map(tool => {
                const pinnedIds = prefs.popupPinnedTools
                const isChecked = pinnedIds == null || pinnedIds.includes(tool.id)
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      const current = prefs.popupPinnedTools ?? TOOLS.map(t => t.id)
                      const next = current.includes(tool.id)
                        ? current.filter(id => id !== tool.id)
                        : [...current, tool.id]
                      setPref('popupPinnedTools', next.length === TOOLS.length ? null : next)
                    }}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <StyledCheck checked={isChecked} />
                    <tool.Icon size={14} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700">{tool.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Course shortcuts */}
          <div className="pt-3 mt-1 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-900 mb-0.5">Course shortcuts</p>
            <p className="text-xs text-gray-500 mb-3">Selected courses appear as quick-launch buttons in the popup.</p>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={courseSearch}
                onChange={e => setCourseSearch(e.target.value)}
                placeholder="Search courses…"
                className="input pl-9 text-sm"
              />
            </div>
            <div className="space-y-0.5 max-h-52 overflow-y-auto">
              {filteredCourses.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-2">
                  {courses.length === 0 ? 'Loading courses…' : 'No courses match your search.'}
                </p>
              ) : filteredCourses.map(course => {
                const isChecked = (prefs.popupCourseShortcuts ?? []).some(c => c.id === course.id)
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => toggleCourseShortcut(course)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <StyledCheck checked={isChecked} />
                    <span className="text-sm text-gray-700 text-left truncate">{course.name}</span>
                    {course.term && <span className="text-xs text-gray-400 shrink-0 ml-auto">{course.term}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </SectionCard>

        {/* ── Confirmations ── */}
        <SectionCard {...sectionProps('confirmations')} title="Confirmations" hasAdvanced>
          {renderIndexItems('confirmations', 'standard')}
          {advancedOpen.confirmations && renderIndexItems('confirmations', 'advanced')}
        </SectionCard>

        {/* ── Data ── */}
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Data</h2>

          {/* Storage usage */}
          {storageUsage && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Storage usage</p>
              <StorageBar label="Local cache" used={storageUsage.local} max={5 * 1024 * 1024} />
              <StorageBar label="Synced data" used={storageUsage.sync} max={100 * 1024} />
            </div>
          )}

          {/* Export / Import settings */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Settings backup</p>
              <p className="text-xs text-gray-500 mt-0.5">Export your preferences or restore from a backup file.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={handleExportSettings}>
                <Download size={12} aria-hidden="true" /> Export
              </button>
              <label className="btn-secondary text-xs flex items-center gap-1.5 cursor-pointer">
                <Upload size={12} aria-hidden="true" /> Import
                <input type="file" accept=".json" className="sr-only" onChange={handleImportSettings} />
              </label>
            </div>
          </div>
          {importError && (
            <p role="alert" className="text-xs text-red-600 flex items-center gap-1 -mt-2">
              <AlertCircle size={12} aria-hidden="true" /> {importError}
            </p>
          )}

          {/* Clear change logs */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Change logs</p>
              <p className="text-xs text-gray-500 mt-0.5">All bulk edit history across all courses.</p>
            </div>
            {confirmClearLogs ? (
              <div role="alert" className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Clear all logs?</span>
                <button className="btn-danger text-xs px-2 py-1" onClick={clearLogs}>Clear</button>
                <button className="btn-ghost text-xs" onClick={() => setConfirmClearLogs(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmClearLogs(true)}>
                Clear All Logs
              </button>
            )}
          </div>

          {/* Clear templates */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Templates</p>
              <p className="text-xs text-gray-500 mt-0.5">All saved templates and folders.</p>
            </div>
            {confirmClearTemplates ? (
              <div role="alert" className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Delete all templates?</span>
                <button className="btn-danger text-xs px-2 py-1" onClick={clearTemplates}>Delete</button>
                <button className="btn-ghost text-xs" onClick={() => setConfirmClearTemplates(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmClearTemplates(true)}>
                Clear All Templates
              </button>
            )}
          </div>
        </section>

        {/* ── About ── */}
        <section className="card p-6 space-y-3">
          <h2 className="section-title">About</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between items-center">
              <span>Version</span>
              <button
                onClick={handleVersionClick}
                className="text-gray-900 font-medium select-none focus:outline-none"
                title={devUnlocked ? 'Developer mode active' : undefined}
              >
                {version}{devUnlocked ? ' [dev]' : ''}
              </button>
            </div>
            <div className="flex justify-between"><span>License</span><span className="text-gray-900">MIT Open Source</span></div>
            <div className="flex justify-between items-center">
              <span>Source code</span>
              <a
                href="https://github.com/Thomas-Lundquist/canvas-power-tools"
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: 'var(--cpt-color)' }}
              >
                GitHub <ExternalLink size={12} />
              </a>
            </div>
            <div className="flex justify-between items-center">
              <span>Privacy policy</span>
              <span className="text-xs text-gray-400">Coming soon</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Help &amp; tutorials</span>
              <a
                href="https://github.com/Thomas-Lundquist/canvas-power-tools/wiki"
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: 'var(--cpt-color)' }}
              >
                Wiki <ExternalLink size={12} />
              </a>
            </div>
          </div>
          {!devUnlocked && devClickCount > 0 && devClickCount < 7 && (
            <p className="text-xs text-gray-400 text-right">{7 - devClickCount} more click{7 - devClickCount !== 1 ? 's' : ''}…</p>
          )}
        </section>

        {/* ── Developer (hidden until unlocked) ── */}
        {devUnlocked && (
          <section className="card p-6 border-2" style={{ borderColor: 'var(--cpt-color)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title" style={{ color: 'var(--cpt-color)' }}>Developer</h2>
              <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--cpt-color)' }}>Unlocked</span>
            </div>
            <div className="space-y-0 divide-y divide-gray-100">
              {renderIndexItems('developer', 'standard')}
              {/* Simulate selector failure */}
              <PrefRow title="Simulate selector failure" description="Force a specific selector key to fail so the resilience cascade can be tested.">
                <input
                  type="text"
                  value={prefs.devSimulateSelectorFailure ?? ''}
                  placeholder="selector key or blank"
                  onChange={e => setPref('devSimulateSelectorFailure', e.target.value || null)}
                  className="input w-48 text-sm font-mono"
                />
              </PrefRow>
            </div>
          </section>
        )}

        </>
        )}
      </div>

      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}

      {reconnectOpen && (
        <ReconnectModal
          account={account}
          onClose={() => setReconnectOpen(false)}
          onSuccess={async () => {
            setReconnectOpen(false)
            setAccount(await getAccount())
            toast('Canvas connection updated successfully', 'success')
          }}
        />
      )}
    </div>
  )
}

function ReconnectModal({ account, onClose, onSuccess }) {
  const [url, setUrl]                           = useState(account.canvasUrl ?? '')
  const [token, setToken]                       = useState('')
  const [showToken, setShowToken]               = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [verifying, setVerifying]               = useState(false)
  const [error, setError]                       = useState(null)

  async function pasteToken() {
    try {
      const text = await navigator.clipboard.readText()
      setToken(text.trim())
    } catch {}
  }

  async function handleVerify() {
    if (!token.trim()) return
    setVerifying(true)
    setError(null)
    try {
      const user = await verifyToken(url.trim(), token.trim())
      await saveAccount({ canvasUrl: url.trim(), token: token.trim(), userName: user.name })
      await markSetupComplete()
      onSuccess()
    } catch (err) {
      setError(err.message ?? 'Could not verify your token. Check the URL and try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Modal
      title="Reconnect Canvas Power Tools"
      subtitle="Enter a new API token to restore your Canvas connection."
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleVerify}
            disabled={!token.trim() || verifying}
          >
            {verifying && <Loader size={13} className="animate-spin" aria-hidden="true" />}
            Verify Token
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="reconnect-url">Canvas URL</label>
          <input
            id="reconnect-url"
            type="url"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(null) }}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="reconnect-token">New API Token</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="reconnect-token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => { setToken(e.target.value); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter' && token.trim()) handleVerify() }}
                placeholder="Paste your token"
                className="input pr-10"
                autoFocus
              />
              <button
                type="button"
                aria-label={showToken ? 'Hide token' : 'Reveal token'}
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              </button>
            </div>
            <button className="btn-secondary" onClick={pasteToken}>Paste</button>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Could not verify token</p>
              <p className="mt-0.5 text-xs text-red-600">{error}</p>
              <p className="mt-1 text-xs text-gray-500">Common causes: token not fully copied, token expired, or incorrect Canvas URL.</p>
            </div>
          </div>
        )}

        <div>
          <button
            type="button"
            aria-expanded={showInstructions}
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--cpt-color)' }}
          >
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={`transition-transform ${showInstructions ? 'rotate-180' : ''}`}
            />
            Need help finding your token?
          </button>
          {showInstructions && (
            <ol className="mt-3 space-y-1.5 text-sm text-gray-700 list-decimal list-inside bg-gray-50 rounded-lg p-4">
              {[
                'Open Canvas and go to Account > Settings',
                'Scroll down to Approved Integrations',
                'Click New Access Token',
                'Enter "Canvas Power Tools" as the purpose',
                'Set expiry to the end of your school year (recommended)',
                'Click Generate Token — copy the token, it is only shown once',
              ].map(step => <li key={step}>{step}</li>)}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  )
}

function StorageBar({ label, used, max }) {
  const pct   = Math.min(100, (used / max) * 100)
  const kb    = (used / 1024).toFixed(1)
  const maxKb = max >= 1024 * 1024 ? `${(max / 1024 / 1024).toFixed(0)} MB` : `${(max / 1024).toFixed(0)} KB`
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{kb} KB of {maxKb}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--cpt-color)' }} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>)


