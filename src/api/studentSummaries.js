import { getEnrollmentsWithGrades } from './enrollments.js'
import { getCourseSubmissions } from './submissions.js'

// Returns one summary row per active student in a course, combining overall
// course grade (from enrollments) with cross-assignment submission counts
// (missing / ungraded / late). Powers the Grading Dashboard "By Student" lens
// and the per-student action hub.
//
// Read-only and transient: the caller holds the result in React state and
// discards it. Nothing here is written to chrome.storage (student PII rule).
export async function getStudentGradeSummaries(courseId) {
  const [enrollments, submissions] = await Promise.all([
    getEnrollmentsWithGrades(courseId),
    getCourseSubmissions(courseId),
  ])

  const byStudent = groupSubmissionsByStudent(submissions)

  return enrollments.map(e => {
    const counts = byStudent.get(e.userId) ?? emptyCounts()
    return {
      userId:           e.userId,
      userName:         e.userName,
      userSortableName: e.userSortableName,
      userEmail:        e.userEmail,
      currentScore:     e.currentScore,
      currentGrade:     e.currentGrade,
      finalScore:       e.finalScore,
      ...counts,
    }
  })
}

function emptyCounts() {
  return { missing: 0, ungraded: 0, late: 0, submitted: 0, total: 0 }
}

// Reduce the flat submission list into per-student tallies keyed by userId.
// Excused work counts toward none of missing/ungraded/late — the teacher has
// already resolved it.
function groupSubmissionsByStudent(submissions) {
  const map = new Map()
  for (const s of submissions) {
    let c = map.get(s.userId)
    if (!c) { c = emptyCounts(); map.set(s.userId, c) }

    c.total += 1
    if (s.submittedAt) c.submitted += 1
    if (s.excused) continue

    if (s.missing) c.missing += 1
    if (s.late) c.late += 1
    if (isUngraded(s)) c.ungraded += 1
  }
  return map
}

// Submitted work that still awaits a score. 'pending_review' covers quiz/
// survey types Canvas holds for manual grading.
function isUngraded(s) {
  const awaiting = s.workflowState === 'submitted' || s.workflowState === 'pending_review'
  return awaiting && s.score == null
}
