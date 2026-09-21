const CURRENT_VERSION = 2

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

  if (v < 2) {
    // The Modern theme was stored as 'default' before it was named. The page-side
    // localStorage copy ('cpt_palette') is normalized by normalizePalette() in
    // color.js, which the service worker cannot reach from here.
    const prefData = await chrome.storage.local.get('preferences')
    if (prefData.preferences?.palette === 'default') {
      await chrome.storage.local.set({
        preferences: { ...prefData.preferences, palette: 'modern' },
      })
    }
  }

  await chrome.storage.local.set({ _meta: { schemaVersion: CURRENT_VERSION } })
}
