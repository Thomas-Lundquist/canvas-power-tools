// Builders for cross-tool deep links. Each Tool is its own extension page;
// navigation is a full page load via chrome.runtime.getURL(). Target pages
// read these params on mount (e.g. accommodations reads ?studentId).
//
// Keep every builder here so callers (MissingWork, StudentDrawer, ...) share
// one contract instead of hand-rolling query strings.

function extUrl(page, params) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
  ).toString()
  return chrome.runtime.getURL(qs ? `${page}?${qs}` : page)
}

// Communication → Submission Reminders (Nudge). assignmentId optional: omit it
// to nudge a student about all outstanding work rather than one assignment.
export function nudgeUrl({ courseId, assignmentId, studentIds }) {
  return extUrl('src/pages/submission-reminders/index.html', {
    courseId,
    assignmentId,
    studentIds: Array.isArray(studentIds) ? studentIds.join(',') : studentIds,
  })
}

// People → Accommodations. Pre-selects the student.
export function accommodationUrl({ studentId }) {
  return extUrl('src/pages/accommodations/index.html', { studentId })
}

// Communication → Grade Outreach. Pre-selects course + student.
export function gradeOutreachUrl({ courseId, studentId }) {
  return extUrl('src/pages/grade-outreach/index.html', { courseId, studentId })
}

// Canvas' own per-student grades page. baseUrl comes from getCanvasUrl()
// (src/storage/account.js) — never hardcode the institution domain.
export function canvasStudentGradesUrl(baseUrl, { courseId, userId }) {
  return `${baseUrl.replace(/\/$/, '')}/courses/${courseId}/grades/${userId}`
}
