import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { History, Plus, ChevronLeft, X } from 'lucide-react'
import SearchInput from '../../components/SearchInput.jsx'
import Button from '../../components/Button.jsx'

const FILTER_TYPES = [
  { id: 'group',  label: 'Assignment Group', kind: 'select-dynamic' },
  { id: 'module', label: 'Module',           kind: 'select-dynamic' },
  {
    id: 'status', label: 'Published Status', kind: 'radio',
    options: [
      { value: 'published',   label: 'Published' },
      { value: 'unpublished', label: 'Unpublished' },
      { value: 'scheduled',   label: 'Scheduled' },
    ],
  },
  {
    id: 'type', label: 'Assignment Type', kind: 'radio',
    options: [
      { value: 'assignment', label: 'Assignment' },
      { value: 'quiz',       label: 'Quiz' },
      { value: 'discussion', label: 'Discussion' },
      { value: 'page',       label: 'Page' },
    ],
  },
  { id: 'dueDate', label: 'Due Date', kind: 'date-mode' },
]

const DATE_MODE_OPTIONS = [
  { value: 'hasDate', label: 'Has a due date' },
  { value: 'noDate',  label: 'No due date' },
  { value: 'range',   label: 'Custom date range' },
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

function ValuePicker({ type, initialValue, groups, modules, onConfirm, onBack }) {
  const [dateMode, setDateMode] = useState(initialValue?.mode ?? 'hasDate')
  const [dateFrom, setDateFrom] = useState(initialValue?.from ?? '')
  const [dateTo, setDateTo] = useState(initialValue?.to ?? '')

  if (type.kind === 'select-dynamic') {
    const options = type.id === 'group'
      ? groups.map(g => ({ value: g.id, label: g.name }))
      : modules.map(m => ({ value: String(m.id), label: m.name }))

    return (
      <div>
        <BackButton onClick={onBack} />
        {options.length === 0 ? (
          <p className="px-3 py-3 text-sm text-[var(--color-text-muted)]">
            No {type.label.toLowerCase()}s found.
          </p>
        ) : (
          <div className="max-h-52 overflow-y-auto py-1">
            {options.map(opt => (
              <button
                key={opt.value}
                className={POPOVER_ROW}
                onClick={() => onConfirm({ value: opt.value }, opt.label)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (type.kind === 'radio') {
    return (
      <div>
        <BackButton onClick={onBack} />
        <div className="py-1">
          {type.options.map(opt => (
            <button
              key={opt.value}
              className={POPOVER_ROW}
              onClick={() => onConfirm({ value: opt.value }, opt.label)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (type.kind === 'date-mode') {
    return (
      <div>
        <BackButton onClick={onBack} />
        <div className="space-y-3 p-3">
          <div className="space-y-2">
            {DATE_MODE_OPTIONS.map(mode => (
              <label key={mode.value} className="flex cursor-pointer select-none items-center gap-2.5">
                <input
                  type="radio"
                  name="filterDateMode"
                  value={mode.value}
                  checked={dateMode === mode.value}
                  onChange={() => setDateMode(mode.value)}
                  className="accent-[var(--cpt-color)]"
                />
                <span className="text-sm text-[var(--color-text-body)]">{mode.label}</span>
              </label>
            ))}
          </div>
          {dateMode === 'range' && (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-text-muted)]">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-text-muted)]">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
            </div>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (dateMode === 'hasDate') {
                onConfirm({ mode: 'hasDate' }, 'Has a due date')
              } else if (dateMode === 'noDate') {
                onConfirm({ mode: 'noDate' }, 'No due date')
              } else {
                const parts = [
                  dateFrom && `from ${dateFrom}`,
                  dateTo && `to ${dateTo}`,
                ].filter(Boolean)
                onConfirm(
                  { mode: 'range', from: dateFrom, to: dateTo },
                  parts.join(' ') || 'Custom range',
                )
              }
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    )
  }

  return null
}

export default function FilterBar({
  search, onSearchChange,
  filters, groups, modules,
  onAddFilter, onUpdateFilter, onRemoveFilter, onClearAll,
  onChangeLogClick, showChangeLog,
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
    // w-60 popover (15rem ≈ 240px); keep it inside the viewport when the anchor
    // (an edited chip) sits near the right edge.
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
  const editingFilter = filters.find(f => f.id === editingId) ?? null

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
            placeholder="Search assignments…"
            ariaLabel="Search assignments by name"
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

        {showChangeLog && (
          <div className="ml-auto shrink-0">
            <Button variant="secondary" onClick={onChangeLogClick}>
              <History size={14} aria-hidden="true" />
              Change Log
            </Button>
          </div>
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
            <ValuePicker
              type={pendingType}
              initialValue={editingFilter?.value ?? null}
              groups={groups}
              modules={modules}
              onConfirm={confirmValue}
              onBack={() => { setStep('type'); setPendingType(null) }}
            />
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
