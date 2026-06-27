// Replaces personalization tokens in a message template.
// context: { student, assignment, course, teacherName }
export function resolveTokens(template, { student, assignment, course, teacherName }) {
  const parts = (student.userName ?? '').trim().split(/\s+/)
  const firstName = parts[0] ?? ''
  const lastName  = parts.slice(1).join(' ')

  const dueDate = assignment.dueAt
    ? new Date(assignment.dueAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const scorePct = student.score !== null && student.score !== undefined && assignment.pointsPossible > 0
    ? String(Math.round((student.score / assignment.pointsPossible) * 100))
    : ''

  return template
    .replace(/\{first_name\}/g,       firstName)
    .replace(/\{last_name\}/g,        lastName)
    .replace(/\{teacher_name\}/g,     teacherName ?? '')
    .replace(/\{course_name\}/g,      course?.name ?? '')
    .replace(/\{assignment_name\}/g,  assignment.name ?? '')
    .replace(/\{due_date\}/g,         dueDate)
    .replace(/\{score\}/g,            scorePct)
    .replace(/\{grade\}/g,            String(student.score ?? ''))
    .replace(/\{points_possible\}/g,  String(assignment.pointsPossible ?? ''))
}
