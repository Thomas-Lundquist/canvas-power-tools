// Strips all PII before any data is used in reports or diagnostic exports

export function filterForReport(logEntries) {
  return logEntries.map(entry => ({
    type: entry.type,
    timestamp: entry.timestamp,
    selectorKey: entry.selectorKey,
    method: entry.method,
    canvasVersion: entry.canvasVersion,
    // Path with IDs stripped: /courses/12345/assignments → /courses/:id/assignments
    pageUrl: sanitizePath(entry.pageUrl),
    allStrategiesAttempted: entry.allStrategiesAttempted,
    recovered: entry.recovered,
  }))
}

function sanitizePath(path) {
  if (!path) return path
  return path.replace(/\/\d+/g, '/:id')
}
