import { canvasGet, canvasGetAll, canvasPost } from './request.js'

// Canvas Pages are addressed by `url` (a slug), not a numeric id — that slug is
// also what a module item references, so callers need it back from create.
function mapPage(page) {
  return {
    id: String(page.page_id ?? ''),
    url: page.url,
    title: page.title,
    body: page.body ?? '',
    published: !!page.published,
    updatedAt: page.updated_at ?? null,
  }
}

export async function getPages(courseId) {
  const pages = await canvasGetAll(`/api/v1/courses/${courseId}/pages`)
  return pages.map(mapPage)
}

// `pageUrl` is the slug from the address bar, not a numeric id. The list
// endpoint omits `body`, so a single fetch is required to capture a page.
export async function getPage(courseId, pageUrl) {
  const page = await canvasGet(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`)
  return mapPage(page)
}

// fields: { title, body, published }
export async function createPage(courseId, fields) {
  const page = await canvasPost(`/api/v1/courses/${courseId}/pages`, {
    wiki_page: {
      title: fields.title,
      body: fields.body ?? '',
      published: !!fields.published,
    },
  })
  return mapPage(page)
}
