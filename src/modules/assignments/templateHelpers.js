import { getAssignmentGroups, createAssignmentGroup } from '../../api/assignmentGroups.js'
import { createAssignment } from '../../api/assignments.js'
import { createPage } from '../../api/pages.js'
import { newTemplateId } from '../../storage/templates.js'
import { resolveTemplateFields } from './templateTags.js'

export function validateTemplate(fields) {
  const errors = {}
  if (!fields.templateName?.trim()) errors.templateName = 'Template name is required.'
  if (!fields.name?.trim()) errors.name = 'Name is required.'
  if (fields.type === 'page') return errors
  if (fields.points !== '' && fields.points !== null && fields.points !== undefined) {
    if (isNaN(Number(fields.points)) || Number(fields.points) < 0) {
      errors.points = 'Points must be a number of 0 or more.'
    }
  }
  if (fields.submissionType === 'online' && (!fields.allowedFormats || fields.allowedFormats.length === 0)) {
    errors.allowedFormats = 'Select at least one allowed format.'
  }
  return errors
}

export function buildTemplateObject({ templateName, folderId, fields, publishDefault = 'auto', sourceAssignmentId = null, existingId = null }) {
  const type = fields.type === 'page' ? 'page' : 'assignment'
  return {
    id: existingId ?? newTemplateId(),
    type,
    folderId: folderId ?? null,
    name: templateName,
    createdAt: existingId ? undefined : new Date().toISOString(),
    lastUsed: null,
    sourceAssignmentId,
    publishDefault,
    fields: type === 'page'
      ? {
        name: fields.name,
        description: fields.description ?? '',
      }
      : {
        name: fields.name,
        description: fields.description ?? '',
        points: fields.points !== '' && fields.points !== null ? Number(fields.points) : null,
        submissionType: fields.submissionType ?? 'online',
        allowedFormats: fields.allowedFormats ?? [],
        assignmentGroup: fields.assignmentGroup ?? '',
        gradingType: fields.gradingType ?? 'points',
        peerReview: fields.peerReview ?? false,
      },
  }
}

export function templateToFormFields(template) {
  return {
    type: template.type === 'page' ? 'page' : 'assignment',
    templateName: template.name,
    folderId: template.folderId ?? null,
    publishDefault: template.publishDefault ?? 'auto',
    name: template.fields.name,
    description: template.fields.description ?? '',
    points: template.fields.points ?? '',
    submissionType: template.fields.submissionType ?? 'online',
    allowedFormats: template.fields.allowedFormats ?? [],
    assignmentGroup: template.fields.assignmentGroup ?? '',
    gradingType: template.fields.gradingType ?? 'points',
    peerReview: template.fields.peerReview ?? false,
  }
}

// Builds form fields pre-filled from a Canvas assignment object
export function assignmentToFormFields(assignment) {
  const onlineFormats = {
    online_text_entry: true,
    online_upload: true,
    online_url: true,
    media_recording: true,
  }
  const allowedFormats = (assignment.submissionTypes ?? []).filter(t => onlineFormats[t])
  return {
    type: 'assignment',
    templateName: assignment.name,
    folderId: null,
    publishDefault: 'auto',
    name: assignment.name,
    description: assignment.description ?? '',
    points: assignment.pointsPossible ?? '',
    submissionType: (assignment.submissionTypes ?? []).includes('online') ||
                    (assignment.submissionTypes ?? []).some(t => onlineFormats[t])
                      ? 'online'
                      : (assignment.submissionTypes?.[0] ?? 'online'),
    allowedFormats,
    assignmentGroup: assignment.assignmentGroupName ?? '',
    gradingType: assignment.gradingType ?? 'points',
    peerReview: assignment.peerReviews ?? false,
  }
}

// Resolves the template's assignment group for one course by name, creating the
// group when no match exists (design doc 03, Decision 9 — a silent fall-through
// to the default bucket can quietly change a course's grade weighting).
// Returns { groupId, warning }.
async function resolveAssignmentGroup(courseId, groupName) {
  const wanted = (groupName ?? '').trim()
  if (!wanted) return { groupId: null, warning: null }

  const groups = await getAssignmentGroups(courseId)
  const matched = groups.find(g => g.name.toLowerCase() === wanted.toLowerCase())
  if (matched) return { groupId: matched.id, warning: null }

  try {
    const created = await createAssignmentGroup(courseId, { name: wanted })
    return { groupId: created.id, warning: `Created assignment group "${wanted}".` }
  } catch (err) {
    // Creating the group is best-effort: a failure here should not cost the
    // teacher the assignment itself, but it must be reported, since the item
    // lands in the course's default group instead.
    return {
      groupId: null,
      warning: `Could not create assignment group "${wanted}" (${err.message}) — placed in the course's default group.`,
    }
  }
}

// Builds form fields pre-filled from a Canvas page object (api/pages.js shape).
// A page template carries no assignment fields at all.
export function pageToFormFields(page) {
  return {
    type: 'page',
    templateName: page.title ?? '',
    folderId: null,
    publishDefault: 'auto',
    name: page.title ?? '',
    description: page.body ?? '',
    points: '',
    submissionType: 'online',
    allowedFormats: [],
    assignmentGroup: '',
    gradingType: 'points',
    peerReview: false,
  }
}

// Deploys one template to one course.
// Returns { courseId, courseName, success, assignment?, page?, warning?, error? }
//
// publishOverride: 'auto' (published if due date set) | 'published' | 'unpublished'
// tagValues: prompted tag values, shared across courses; auto tags resolve per course.
export async function deployTemplateToCourse(template, course, dates, publishOverride = 'unpublished', tagValues = {}) {
  try {
    const published = publishOverride === 'published' ? true
      : publishOverride === 'unpublished' ? false
      : !!dates.dueAt

    // Auto tags are resolved against *this* course, so {course_name} and
    // {due_date} differ correctly across a multi-course deploy.
    const fields = resolveTemplateFields(
      template.fields,
      { course, dueAt: dates.dueAt ? toCanvasDate(dates.dueAt) : null },
      tagValues,
    )

    if (template.type === 'page') {
      const page = await createPage(course.id, {
        title: fields.name,
        body: fields.description,
        published,
      })
      return { courseId: course.id, courseName: course.name, success: true, page }
    }

    const { groupId, warning } = await resolveAssignmentGroup(course.id, fields.assignmentGroup)

    const payload = {
      name: fields.name,
      description: fields.description,
      pointsPossible: fields.points,
      submissionTypes: buildSubmissionTypes(fields),
      gradingType: fields.gradingType,
      peerReviews: fields.peerReview,
      published,
    }

    if (groupId) payload.assignmentGroupId = groupId
    if (dates.dueAt) payload.dueAt = toCanvasDate(dates.dueAt)
    if (dates.unlockAt) payload.unlockAt = toCanvasDate(dates.unlockAt)
    if (dates.lockAt) payload.lockAt = toCanvasDate(dates.lockAt)

    const created = await createAssignment(course.id, payload)
    return { courseId: course.id, courseName: course.name, success: true, assignment: created, warning }
  } catch (err) {
    return { courseId: course.id, courseName: course.name, success: false, error: err.message }
  }
}

function toCanvasDate(dateStr) {
  return `${dateStr}T23:59:00Z`
}

function buildSubmissionTypes(fields) {
  if (fields.submissionType === 'online') {
    return fields.allowedFormats?.length > 0 ? fields.allowedFormats : ['online_upload']
  }
  return [fields.submissionType]
}
