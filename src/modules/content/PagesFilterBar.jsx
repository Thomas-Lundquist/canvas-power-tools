import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ChevronLeft, X } from 'lucide-react'
import SearchInput from '../../components/SearchInput.jsx'
import Button from '../../components/Button.jsx'
import { EDITING_ROLE_PRESETS, EDITOR_LABELS } from './pagesHelpers.js'

// Pages have no availability window — Canvas gives them no unlock_at/lock_at,
// so there is deliberately no date filter here (doc 21, Decision 1). Real
// availability gating for pages lives in Modules.
const FILTER_TYPES = [
  {
    id: 'status', label: 'Published Status', kind: 'radio',
    options: [
      { value: 'published',   label: 'Published' },
      { value: 'unpublished', label: 'Unpublished' },
    ],
  },
  {
    id: 'editingRoles', label: 'Who Can Edit', kind: 'radio',
    options: EDITING_ROLE_PRESETS.map(p => ({ value: p.value, label: p.label })),
  },
  {
    id: 'editor', label: 'Editor Type', kind: 'radio',
    options: [
      { value: 'rce',          label: EDITOR_LABELS.rce },
      { value: 'block_editor', label: EDITOR_LABELS.block_editor },
    ],
  },
]

// Shared row styling for the popover's list items.
const POPOVER_ROW =
  'w-full text-left px-3 py-2 text-sm text-[var(--color-text-body)] ' +
  'hover:bg-[var(--color-bg-hover)] transition-colors duration-75'

function BackButton({ onClick }) {
  return (
    <button
      className="flex w-full items-center gap-1.5 border-b border-[var(--color-border)] px-3 py-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors duration-75"
      onClick={onClick}
    >
      <ChevronLeft size={12} aria-hidden="true" />
      Filter type
    </button>
  )
}

export default function PagesFilterBar({
  search, onSearchChange,
  filters, onAddFilter, onUpdateFilter, onRemoveFilter, onClearAll,
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [step, setStep] = useState('type')
  const [pendingType, setPendingType] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const triggerRef = useRef(null)
  const [anchor, setAnchor] = useState(null)

  const closePopover = useCallback(() => {
    setPopoverOpen(false)
    setStep('type')
    setPendingType(null)
    setEditingId(null)
  }, [])

  // The popover is portaled to <body> as position:fixed so it can't be clipped
  // by the table Card's overflow:hidden. Position is measured from the trigger's
  // live rect; a scroll or resize just closes it rather than re-tracking.
  useLayoutEffect(() => {
    if (!popoverOpen || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setAnchor({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 248) })
  }, [popoverOpen])

  useEffect(() => {
    if (!popoverOpen) return
    function onDown(e) {
      if (triggerRef.current?.contains(e.target)) return
      if (e.target.closest?.('[data-filter-popover]')) return
      closePopover()
    }
    function onKey(e) { if (e.key === 'Escape') closePopover() }
    function onReflow() { closePopover() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [popoverOpen, closePopover])

  const activeIds = new Set(filters.map(f => f.id))
  const availableTypes = FILTER_TYPES.filter(t => !activeIds.has(t.id))

  function openAdd() {
    setStep('type')
    setPendingType(null)
    setEditingId(null)
    setPopoverOpen(true)
  }

  function openEdit(filter) {
    const type = FILTER_TYPES.find(t => t.id === filter.id)
    if (!type) return
    setPendingType(type)
    setEditingId(filter.id)
    setStep('value')
    setPopoverOpen(true)
  }

  function confirmValue(value, displayValue) {
    const filter = { id: pendingType.id, label: pendingType.label, value, displayValue }
    if (editingId) onUpdateFilter(filter)
    else onAddFilter(filter)
    closePopover()
  }

  return (
    <div className="table-toolbar border-b border-[var(--color-border)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64 shrink-0">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search pages…"
            ariaLabel="Search pages by title"
          />
        </div>

        <div className="h-6 w-px shrink-0 bg-[var(--color-border)]" aria-hidden="true" />

        <div ref={triggerRef} className="shrink-0">
          <Button
            variant="secondary"
            onClick={openAdd}
            aria-haspopup="true"
            aria-expanded={popoverOpen && !editingId}
          >
            <Plus size={14} aria-hidden="true" />
            Add Filter
          </Button>
        </div>

        {filters.map(filter => (
          <span key={filter.id} className="filter-chip chip-enter">
            <button
              className="filter-chip-body"
              onClick={() => openEdit(filter)}
              aria-label={`Edit filter ${filter.label}: ${filter.displayValue}`}
            >
              <span className="filter-chip-keyseg">
                <span className="filter-chip-key">{filter.label}</span>
              </span>
              <span className="filter-chip-val">
                <span className="truncate max-w-[12rem]">{filter.displayValue}</span>
              </span>
            </button>
            <button
              className="filter-chip-x"
              onClick={() => onRemoveFilter(filter.id)}
              aria-label={`Remove filter ${filter.label}: ${filter.displayValue}`}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}

        {filters.length > 0 && (
          <button
            className="flex items-center gap-1 px-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors duration-75"
            onClick={onClearAll}
          >
            <X size={13} aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {popoverOpen && anchor && createPortal(
        <div
          data-filter-popover
          role="dialog"
          aria-label={step === 'type' ? 'Choose a filter type' : `Set ${pendingType?.label ?? ''} filter`}
          className="fixed z-[1000] w-60 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]"
          style={{ top: anchor.top, left: anchor.left }}
        >
          {step === 'type' && (
            <div className="py-1">
              {availableTypes.length === 0 ? (
                <p className="px-3 py-3 text-sm text-[var(--color-text-muted)]">
                  All filter types applied.
                </p>
              ) : availableTypes.map(type => (
                <button
                  key={type.id}
                  className={POPOVER_ROW}
                  onClick={() => { setPendingType(type); setStep('value') }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}
          {step === 'value' && pendingType && (
            <div>
              <BackButton onClick={() => { setStep('type'); setPendingType(null) }} />
              <div className="py-1">
                {pendingType.options.map(opt => (
                  <button
                    key={opt.value}
                    className={POPOVER_ROW}
                    onClick={() => confirmValue({ value: opt.value }, opt.label)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
