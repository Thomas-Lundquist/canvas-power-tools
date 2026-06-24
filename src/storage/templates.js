export async function getTemplates() {
  const sync = await chrome.storage.sync.get('templates')
  return sync.templates ?? { folders: [], items: [] }
}

export async function saveTemplate(template) {
  const data = await getTemplates()
  const existing = data.items.findIndex(t => t.id === template.id)
  if (existing >= 0) {
    data.items[existing] = template
  } else {
    data.items.push(template)
  }
  await chrome.storage.sync.set({ templates: data })
  await chrome.storage.local.set({ templates: data })
  return data
}

export async function deleteTemplate(templateId) {
  const data = await getTemplates()
  data.items = data.items.filter(t => t.id !== templateId)
  await chrome.storage.sync.set({ templates: data })
  await chrome.storage.local.set({ templates: data })
}

export async function saveFolder(folder) {
  const data = await getTemplates()
  const existing = data.folders.findIndex(f => f.id === folder.id)
  if (existing >= 0) {
    data.folders[existing] = folder
  } else {
    data.folders.push(folder)
  }
  await chrome.storage.sync.set({ templates: data })
  await chrome.storage.local.set({ templates: data })
}

export async function deleteFolder(folderId) {
  const data = await getTemplates()
  data.folders = data.folders.filter(f => f.id !== folderId)
  data.items = data.items.map(t => t.folderId === folderId ? { ...t, folderId: null } : t)
  await chrome.storage.sync.set({ templates: data })
  await chrome.storage.local.set({ templates: data })
}

export function newTemplateId() {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function newFolderId() {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
