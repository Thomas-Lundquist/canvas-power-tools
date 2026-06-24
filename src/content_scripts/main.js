import { injectBulkEditorButton, injectSaveAsTemplateButton, injectModuleButtons } from './ui-injector.js'
import { isSetupComplete } from '../storage/account.js'

function contextValid() {
  try {
    return !!chrome.runtime?.id
  } catch {
    return false
  }
}

function tryRepeatedly(fn, buttonId, maxAttempts = 20, intervalMs = 500) {
  let attempts = 0
  const interval = setInterval(() => {
    if (!contextValid()) { clearInterval(interval); return }
    attempts++
    fn()
    if (document.getElementById(buttonId) || attempts >= maxAttempts) {
      clearInterval(interval)
    }
  }, intervalMs)
}

function pollModules(maxAttempts = 30, intervalMs = 500) {
  let attempts = 0
  const interval = setInterval(() => {
    if (!contextValid()) { clearInterval(interval); return }
    attempts++
    injectModuleButtons()
    if (attempts >= maxAttempts) clearInterval(interval)
  }, intervalMs)
}

async function init() {
  if (!contextValid()) return
  try {
    const ready = await isSetupComplete()
    if (!ready) return
  } catch {
    return
  }

  const path = window.location.pathname

  if (/\/courses\/\d+\/assignments\b(?!\/\d)/.test(path)) {
    tryRepeatedly(injectBulkEditorButton, 'cpt-bulk-editor-btn')
  }

  if (/\/courses\/\d+\/assignments\/\d+/.test(path)) {
    tryRepeatedly(injectSaveAsTemplateButton, 'cpt-save-template-btn')
  }

  if (/\/courses\/\d+\/modules/.test(path)) {
    pollModules()
  }
}

init()
