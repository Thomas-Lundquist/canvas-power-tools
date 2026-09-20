import { EDITING_ROLES, sortRoles, editingRolesKey } from '../../api/pages.js'

export const EDITING_ROLE_LABELS = {
  teachers: 'Teachers only',
  students: 'Teachers and students',
  members: 'Course members',
  public: 'Anyone',
}

// Canvas stores editing_roles as a set, but the four values form a practical
// ladder from most to least restrictive. Teachers pick a rung, not a set.
export const EDITING_ROLE_PRESETS = [
  { value: 'teachers',          label: EDITING_ROLE_LABELS.teachers, roles: ['teachers'] },
  { value: 'teachers,students', label: EDITING_ROLE_LABELS.students, roles: ['teachers', 'students'] },
  { value: 'teachers,members',  label: EDITING_ROLE_LABELS.members,  roles: ['teachers', 'members'] },
  { value: 'teachers,public',   label: EDITING_ROLE_LABELS.public,   roles: ['teachers', 'public'] },
]

/**
 * Human-readable label for a role set. Falls back to a joined list for sets
 * Canvas produced that don't match a preset (a page edited outside this tool).
 */
export function formatEditingRoles(roles) {
  const key = editingRolesKey(roles ?? [])
  const preset = EDITING_ROLE_PRESETS.find(p => p.value === key)
  if (preset) return preset.label
  if (!key) return 'Teachers only'
  return sortRoles(roles)
    .map(r => r.charAt(0).toUpperCase() + r.slice(1))
    .join(', ')
}

export const EDITOR_LABELS = {
  rce: 'Rich Content',
  block_editor: 'Block',
}

export const INITIAL_ACTIONS = {
  status: null,          // 'publish' | 'unpublish' | null
  editingRoles: '',      // an EDITING_ROLE_PRESETS value, or '' for no change
}

export function countActiveFields(actions) {
  let count = 0
  if (actions.status !== null) count++
  if (actions.editingRoles !== '') count++
  return count
}

/**
 * Builds the per-page, per-field diff rows the preview renders and the apply
 * step writes. A field that already holds the target value produces no row, so
 * the count a teacher sees is the count of pages Canvas will actually change.
 *
 * @param {object[]} selectedPages
 * @param {{ status: string|null, editingRoles: string }} actions
 */
export function buildPageChanges(selectedPages, actions) {
  const changes = []

  for (const page of selectedPages) {
    if (actions.status !== null) {
      const newValue = actions.status === 'publish'
      if (page.published !== newValue) {
        changes.push({
          pageUrl: page.url,
          pageTitle: page.title,
          field: 'published',
          previousValue: page.published,
          newValue,
        })
      }
    }

    if (actions.editingRoles !== '') {
      const preset = EDITING_ROLE_PRESETS.find(p => p.value === actions.editingRoles)
      if (preset && editingRolesKey(page.editingRoles) !== preset.value) {
        changes.push({
          pageUrl: page.url,
          pageTitle: page.title,
          field: 'editingRoles',
          previousValue: page.editingRoles,
          newValue: preset.roles,
        })
      }
    }
  }

  return changes
}

/** Collapses the flat change rows into one entry per page, for display and for
 *  a single PUT per page rather than one per field. */
export function groupChangesByPage(changes) {
  const map = new Map()
  for (const change of changes) {
    if (!map.has(change.pageUrl)) {
      map.set(change.pageUrl, { url: change.pageUrl, title: change.pageTitle, fields: [] })
    }
    map.get(change.pageUrl).fields.push(change)
  }
  return Array.from(map.values())
}

/**
 * Client-side filtering.
 *
 * Published state and title search are *also* pushed to Canvas's query
 * parameters (doc 21, Decision 6); they are re-applied here so the table stays
 * correct between a filter change and the refetch landing. Editing roles and
 * editor type have no server-side equivalent and are filtered only here.
 */
export function applyPageFilters(pages, search, filters) {
  let result = pages

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(p => p.title.toLowerCase().includes(q))
  }

  for (const filter of filters) {
    if (filter.id === 'status') {
      const wantPublished = filter.value.value === 'published'
      result = result.filter(p => p.published === wantPublished)
    }
    if (filter.id === 'editingRoles') {
      result = result.filter(p => editingRolesKey(p.editingRoles) === filter.value.value)
    }
    if (filter.id === 'editor') {
      result = result.filter(p => p.editor === filter.value.value)
    }
  }

  return result
}

/** The `published` query parameter for Canvas's list endpoint: true, false, or
 *  null when no published-state filter is active. */
export function publishedParamFromFilters(filters) {
  const statusFilter = filters.find(f => f.id === 'status')
  if (!statusFilter) return null
  return statusFilter.value.value === 'published'
}

export { EDITING_ROLES, editingRolesKey, sortRoles }
