import { canvasGetAll, canvasPost, canvasPut, canvasDelete } from './request.js'

// Returns all assignments for a course with their overrides embedded.
// Efficient: one paginated request instead of one per assignment.
export async function getAssignmentsWithOverrides(courseId) {
  const assignments = await canvasGetAll(`/api/v1/courses/${courseId}/assignments`, {
    include: ['overrides'],
    order_by: 'position',
  })
  return assignments.map(mapAssignmentWithOverrides)
}

// Returns all overrides for a single assignment.
export async function getAssignmentOverrides(courseId, assignmentId) {
  const overrides = await canvasGetAll(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides`,
  )
  return overrides.map(mapOverride)
}

// Creates a student-level override for one assignment.
export async function createStudentOverride(courseId, assignmentId, studentId, dates) {
  return canvasPost(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides`,
    { assignment_override: { student_ids: [String(studentId)], ...mapDateBody(dates) } },
  )
}

// Updates an existing override.
export async function updateOverride(courseId, assignmentId, overrideId, dates) {
  return canvasPut(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides/${overrideId}`,
    { assignment_override: mapDateBody(dates) },
  )
}

// Deletes an override (restores standard due date for that student/section).
export async function deleteOverride(courseId, assignmentId, overrideId) {
  return canvasDelete(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides/${overrideId}`,
  )
}

// Creates a section-level override for one assignment.
export async function createSectionOverride(courseId, assignmentId, sectionId, dates) {
  return canvasPost(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides`,
    { assignment_override: { course_section_id: String(sectionId), ...mapDateBody(dates) } },
  )
}

// Updates an existing section override.
export async function updateSectionOverride(courseId, assignmentId, overrideId, dates) {
  return canvasPut(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides/${overrideId}`,
    { assignment_override: mapDateBody(dates) },
  )
}

function mapDateBody({ dueAt, unlockAt, lockAt }) {
  return {
    due_at:    dueAt    ?? null,
    unlock_at: unlockAt ?? null,
    lock_at:   lockAt   ?? null,
  }
}

function mapOverride(raw) {
  return {
    id:              String(raw.id),
    assignmentId:    String(raw.assignment_id),
    title:           raw.title ?? null,
    studentIds:      raw.student_ids ? raw.student_ids.map(String) : null,
    courseSectionId: raw.course_section_id ? String(raw.course_section_id) : null,
    dueAt:           raw.due_at    ?? null,
    unlockAt:        raw.unlock_at ?? null,
    lockAt:          raw.lock_at   ?? null,
  }
}

function mapAssignmentWithOverrides(raw) {
  return {
    id:           String(raw.id),
    name:         raw.name,
    dueAt:        raw.due_at ?? null,
    unlockAt:     raw.unlock_at ?? null,
    lockAt:       raw.lock_at ?? null,
    pointsPossible: raw.points_possible,
    published:    raw.published,
    position:     raw.position ?? 0,
    overrides:    (raw.overrides ?? []).map(mapOverride),
  }
}
