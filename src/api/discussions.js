import { canvasPost } from './request.js'

// Create an announcement in a Canvas course.
// delayed_post_at: ISO timestamp for scheduled send, or null for immediate.
export async function createAnnouncement(courseId, { title, message, delayed_post_at = null }) {
  return canvasPost(`/api/v1/courses/${courseId}/discussion_topics`, {
    title,
    message,
    is_announcement: true,
    published:       true,
    delayed_post_at,
  })
}
