import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import IconButton from './IconButton.jsx'

/**
 * SearchInput — a labeled text field for filtering the current screen, with a
 * clear affordance.
 *
 * Tier 1 atom. Canonicalizes the 7 hand-rolled search inputs across the tools
 * (Templates, Rubrics, Grading, Accommodations, CopyFlow, Groups) into one.
 * Extends the shared `.input` class, adds a leading search icon and a trailing
 * clear button (an IconButton) that appears only while there's a value.
 *
 * Controlled: `onChange` is handed the next string value (not the event), so
 * consumers skip the `e.target.value` unwrap. Debounce is deliberately NOT
 * baked in — it's the consumer's concern (only the large Bulk Editor table
 * needs it; browse lists filter live).
 *
 * @param {string} value
 * @param {(next: string) => void} onChange
 * @param {string} [placeholder='Search…']
 * @param {string} ariaLabel   Accessible name — the field has no visible label.
 * @param {() => void} [onClear]  Optional hook fired after a clear (e.g. refetch).
 * @param {boolean} [disabled=false]
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel,
  onClear,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const showClear = value.length > 0 && !disabled

  const handleClear = () => {
    onChange('')          // always restores the full list
    onClear?.()           // optional consumer hook
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <Search
        size={15}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        // pl for the search icon, pr reserved for the clear button (no shift as
        // it appears). Hide the native webkit ✕ so ours is the only one.
        className="input pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {showClear && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2">
          <IconButton icon={X} label="Clear search" size="sm" onClick={handleClear} />
        </span>
      )}
    </div>
  )
}
