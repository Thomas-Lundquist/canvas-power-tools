import { useState, useRef, useEffect } from 'react'
import { Calendar } from 'lucide-react'
// Date math lives in a pure module so tests can import it without the JSX chain.
// Re-exported here so existing `from '.../DateInput.jsx'` imports keep working.
import { toDateInputValue, formatDate, toIsoDate } from '../utils/dates.js'

export { toDateInputValue, formatDate, toIsoDate }

export default function DateInput({ value, onChange, disabled, className = '', ariaLabel, autoFocus = false }) {
  const [draft, setDraft] = useState(null)
  const textRef = useRef(null)
  const dateRef = useRef(null)
  const calBtnRef = useRef(null)
  const isEditing = draft !== null

  // Used by click-to-edit callers: when the field mounts already in edit mode,
  // move focus straight into the text input so the teacher can type at once.
  useEffect(() => {
    if (autoFocus) textRef.current?.focus()
  }, [autoFocus])

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
        ref={textRef}
        type="text"
        value={isEditing ? draft : (value ? formatDate(value) : '')}
        onChange={e => setDraft(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Mon DD, YYYY"
        disabled={disabled}
        aria-label={ariaLabel}
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

