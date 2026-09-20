import { canvasGet, canvasGetAll, canvasPost, canvasPut, canvasDelete } from './request.js'

// Canvas Pages are addressed by `url` (a slug), not a numeric id — that slug is
// also what a module item references, so callers need it back from create.
//
// `editing_roles` arrives as a comma-separated string ("teachers,students").
// It is normalised to a sorted array here so components never parse it, and
// `editingRolesKey` gives a stable string for grouping, filtering and diffing.
export const EDITING_ROLES = ['teachers', 'students', 'members', 'public']

function parseEditingRoles(raw) {
  if (!raw) return ['teachers']
  const roles = String(raw)
    .split(',')
    .map(r => r.trim())
    .filter(r => EDITING_ROLES.includes(r))
  return roles.length > 0 ? sortRoles(roles) : ['teachers']
}

// Canonical order (EDITING_ROLES order, not alphabetical) so two equivalent
// role sets always produce the same key and the same Canvas payload.
export function sortRoles(roles) {
  return [...new Set(roles)].sort((a, b) => EDITING_ROLES.indexOf(a) - EDITING_ROLES.indexOf(b))
}

export function editingRolesKey(roles) {
  return sortRoles(roles).join(',')
}

function mapPage(page) {
  return {
    id: String(page.page_id ?? ''),
    // `url` is the mutable slug Canvas addresses the page by; every write in
    // this tool targets it rather than page_id.
    url: page.url,
    title: page.title,
    body: page.body ?? '',
    published: !!page.published,
    updatedAt: page.updated_at ?? null,
    createdAt: page.created_at ?? null,
    editingRoles: parseEditingRoles(page.editing_roles),
    // 'rce' | 'block_editor'. Block pages keep their structure in
    // `block_editor_attributes`; writing raw `body` HTML would corrupt them,
    // so the tool surfaces the type and refuses body edits (doc 21, Decision 7).
    editor: page.editor === 'block_editor' ? 'block_editor' : 'rce',
    frontPage: !!page.front_page,
    // Read-only: these reflect *module* locks, never page settings.
    lockedForUser: !!page.locked_for_user,
    lockExplanation: page.lock_explanation ?? null,
    todoDate: page.todo_date ?? null,
  }
  // NOTE: `last_edited_by` is deliberately not mapped. It is student-adjacent
  // PII and doc 21 forbids displaying or storing it.
}

/**
 * List a course's pages.
 *
 * `published` and `searchTerm` are pushed to Canvas's own query parameters
 * (doc 21, Decision 6) rather than filtered client-side. `sort`/`order` are
 * passed through for the same reason; the table's own sort still works over
 * whatever comes back.
 *
 * @param {string} courseId
 * @param {{ searchTerm?: string, published?: boolean|null, sort?: 'title'|'created_at'|'updated_at', order?: 'asc'|'desc' }} [params]
 */
export async function getPages(courseId, params = {}) {
  const query = {}
  if (params.searchTerm) query.search_term = params.searchTerm
  if (params.published === true || params.published === false) query.published = params.published
  if (params.sort) query.sort = params.sort
  if (params.order) query.order = params.order
  const pages = await canvasGetAll(`/api/v1/courses/${courseId}/pages`, query)
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

/**
 * Update one page. Only the fields present in `fields` are sent.
 *
 * Deliberately narrow: `title` is not writable here because renaming a page
 * changes its URL and silently breaks every inbound link (doc 21, Decision 3),
 * and `body` is not writable because it is unsafe on block-editor pages
 * (Decision 7). `publish_at` is feature-flag gated and out of V1 (Decision 2).
 *
 * @param {string} courseId
 * @param {string} pageUrl  the page slug
 * @param {{ published?: boolean, editingRoles?: string[] }} fields
 */
export async function updatePage(courseId, pageUrl, fields) {
  const wikiPage = {}
  if ('published' in fields) wikiPage.published = !!fields.published
  if ('editingRoles' in fields) wikiPage.editing_roles = editingRolesKey(fields.editingRoles)
  const page = await canvasPut(
    `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`,
    { wiki_page: wikiPage },
  )
  return mapPage(page)
}

export async function deletePage(courseId, pageUrl) {
  await canvasDelete(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`)
}

function mapRevision(revision) {
  return {
    id: String(revision.revision_id ?? ''),
    updatedAt: revision.updated_at ?? null,
    latest: !!revision.latest,
    title: revision.title ?? null,
    body: revision.body ?? null,
  }
  // `edited_by` is present on the API object and is not mapped — same reason
  // as `last_edited_by` above.
}

// Revisions are the only real undo Canvas offers on any resource this
// extension touches (doc 21, Decision 5). Newest first, as Canvas returns them.
export async function getPageRevisions(courseId, pageUrl) {
  const revisions = await canvasGetAll(
    `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}/revisions`,
  )
  return revisions.map(mapRevision)
}

// `summary=true` keeps the body out of the response; the revision list only
// needs timestamps. Fetch a full revision when the teacher opens a preview.
export async function getPageRevision(courseId, pageUrl, revisionId, { summary = false } = {}) {
  const revision = await canvasGet(
    `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}/revisions/${revisionId}`,
    summary ? { summary: true } : {},
  )
  return mapRevision(revision)
}

// Reverting creates a *new* revision rather than discarding history, so a
// revert is itself revertable.
export async function revertPageRevision(courseId, pageUrl, revisionId) {
  const revision = await canvasPost(
    `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}/revisions/${revisionId}`,
  )
  return mapRevision(revision)
}
