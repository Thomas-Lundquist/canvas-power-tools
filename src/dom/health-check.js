import { SELECTORS } from './selectors.js'
import { findElement } from './selector-engine.js'

export function detectCanvasVersion() {
  return (
    document.querySelector('meta[name="canvas-version"]')?.content ||
    window.ENV?.CANVAS_VERSION ||
    window.ENV?.canvas_version ||
    document.querySelector('[data-canvas-version]')?.dataset?.canvasVersion ||
    'unknown'
  )
}

export async function runHealthCheck() {
  const results = {}
  for (const [key, config] of Object.entries(SELECTORS)) {
    const element = findElement(key)
    results[key] = {
      status: element ? 'ok' : 'failing',
      description: config.description,
      lastChecked: new Date().toISOString(),
    }
  }
  await chrome.storage.local.set({
    healthCheckResults: results,
    healthCheckTimestamp: new Date().toISOString(),
  })
  return results
}

export async function getHealthCheckResults() {
  const result = await chrome.storage.local.get(['healthCheckResults', 'healthCheckTimestamp'])
  return {
    results: result.healthCheckResults ?? {},
    timestamp: result.healthCheckTimestamp ?? null,
  }
}
