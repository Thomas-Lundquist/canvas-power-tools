// Pure date helpers shared by the date picker and the bulk editor. Kept free of
// React/JSX so Node's test runner can import them directly (DateInput.jsx, which
// re-exports these, pulls in JSX and cannot be imported by `node --test`).
//
// Canvas timestamps are ISO 8601 UTC. The UI works in date-only space
// ('YYYY-MM-DD'); toIsoDate pins every write to 23:59 UTC, the Canvas default.

export function toDateInputValue(isoString) {
  if (!isoString) return ''
  return isoString.slice(0, 10)
}

export function formatDate(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function toIsoDate(dateStr) {
  if (!dateStr) return null
  return `${dateStr}T23:59:00Z`
}
