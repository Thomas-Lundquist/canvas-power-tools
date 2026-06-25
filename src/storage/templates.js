const LOCAL_KEY = 'templates'
const SYNC_INDEX_KEY = 'templateIndex'

// Lightweight index written to sync — ids/names only, no content fields
function buildIndex(data) {
  return {
    folders: data.folders.map(f => ({ id: f.id, name: f.name })),
    items: data.items.map(t => ({ id: t.id, name: t.name, folderId: t.folderId })),
  }
}

async function persist(data) {
  await chrome.storage.local.set({ [LOCAL_KEY]: data })
  await chrome.storage.sync.set({ [SYNC_INDEX_KEY]: buildIndex(data) })
  return data
}

export async function getTemplates() {
  const local = await chrome.storage.local.get(LOCAL_KEY)
  if (local[LOCAL_KEY]) return local[LOCAL_KEY]

  // One-time migration: old installs stored full data under chrome.storage.sync.templates
  const sync = await chrome.storage.sync.get('templates')
  if (sync.templates) {
    await persist(sync.templates)
    await chrome.storage.sync.remove('templates')
    return sync.templates
  }

  return { folders: [], items: [] }
}

export async function saveTemplate(template) {
  const data = await getTemplates()
  const i = data.items.findIndex(t => t.id === template.id)
  if (i >= 0) {
    data.items[i] = template
  } else {
    data.items.push(template)
  }
  return persist(data)
}

export async function deleteTemplate(templateId) {
  const data = await getTemplates()
  data.items = data.items.filter(t => t.id !== templateId)
  await persist(data)
}

export async function saveFolder(folder) {
  const data = await getTemplates()
  const i = data.folders.findIndex(f => f.id === folder.id)
  if (i >= 0) {
    data.folders[i] = folder
  } else {
    data.folders.push(folder)
  }
  return persist(data)
}

export async function deleteFolder(folderId) {
  const data = await getTemplates()
  data.folders = data.folders.filter(f => f.id !== folderId)
  data.items = data.items.map(t => t.folderId === folderId ? { ...t, folderId: null } : t)
  await persist(data)
}

export function newTemplateId() {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function newFolderId() {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
