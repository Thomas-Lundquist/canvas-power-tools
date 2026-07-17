const CURRENT_VERSION = 1

export async function runMigrations() {
  const data = await chrome.storage.local.get('_meta')
  const v = data._meta?.schemaVersion ?? 0

  if (v < 1) {
    const existing = await chrome.storage.local.get('scheduledChecks')
    if (!existing.scheduledChecks) {
      await chrome.storage.local.set({ scheduledChecks: [] })
    }

    const sentData = await chrome.storage.local.get('sentLog')
    if (sentData.sentLog) {
      await chrome.storage.local.set({
        sentLog: sentData.sentLog.map(e => e.source ? e : { ...e, source: 'manual' }),
      })
    }
  }

  await chrome.storage.local.set({ _meta: { schemaVersion: CURRENT_VERSION } })
}
