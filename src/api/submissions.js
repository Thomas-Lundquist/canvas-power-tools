import { canvasGetAll } from './request.js'

// Returns all assignments for a course enriched with submission_summary counts.
// Used by Grading Dashboard. Future: At-Risk Dashboard, Grade Trend features.
export async function getAssignmentsWithGradingData(courseId) {
  const assignments = await canvasGetAll(`/api/v1/courses/${courseId}/assignments`, {
    include: ['assignment_group', 'submission_summary'],
    order_by: 'position',
  })
  return assignments.map(mapAssignmentWithGrading)
}

// Returns individual submissions for one assignment — per-student detail view.
// Future: grade entry, submission review, at-risk flagging.
export async function getAssignmentSubmissions(courseId, assignmentId) {
  const subs = await canvasGetAll(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
    { include: ['user'], student_ids: ['all'] },
  )
  return subs.map(mapSubmission)
}

// Returns all submissions across all assignments for a course in one call.
// Future: full gradebook table, cross-assignment student views.
export async function getCourseSubmissions(courseId) {
  const subs = await canvasGetAll(
    `/api/v1/courses/${courseId}/students/submissions`,
    { student_ids: ['all'], include: ['assignment'] },
  )
  return subs.map(mapSubmission)
}

function mapAssignmentWithGrading(raw) {
  const s = raw.submission_summary
  return {
    id:                  String(raw.id),
    courseId:            String(raw.course_id),
    name:                raw.name,
    dueAt:               raw.due_at,
    pointsPossible:      raw.points_possible,
    published:           raw.published,
    gradingType:         raw.grading_type,
    submissionTypes:     raw.submission_types ?? [],
    assignmentGroupId:   raw.assignment_group_id ? String(raw.assignment_group_id) : null,
    assignmentGroupName: raw.assignment_group?.name ?? null,
    position:            raw.position ?? 0,
    submissionSummary: s
      ? {
          graded:       s.graded       ?? 0,
          ungraded:     s.ungraded     ?? 0,
          notSubmitted: s.not_submitted ?? 0,
        }
      : null,
  }
}

function mapSubmission(raw) {
  return {
    id:            String(raw.id),
    assignmentId:  String(raw.assignment_id),
    userId:        String(raw.user_id),
    userName:      raw.user?.name            ?? null,
    score:         raw.score,
    grade:         raw.grade,
    workflowState: raw.workflow_state,   // 'submitted'|'unsubmitted'|'graded'|'pending_review'
    submittedAt:   raw.submitted_at,
    gradedAt:      raw.graded_at,
    late:          raw.late    ?? false,
    missing:       raw.missing ?? false,
    excused:       raw.excused ?? false,
  }
}
