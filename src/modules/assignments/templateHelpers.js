import { getAssignmentGroups } from '../../api/assignmentGroups.js'
import { createAssignment } from '../../api/assignments.js'
import { newTemplateId } from '../../storage/templates.js'

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

// Deploys one template to one course, returns { courseId, courseName, success, warning?, error? }
// publishOverride: 'auto' (published if due date set) | 'published' | 'unpublished'
export async function deployTemplateToCourse(template, course, dates, publishOverride = 'unpublished') {
  try {
    const groups = await getAssignmentGroups(course.id)
    const matchedGroup = groups.find(g =>
      g.name.toLowerCase() === (template.fields.assignmentGroup ?? '').toLowerCase()
    )

    const groupWarning = template.fields.assignmentGroup && !matchedGroup
      ? `Assignment group "${template.fields.assignmentGroup}" not found — created in Ungrouped.`
      : null

    const published = publishOverride === 'published' ? true
      : publishOverride === 'unpublished' ? false
      : !!dates.dueAt

    const payload = {
      name: template.fields.name,
      description: template.fields.description,
      pointsPossible: template.fields.points,
      submissionTypes: buildSubmissionTypes(template.fields),
      gradingType: template.fields.gradingType,
      peerReviews: template.fields.peerReview,
      published,
    }

    if (matchedGroup) payload.assignmentGroupId = matchedGroup.id
    if (dates.dueAt) payload.dueAt = `${dates.dueAt}T23:59:00Z`
    if (dates.unlockAt) payload.unlockAt = `${dates.unlockAt}T23:59:00Z`
    if (dates.lockAt) payload.lockAt = `${dates.lockAt}T23:59:00Z`

    const created = await createAssignment(course.id, payload)
    return { courseId: course.id, courseName: course.name, success: true, assignment: created, warning: groupWarning }
  } catch (err) {
    return { courseId: course.id, courseName: course.name, success: false, error: err.message }
  }
}

function buildSubmissionTypes(fields) {
  if (fields.submissionType === 'online') {
    return fields.allowedFormats?.length > 0 ? fields.allowedFormats : ['online_upload']
  }
  return [fields.submissionType]
}
