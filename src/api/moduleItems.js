import { canvasPost } from './request.js'

export async function addAssignmentToModule(courseId, moduleId, assignmentId) {
  return canvasPost(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      type: 'Assignment',
      content_id: assignmentId,
    },
  })
}

// Pages are the one module item type keyed by slug rather than content_id.
export async function addPageToModule(courseId, moduleId, pageUrl) {
  return canvasPost(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      type: 'Page',
      page_url: pageUrl,
    },
  })
}
