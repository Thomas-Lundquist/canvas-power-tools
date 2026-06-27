const DRAFTS_KEY = 'announcementDrafts'
const TEMPLATES_KEY = 'announcementTemplates'
const MAX_DRAFTS = 20

// --- Drafts ---

export async function getDrafts() {
  const data = await chrome.storage.local.get(DRAFTS_KEY)
  return data[DRAFTS_KEY] ?? []
}

export async function saveDraft(draft) {
  const drafts = await getDrafts()
  const i = drafts.findIndex(d => d.id === draft.id)
  const entry = { ...draft, savedAt: new Date().toISOString() }
  if (i >= 0) {
    drafts[i] = entry
  } else {
    drafts.unshift({ id: `draft_${Date.now()}`, ...entry })
  }
  await chrome.storage.local.set({ [DRAFTS_KEY]: drafts.slice(0, MAX_DRAFTS) })
}

export async function deleteDraft(id) {
  const drafts = await getDrafts()
  await chrome.storage.local.set({ [DRAFTS_KEY]: drafts.filter(d => d.id !== id) })
}

// --- Announcement Templates ---

export async function getAnnouncementTemplates() {
  const data = await chrome.storage.local.get(TEMPLATES_KEY)
  return data[TEMPLATES_KEY] ?? []
}

export async function saveAnnouncementTemplate(template) {
  const templates = await getAnnouncementTemplates()
  const i = templates.findIndex(t => t.id === template.id)
  if (i >= 0) {
    templates[i] = template
  } else {
    templates.push({ id: `at_${Date.now()}`, createdAt: new Date().toISOString(), ...template })
  }
  await chrome.storage.local.set({ [TEMPLATES_KEY]: templates })
}

export async function deleteAnnouncementTemplate(id) {
  const templates = await getAnnouncementTemplates()
  await chrome.storage.local.set({ [TEMPLATES_KEY]: templates.filter(t => t.id !== id) })
}
