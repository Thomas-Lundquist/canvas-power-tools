import { canvasGetAll } from './request.js'

// Returns active student enrollments for a course.
// Foundation for: Group Manager (auto-assign students), At-Risk Dashboard,
// per-student grading views, messaging features.
export async function getEnrollments(courseId, type = 'StudentEnrollment') {
  const enrollments = await canvasGetAll(`/api/v1/courses/${courseId}/enrollments`, {
    type:  [type],
    state: ['active'],
  })
  return enrollments.map(mapEnrollment)
}

// Returns teacher/TA enrollments — useful for multi-instructor course views.
export async function getTeacherEnrollments(courseId) {
  return getEnrollments(courseId, 'TeacherEnrollment')
}

function mapEnrollment(raw) {
  return {
    id:               String(raw.id),
    userId:           String(raw.user_id),
    courseId:         String(raw.course_id),
    type:             raw.type,
    enrollmentState:  raw.enrollment_state,
    userName:         raw.user?.name          ?? null,
    userSortableName: raw.user?.sortable_name ?? null,
    userEmail:        raw.user?.email         ?? null,
    // Future: sections, grades object (current_score, final_score, etc.)
  }
}
