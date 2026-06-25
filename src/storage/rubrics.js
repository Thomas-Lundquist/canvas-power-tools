export async function getRubrics() {
  const sync = await chrome.storage.sync.get('rubrics')
  return sync.rubrics ?? { items: [] }
}

export async function saveRubric(rubric) {
  const data = await getRubrics()
  const idx = data.items.findIndex(r => r.id === rubric.id)
  if (idx >= 0) {
    data.items[idx] = rubric
  } else {
    data.items.push(rubric)
  }
  await chrome.storage.sync.set({ rubrics: data })
  await chrome.storage.local.set({ rubrics: data })
  return data
}

export async function deleteRubric(id) {
  const data = await getRubrics()
  data.items = data.items.filter(r => r.id !== id)
  await chrome.storage.sync.set({ rubrics: data })
  await chrome.storage.local.set({ rubrics: data })
}

export function newRubricId() {
  return `rubric_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function newCriterionId() {
  return `crit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function newRatingId() {
  return `rat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
