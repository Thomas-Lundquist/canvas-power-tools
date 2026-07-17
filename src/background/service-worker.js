import { getPreferences }          from '../storage/preferences.js'
import { purgeOldChangeLogs }      from '../storage/changeLogs.js'
import { runMigrations }           from '../storage/migrations.js'
import { getScheduledChecks, updateScheduleAfterRun } from '../storage/scheduledChecks.js'
import { addSentLogEntry }         from '../storage/sentLog.js'
import { logAuditEntry }           from '../security/audit-log.js'
import { sendConversation }        from '../api/conversations.js'
import { getEnrollmentsWithGrades } from '../api/enrollments.js'
import { getAssignmentSubmissions } from '../api/submissions.js'
import { getAssignments }          from '../api/assignments.js'
import { resolveTokens, resolveOverallTokens } from '../modules/communication/tokenHelpers.js'

function ensureAlarms() {
  chrome.alarms.get('purgeChangeLogs', alarm => {
    if (!alarm) chrome.alarms.create('purgeChangeLogs', { periodInMinutes: 1440 })
  })
  chrome.alarms.get('runScheduledChecks', alarm => {
    if (!alarm) chrome.alarms.create('runScheduledChecks', { periodInMinutes: 60 })
  })
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await runMigrations()
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding/index.html') })
  }
  ensureAlarms()
})

chrome.runtime.onStartup.addListener(async () => {
  await runMigrations()
  ensureAlarms()
})

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'purgeChangeLogs') {
    try {
      const prefs = await getPreferences()
      if (prefs.changeLogAutoClearOlderThan) {
        await purgeOldChangeLogs(prefs.changeLogAutoClearOlderThan)
      }
    } catch {}
    return
  }

  if (alarm.name === 'runScheduledChecks') {
    await runDueSchedules()
  }
})

// Open extension pages from content script messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL(message.path) })
    sendResponse({ ok: true })
  }
})

// ─── Schedule Runner ──────────────────────────────────────────────────────────

async function runDueSchedules() {
  const schedules = await getScheduledChecks()
  const now = new Date()
  const due = schedules.filter(s => s.enabled && s.authorized && new Date(s.nextRunAt) <= now)
  for (const schedule of due) {
    await runOneSchedule(schedule)
  }
}

async function runOneSchedule(schedule) {
  try {
    const recipients = await fetchRecipients(schedule)

    if (recipients.length === 0) {
      await updateScheduleAfterRun(schedule.id, {
        lastRunResult: 'skipped',
        lastRunSentCount: 0,
        lastRunError: null,
      })
      return
    }

    let sent = 0
    for (const student of recipients) {
      const body = resolveBodyForSchedule(schedule, student)
      await sendConversation(student.userId, schedule.subject, body, schedule.courseId)
      sent++
    }

    await addSentLogEntry({
      type: schedule.toolType,
      assignmentId: schedule.assignmentId ?? null,
      assignmentName: schedule.assignmentName ?? null,
      courseId: schedule.courseId,
      courseName: schedule.courseName,
      recipientCount: sent,
      recipients: recipients.map(r => ({ id: r.userId, name: r.userName ?? '' })),
      messageBody: schedule.messageBody,
      source: 'scheduled',
      scheduleId: schedule.id,
      meta: buildMetaForSchedule(schedule),
    })

    await logAuditEntry({
      action: 'scheduled_send',
      summary: `Scheduled check sent ${sent} message${sent !== 1 ? 's' : ''} in ${schedule.courseName}`,
      courseId: schedule.courseId,
      courseName: schedule.courseName,
      pinVerified: 'pre-authorized',
    })

    const prefs = await getPreferences()
    if (prefs.scheduledCheckNotifications && sent > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('public/icons/icon-48.png'),
        title: 'Canvas Power Tools',
        message: `Scheduled check ran: ${sent} message${sent !== 1 ? 's' : ''} sent in ${schedule.courseName}`,
      })
    }

    await updateScheduleAfterRun(schedule.id, {
      lastRunResult: 'ok',
      lastRunSentCount: sent,
      lastRunError: null,
    })
  } catch (err) {
    await updateScheduleAfterRun(schedule.id, {
      lastRunResult: 'error',
      lastRunSentCount: 0,
      lastRunError: String(err?.message ?? 'Unknown error').slice(0, 120),
    })
  }
}

async function fetchRecipients(schedule) {
  const { toolType, courseId, assignmentId, direction, thresholdPct, scoreType, daysAhead } = schedule

  if (toolType === 'grade-outreach-assignment') {
    const subs = await getAssignmentSubmissions(courseId, assignmentId)
    return subs.filter(s => {
      if (s.excused || s.score === null || s.score === undefined) return false
      if (!schedule.assignmentPointsPossible || schedule.assignmentPointsPossible <= 0) return false
      const pct = (s.score / schedule.assignmentPointsPossible) * 100
      return direction === 'below' ? pct < thresholdPct : pct > thresholdPct
    })
  }

  if (toolType === 'grade-outreach-overall') {
    const enrollments = await getEnrollmentsWithGrades(courseId)
    return enrollments.filter(e => {
      const score = scoreType === 'final' ? e.finalScore : e.currentScore
      if (score === null || score === undefined) return false
      return direction === 'below' ? score < thresholdPct : score > thresholdPct
    })
  }

  if (toolType === 'submission-reminder-specific') {
    const subs = await getAssignmentSubmissions(courseId, assignmentId)
    return subs.filter(s => !s.excused && (s.missing || s.workflowState === 'unsubmitted'))
  }

  if (toolType === 'submission-reminder-upcoming') {
    const assignments = await getAssignments(courseId)
    const now = new Date()
    const cutoff = new Date(now.getTime() + (daysAhead ?? 7) * 86400000)
    const upcoming = assignments.filter(a => {
      if (!a.dueAt) return false
      const due = new Date(a.dueAt)
      return due > now && due <= cutoff
    })

    const seen = new Set()
    const results = []
    for (const assignment of upcoming) {
      const subs = await getAssignmentSubmissions(courseId, assignment.id)
      for (const s of subs) {
        if (!s.excused && (s.missing || s.workflowState === 'unsubmitted') && !seen.has(s.userId)) {
          seen.add(s.userId)
          results.push({
            ...s,
            _assignmentName: assignment.name,
            _dueAt: assignment.dueAt,
            _assignmentPointsPossible: assignment.pointsPossible,
          })
        }
      }
    }
    return results
  }

  return []
}

function resolveBodyForSchedule(schedule, student) {
  const course = { name: schedule.courseName }
  const teacherName = schedule.teacherName ?? ''

  if (schedule.toolType === 'grade-outreach-overall') {
    return resolveOverallTokens(schedule.messageBody, {
      student,
      course,
      teacherName,
      scoreType: schedule.scoreType,
    })
  }

  const assignment = {
    name: student._assignmentName ?? schedule.assignmentName ?? '',
    dueAt: student._dueAt ?? schedule.assignmentDueAt ?? null,
    pointsPossible: student._assignmentPointsPossible ?? schedule.assignmentPointsPossible ?? 0,
  }
  return resolveTokens(schedule.messageBody, { student, assignment, course, teacherName })
}

function buildMetaForSchedule(schedule) {
  if (schedule.toolType === 'grade-outreach-assignment') {
    return { direction: schedule.direction, thresholdPct: schedule.thresholdPct }
  }
  if (schedule.toolType === 'grade-outreach-overall') {
    return { direction: schedule.direction, thresholdPct: schedule.thresholdPct, scoreType: schedule.scoreType }
  }
  if (schedule.toolType === 'submission-reminder-upcoming') {
    return { daysAhead: schedule.daysAhead }
  }
  return {}
}
