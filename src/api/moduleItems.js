import { canvasPost } from './request.js'

export async function addAssignmentToModule(courseId, moduleId, assignmentId) {
  return canvasPost(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      type: 'Assignment',
      content_id: assignmentId,
    },
  })
}
