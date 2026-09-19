// Background handler for the injected "Add from Template" modal.
//
// Design doc 03, Decision 2: injected buttons are triggers only — the content
// script never touches the Canvas API. Every fetch, the PIN gate, and the audit
// log entry happen here in the service worker.

import { getTemplates, saveTemplate } from '../storage/templates.js'
import { deployTemplateToCourse } from '../modules/assignments/templateHelpers.js'
import { addAssignmentToModule, addPageToModule } from '../api/moduleItems.js'
import { getCourses } from '../api/courses.js'
import { logAuditEntry } from '../security/audit-log.js'
import {
  getSecuritySettings,
  isSessionLocked,
  refreshActivity,
  verifyPin,
  isLockedOut,
  getLockoutRemaining,
  recordFailedAttempt,
  clearFailedAttempts,
} from '../security/pin.js'

// The modal only needs enough to render a picker — never the instructions HTML.
export async function listTemplatesForPicker() {
  const data = await getTemplates()
  return {
    templates: data.items.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type ?? 'assignment',
      folderId: t.folderId ?? null,
      itemName: t.fields?.name ?? '',
      instructions: t.fields?.description ?? '',
      points: t.fields?.points ?? null,
      assignmentGroup: t.fields?.assignmentGroup ?? '',
      lastUsed: t.lastUsed ?? null,
    })),
    folders: data.folders.map(f => ({ id: f.id, name: f.name })),
  }
}

// Runs the gate, then the deploy. Returns one of:
//   { ok: true, ... }              — created
//   { needsPin: true }             — caller must re-send with `pin`
//   { ok: false, error, lockedOut? }
export async function deployFromModule({ templateId, courseId, moduleId, dueAt, publish, tagValues, pin }) {
  const gate = await passGate(pin)
  if (!gate.ok) return gate

  const data = await getTemplates()
  const template = data.items.find(t => t.id === templateId)
  if (!template) return { ok: false, error: 'That template no longer exists.' }

  const course = await resolveCourse(courseId)

  const result = await deployTemplateToCourse(
    template,
    course,
    { dueAt: dueAt || '', unlockAt: '', lockAt: '' },
    publish ?? 'auto',
    tagValues ?? {},
  )

  if (!result.success) return { ok: false, error: result.error }

  let moduleWarning = null
  try {
    if (result.page) {
      await addPageToModule(courseId, moduleId, result.page.url)
    } else {
      await addAssignmentToModule(courseId, moduleId, result.assignment.id)
    }
  } catch (err) {
    // The item exists in the course — only the module placement failed, and the
    // teacher needs to know which half succeeded.
    moduleWarning = `Created in the course, but could not be added to this module (${err.message}).`
  }

  const createdName = result.page?.title ?? result.assignment?.name ?? template.fields?.name ?? template.name

  // Keeps the sync index in step — never write chrome.storage.local directly.
  await saveTemplate({ ...template, lastUsed: new Date().toISOString() })

  await logAuditEntry({
    action: 'template_deploy',
    summary: `Added "${createdName}" to a module in ${course.name} from template "${template.name}"`,
    courseId: String(courseId),
    courseName: course.name,
    pinVerified: gate.pinVerified,
  })
  await refreshActivity()

  return {
    ok: true,
    name: createdName,
    type: template.type === 'page' ? 'page' : 'assignment',
    itemId: result.assignment?.id ?? result.page?.url ?? null,
    warning: result.warning ?? null,
    moduleWarning,
  }
}

// Mirrors usePinGate's logic for a non-React caller (see security/usePinGate.jsx).
async function passGate(pin) {
  const settings = await getSecuritySettings()

  if (!settings.pinEnabled || !settings.pinHash) {
    return { ok: true, pinVerified: 'disabled' }
  }

  if (!(await isSessionLocked())) {
    return { ok: true, pinVerified: true }
  }

  if (!pin) return { needsPin: true, ok: false }

  if (await isLockedOut()) {
    const remaining = await getLockoutRemaining()
    return { ok: false, lockedOut: true, error: `Too many attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.` }
  }

  if (!(await verifyPin(pin))) {
    await recordFailedAttempt()
    if (await isLockedOut()) {
      const remaining = await getLockoutRemaining()
      return { ok: false, lockedOut: true, error: `Too many attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.` }
    }
    return { ok: false, needsPin: true, error: 'Incorrect PIN.' }
  }

  await clearFailedAttempts()
  return { ok: true, pinVerified: true }
}

// The modal only carries a course id; the tag engine wants the course record so
// {course_name} and {course_term} resolve to something real.
async function resolveCourse(courseId) {
  const idStr = String(courseId)
  try {
    const courses = await getCourses()
    const match = courses.find(c => c.id === idStr)
    if (match) return match
  } catch {
    // Fall through — a deploy should not fail just because the course list did.
  }
  return { id: idStr, name: `Course ${idStr}` }
}
