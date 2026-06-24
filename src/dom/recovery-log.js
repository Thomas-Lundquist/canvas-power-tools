const MAX_ENTRIES = 100
const KEY = 'domLog'

export async function logRecovery(event) {
  await appendToLog({ type: 'recovery', timestamp: new Date().toISOString(), ...event })
}

export async function logFailure(event) {
  await appendToLog({ type: 'failure', timestamp: new Date().toISOString(), recovered: false, ...event })
}

async function appendToLog(entry) {
  const result = await chrome.storage.local.get(KEY)
  const log = (result[KEY] ?? [])
  const trimmed = [entry, ...log].slice(0, MAX_ENTRIES)
  await chrome.storage.local.set({ [KEY]: trimmed })
}

export async function getLog() {
  const result = await chrome.storage.local.get(KEY)
  return result[KEY] ?? []
}

export async function clearLog() {
  await chrome.storage.local.set({ [KEY]: [] })
}
