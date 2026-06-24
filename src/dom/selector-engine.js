import { SELECTORS } from './selectors.js'
import { logRecovery, logFailure } from './recovery-log.js'
import { detectCanvasVersion } from './health-check.js'

export function findElement(selectorKey) {
  const config = SELECTORS[selectorKey]
  if (!config) {
    console.warn(`[Canvas Power Tools] Unknown selector key: ${selectorKey}`)
    return null
  }

  for (let i = 0; i < config.strategies.length; i++) {
    const el = document.querySelector(config.strategies[i])
    if (el) {
      if (i > 0) {
        logRecovery({
          selectorKey,
          strategyIndex: i,
          strategyUsed: config.strategies[i],
          method: 'css_fallback',
          canvasVersion: detectCanvasVersion(),
          pageUrl: window.location.pathname,
        })
      }
      return el
    }
  }

  if (config.fallback === 'structural' && config.structuralHint) {
    const el = structuralSearch(config.structuralHint)
    if (el) {
      logRecovery({ selectorKey, method: 'structural_fallback', canvasVersion: detectCanvasVersion(), pageUrl: window.location.pathname })
      return el
    }
  }

  if (config.fallback === 'proximity' && config.proximityHint) {
    const el = proximitySearch(config.proximityHint)
    if (el) {
      logRecovery({ selectorKey, method: 'proximity_fallback', canvasVersion: detectCanvasVersion(), pageUrl: window.location.pathname })
      return el
    }
  }

  logFailure({
    selectorKey,
    canvasVersion: detectCanvasVersion(),
    pageUrl: window.location.pathname,
    allStrategiesAttempted: config.strategies,
  })
  return null
}

function structuralSearch({ container, childSelector, minChildren = 1 }) {
  for (const candidate of document.querySelectorAll(container)) {
    if (candidate.querySelectorAll(childSelector).length >= minChildren) return candidate
  }
  return null
}

function proximitySearch({ anchor, position }) {
  const anchors = document.querySelectorAll(anchor)
  for (const a of anchors) {
    if (position === 'self') return a
  }
  return null
}
