import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown } from 'lucide-react'
import { nextSort } from '../utils/useSort.js'

/**
 * SortControl — the browse-screen "face" of the shared sort brain.
 *
 * Tier 2 composition (bead 1yr.5, ledger Decision 2). A dropdown that picks a
 * sort field + direction for screens with no column headers to click (Templates,
 * Change Log, Sent Log). Pairs with the `useSort` hook: wire `value={s.value}`
 * and `onChange={s.setSort}`.
 *
 * Shares the toggle rule, doesn't re-implement it: choosing the active field
 * again flips direction; choosing another field selects it ascending — resolved
 * by the same `nextSort` the table headers use, so the two faces never drift.
 *
 * Accessibility: a WAI-ARIA menu button. The trigger has aria-haspopup +
 * aria-expanded; the menu uses roving tabindex (one Tab stop), Arrow/Home/End
 * move focus, Enter/Space activate, Escape closes and restores focus to the
 * trigger, and an outside click dismisses it.
 *
 * @param {{ key: string, label: string }[]} options  The sortable fields.
 * @param {{ key: string, dir: 'asc'|'desc' }} value   Current sort state.
 * @param {(next: { key: string, dir: 'asc'|'desc' }) => void} onChange
 * @param {string} [label='Sort']  Prefix shown on the trigger (e.g. "Sort").
 */
export default function SortControl({ options, value, onChange, label = 'Sort' }) {
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])

  const activeIndex = options.findIndex((o) => o.key === value.key)
  const active = options[activeIndex]
  const DirIcon = value.dir === 'asc' ? ArrowUp : ArrowDown

  // Outside-click dismissal.
  useEffect(() => {
    if (!open) return
    const onDocPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    return () => document.removeEventListener('mousedown', onDocPointer)
  }, [open])

  // On open, move focus into the menu at the active option.
  useEffect(() => {
    if (!open) return
    const start = activeIndex >= 0 ? activeIndex : 0
    setFocusIndex(start)
    itemRefs.current[start]?.focus()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const openMenu = () => setOpen(true)
  const closeMenu = ({ restoreFocus = true } = {}) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const choose = (key) => {
    onChange(nextSort(value, key))
    closeMenu()
  }

  const moveFocus = (index) => {
    setFocusIndex(index)
    itemRefs.current[index]?.focus()
  }

  const handleMenuKeyDown = (e) => {
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(focusIndex === last ? 0 : focusIndex + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(focusIndex === 0 ? last : focusIndex - 1)
        break
      case 'Home':
        e.preventDefault()
        moveFocus(0)
        break
      case 'End':
        e.preventDefault()
        moveFocus(last)
        break
      case 'Escape':
        e.preventDefault()
        closeMenu()
        break
      case 'Tab':
        // Leaving the menu by Tab dismisses it without stealing focus.
        closeMenu({ restoreFocus: false })
        break
      default:
        break
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-secondary inline-flex items-center gap-1.5 text-sm"
      >
        <span className="text-[var(--color-text-secondary)]">{label}:</span>
        <span className="font-medium">{active?.label ?? '—'}</span>
        <DirIcon
          size={14}
          aria-hidden="true"
          className="text-[var(--color-text-secondary)]"
        />
        <ChevronDown size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="card absolute right-0 z-20 mt-1 min-w-[12rem] overflow-hidden py-1 shadow-[var(--shadow-lg)]"
        >
          {options.map((opt, i) => {
            const isActive = opt.key === value.key
            return (
              <button
                key={opt.key}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="menuitem"
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => choose(opt.key)}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)]"
              >
                <span className="flex items-center gap-2">
                  {/* Check reserves its slot so labels align whether active or not. */}
                  <Check
                    size={14}
                    aria-hidden="true"
                    className={isActive ? 'text-[var(--cpt-color)]' : 'invisible'}
                  />
                  {opt.label}
                </span>
                {isActive && (
                  <DirIcon
                    size={14}
                    aria-hidden="true"
                    className="text-[var(--color-text-secondary)]"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
