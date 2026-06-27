const KEY = 'sentLog'
const MAX_ENTRIES = 50

export async function getSentLog() {
  const data = await chrome.storage.local.get(KEY)
  return data[KEY] ?? []
}

export async function addSentLogEntry(entry) {
  const log = await getSentLog()
  const next = [{ id: `msg_${Date.now()}`, timestamp: new Date().toISOString(), ...entry }, ...log]
  await chrome.storage.local.set({ [KEY]: next.slice(0, MAX_ENTRIES) })
}

export async function clearSentLog() {
  await chrome.storage.local.set({ [KEY]: [] })
}
