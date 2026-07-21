import { useState, useRef, useCallback, useEffect } from 'react'
import { History, Plus, ChevronLeft, SlidersHorizontal, X } from 'lucide-react'
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

function BackButton({ onClick }) {
  return (
    <button
      className="flex items-center gap-1.5 px-4 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] border-b border-[var(--color-border)] w-full transition-colors duration-75"
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
          <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
            No {type.label.toLowerCase()}s found.
          </p>
        ) : (
          <div className="py-1 max-h-52 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
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
              className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
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
        <div className="p-4 space-y-3">
          <div className="space-y-2">
            {DATE_MODE_OPTIONS.map(mode => (
              <label key={mode.value} className="flex items-center gap-2.5 cursor-pointer select-none">
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
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">To</label>
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
  const wrapperRef = useRef(null)

  const closePopover = useCallback(() => {
    setPopoverOpen(false)
    setStep('type')
    setPendingType(null)
    setEditingId(null)
  }, [])

  useEffect(() => {
    if (!popoverOpen) return
    function onDown(e) {
      if (!wrapperRef.current?.contains(e.target)) closePopover()
    }
    function onKey(e) { if (e.key === 'Escape') closePopover() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
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
    if (editingId) {
      onUpdateFilter(filter)
    } else {
      onAddFilter(filter)
    }
    closePopover()
  }

  return (
    <div className="px-3 border-b border-[var(--color-border)]">
      {/* Search + Add Filter + chips inline — chips wrap within the middle section, no layout jump */}
      <div className="flex items-start gap-3 py-3">
        <div className="shrink-0">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search assignments…"
            ariaLabel="Search assignments by name"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div ref={wrapperRef} className="relative shrink-0">
            <Button
              variant="ghost"
              onClick={openAdd}
              aria-haspopup="true"
              aria-expanded={popoverOpen && !editingId}
            >
              <Plus size={14} aria-hidden="true" />
              Add Filter
            </Button>

            {popoverOpen && (
              <div
                className="absolute top-full left-0 mt-1.5 w-60 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-20 overflow-hidden"
                role="dialog"
                aria-label={step === 'type' ? 'Choose a filter type' : `Set ${pendingType?.label ?? ''} filter`}
              >
                {step === 'type' && (
                  <div className="py-1">
                    {availableTypes.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                        All filter types applied.
                      </p>
                    ) : availableTypes.map(type => (
                      <button
                        key={type.id}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
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
              </div>
            )}
          </div>

          {filters.map(filter => (
            <div
              key={filter.id}
              className="chip-enter inline-flex items-center rounded-full border border-[var(--color-border)] text-sm overflow-hidden"
              style={{ background: 'color-mix(in srgb, var(--cpt-color) 8%, transparent)' }}
            >
              <button
                className="pl-3 pr-1.5 py-2 text-[var(--color-text-body)] hover:text-[var(--cpt-color)] transition-colors duration-75"
                onClick={() => openEdit(filter)}
                aria-label={`Edit filter: ${filter.label}: ${filter.displayValue}`}
              >
                <span className="font-medium text-[var(--color-text-muted)]">{filter.label}:</span>{' '}
                {filter.displayValue}
              </button>
              <button
                className="pr-2.5 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors duration-75"
                onClick={() => onRemoveFilter(filter.id)}
                aria-label={`Remove filter: ${filter.label}: ${filter.displayValue}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ))}

          {filters.length > 0 && (
            <button
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors duration-75"
              onClick={onClearAll}
            >
              Clear all
            </button>
          )}
        </div>

        {showChangeLog && (
          <div className="shrink-0">
            <Button variant="ghost" onClick={onChangeLogClick}>
              <History size={14} aria-hidden="true" />
              Change Log
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
