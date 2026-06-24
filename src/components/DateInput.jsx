export default function DateInput({ value, onChange, placeholder = 'Pick a date', disabled }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      disabled={disabled}
      className="input text-sm"
      placeholder={placeholder}
    />
  )
}

// Formats an ISO datetime string (or date string) to YYYY-MM-DD for <input type="date">
export function toDateInputValue(isoString) {
  if (!isoString) return ''
  return isoString.slice(0, 10)
}

// Formats a date string for display: "Oct 8, 2025"
export function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Returns an ISO datetime string from a YYYY-MM-DD input value (set to 11:59pm UTC)
export function toIsoDate(dateStr) {
  if (!dateStr) return null
  return `${dateStr}T23:59:00Z`
}
