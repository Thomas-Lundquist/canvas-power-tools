import { canvasPost } from './request.js'

// Send a Canvas Inbox message to a single user.
// One call per recipient is required for per-student personalization.
export async function sendConversation(userId, subject, body, courseId) {
  return canvasPost('/api/v1/conversations', {
    recipients:         [String(userId)],
    subject,
    body,
    group_conversation: false,
    context_code:       `course_${courseId}`,
  })
}
