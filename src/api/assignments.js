import { canvasGetAll, canvasGet, canvasPut, canvasPost, canvasDelete } from './request.js'

export async function getAssignments(courseId, onProgress) {
  const assignments = await canvasGetAll(`/api/v1/courses/${courseId}/assignments`, {
    include: ['assignment_group', 'module_ids'],
    order_by: 'position',
  }, onProgress)
  return assignments.map(mapAssignment)
}

export async function getAssignment(courseId, assignmentId) {
  const assignment = await canvasGet(`/api/v1/courses/${courseId}/assignments/${assignmentId}`)
  return mapAssignment(assignment)
}

export async function createAssignment(courseId, fields) {
  const assignment = await canvasPost(`/api/v1/courses/${courseId}/assignments`, {
    assignment: buildPayload(fields),
  })
  return mapAssignment(assignment)
}

export async function updateAssignment(courseId, assignmentId, fields) {
  const assignment = await canvasPut(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    { assignment: buildPayload(fields) },
  )
  return mapAssignment(assignment)
}

export async function deleteAssignment(courseId, assignmentId) {
  await canvasDelete(`/api/v1/courses/${courseId}/assignments/${assignmentId}`)
}

export async function duplicateAssignment(courseId, assignmentId) {
  const assignment = await canvasPost(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/duplicate`,
  )
  return mapAssignment(assignment)
}

function mapAssignment(raw) {
  return {
    id: String(raw.id),
    courseId: String(raw.course_id),
    name: raw.name,
    description: raw.description ?? '',
    dueAt: raw.due_at,
    unlockAt: raw.unlock_at,
    lockAt: raw.lock_at,
    pointsPossible: raw.points_possible,
    published: raw.published,
    submissionTypes: raw.submission_types ?? [],
    allowedExtensions: raw.allowed_extensions ?? [],
    gradingType: raw.grading_type,
    assignmentGroupId: raw.assignment_group_id ? String(raw.assignment_group_id) : null,
    assignmentGroupName: raw.assignment_group?.name ?? null,
    moduleIds: raw.module_ids ?? [],
    peerReviews: raw.peer_reviews ?? false,
    position: raw.position ?? 0,
  }
}

function buildPayload(fields) {
  const payload = {}
  const map = {
    name: 'name',
    description: 'description',
    dueAt: 'due_at',
    unlockAt: 'unlock_at',
    lockAt: 'lock_at',
    pointsPossible: 'points_possible',
    published: 'published',
    submissionTypes: 'submission_types',
    allowedExtensions: 'allowed_extensions',
    gradingType: 'grading_type',
    assignmentGroupId: 'assignment_group_id',
    peerReviews: 'peer_reviews',
  }
  for (const [jsKey, apiKey] of Object.entries(map)) {
    if (fields[jsKey] !== undefined) payload[apiKey] = fields[jsKey]
  }
  return payload
}
