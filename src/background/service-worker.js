import { getPreferences } from '../storage/preferences.js'
import { purgeOldChangeLogs } from '../storage/changeLogs.js'

function ensurePurgeAlarm() {
  chrome.alarms.get('purgeChangeLogs', alarm => {
    if (!alarm) chrome.alarms.create('purgeChangeLogs', { periodInMinutes: 1440 })
  })
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding/index.html') })
  }
  ensurePurgeAlarm()
})

chrome.runtime.onStartup.addListener(ensurePurgeAlarm)

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'purgeChangeLogs') return
  try {
    const prefs = await getPreferences()
    if (prefs.changeLogAutoClearOlderThan) {
      await purgeOldChangeLogs(prefs.changeLogAutoClearOlderThan)
    }
  } catch {}
})

// Open extension pages from content script messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL(message.path) })
    sendResponse({ ok: true })
  }
})
