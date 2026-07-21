import { useState, useRef } from 'react'
import { Calendar } from 'lucide-react'

export default function DateInput({ value, onChange, disabled, className = '' }) {
  const [draft, setDraft] = useState(null)
  const dateRef = useRef(null)
  const calBtnRef = useRef(null)
  const isEditing = draft !== null

  function handleFocus() {
    setDraft(value ? formatDate(value) : '')
  }

  function handleBlur(e) {
    if (e.relatedTarget === calBtnRef.current) return
    const text = (draft ?? '').trim()
    setDraft(null)
    if (!text) { onChange(null); return }
    const parsed = new Date(text)
    if (!isNaN(parsed)) onChange(parsed.toISOString().slice(0, 10))
  }

  function handleCalendarClick() {
    dateRef.current?.showPicker?.()
  }

  function handleNativeDateChange(e) {
    setDraft(null)
    onChange(e.target.value || null)
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={isEditing ? draft : (value ? formatDate(value) : '')}
        onChange={e => setDraft(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Jan 15, 2025"
        disabled={disabled}
        className="input text-sm w-full pr-8"
      />
      <input
        ref={dateRef}
        type="date"
        value={value ?? ''}
        onChange={handleNativeDateChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <button
        ref={calBtnRef}
        type="button"
        onClick={handleCalendarClick}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Open date picker"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors duration-75"
      >
        <Calendar size={13} aria-hidden="true" />
      </button>
    </div>
  )
}

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
