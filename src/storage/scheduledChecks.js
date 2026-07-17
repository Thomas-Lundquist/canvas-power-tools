const KEY = 'scheduledChecks'

// Computes the next ISO timestamp a schedule should run, starting from fromDate.
// Exported so the service worker can reuse it after each run.
export function computeNextRunAt(schedule, fromDate = new Date()) {
  const next = new Date(fromDate)
  next.setMinutes(0, 0, 0)

  if (schedule.cadence === 'daily') {
    if (next.getHours() >= schedule.runHour) next.setDate(next.getDate() + 1)
    next.setHours(schedule.runHour)
  } else {
    const currentDay = next.getDay()
    let daysUntil = (schedule.runDayOfWeek - currentDay + 7) % 7
    if (daysUntil === 0 && next.getHours() >= schedule.runHour) daysUntil = 7
    next.setDate(next.getDate() + daysUntil)
    next.setHours(schedule.runHour)
  }

  return next.toISOString()
}

async function load() {
  const data = await chrome.storage.local.get(KEY)
  return data[KEY] ?? []
}

async function save(checks) {
  await chrome.storage.local.set({ [KEY]: checks })
}

export async function getScheduledChecks() {
  return load()
}

export async function getScheduledChecksByTool(toolType) {
  const all = await load()
  return all.filter(s => s.toolType === toolType)
}

export async function addScheduledCheck(partial) {
  const all = await load()
  const now = new Date()
  const check = {
    ...partial,
    id: `sched_${Date.now()}`,
    createdAt: now.toISOString(),
    authorized: true,
    lastRunAt: null,
    lastRunResult: null,
    lastRunSentCount: null,
    lastRunError: null,
    nextRunAt: computeNextRunAt(partial, now),
  }
  await save([...all, check])
  return check
}

export async function updateScheduledCheck(id, patch) {
  const all = await load()
  const idx = all.findIndex(s => s.id === id)
  if (idx === -1) throw new Error(`Schedule ${id} not found`)
  const updated = { ...all[idx], ...patch }
  if (patch.cadence || patch.runDayOfWeek !== undefined || patch.runHour !== undefined) {
    updated.nextRunAt = computeNextRunAt(updated)
  }
  const next = [...all]
  next[idx] = updated
  await save(next)
  return updated
}

export async function deleteScheduledCheck(id) {
  const all = await load()
  await save(all.filter(s => s.id !== id))
}

export async function toggleScheduledCheck(id, enabled) {
  return updateScheduledCheck(id, { enabled })
}

export async function updateScheduleAfterRun(id, { lastRunResult, lastRunSentCount, lastRunError }) {
  const all = await load()
  const idx = all.findIndex(s => s.id === id)
  if (idx === -1) return
  const now = new Date()
  const schedule = all[idx]
  const next = [...all]
  next[idx] = {
    ...schedule,
    lastRunAt: now.toISOString(),
    lastRunResult,
    lastRunSentCount,
    lastRunError: lastRunError ?? null,
    nextRunAt: computeNextRunAt(schedule, now),
  }
  await save(next)
}
