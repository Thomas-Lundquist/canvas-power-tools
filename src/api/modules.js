import { canvasGetAll } from './request.js'

export async function getModules(courseId) {
  const modules = await canvasGetAll(`/api/v1/courses/${courseId}/modules`)
  return modules.map(m => ({
    id: String(m.id),
    name: m.name,
    position: m.position,
    published: m.published,
  }))
}
