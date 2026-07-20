import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Eye, EyeOff, Calendar } from 'lucide-react'
import SegmentedToggle from '../../components/SegmentedToggle.jsx'
import NumberField from '../../components/NumberField.jsx'
import IconButton from '../../components/IconButton.jsx'
import Button from '../../components/Button.jsx'
import DateInput from '../../components/DateInput.jsx'
import { Checkbox } from '../../components/FormControls.jsx'

const INITIAL_DATE_FIELD = { mode: 'none', setValue: '', shiftDir: '+', shiftDays: '' }

export const INITIAL_ACTIONS = {
  dueAt: { ...INITIAL_DATE_FIELD },
  unlockAt: { ...INITIAL_DATE_FIELD },
  lockAt: { ...INITIAL_DATE_FIELD },
  applyToAllDates: false,
  points: '',
  status: null,
}

const DATE_MODES = [
  { value: 'set', label: 'Set' },
  { value: 'shift', label: 'Shift' },
  { value: 'clear', label: 'Clear' },
]

const DATE_ROWS = [
  { key: 'dueAt', label: 'Due Date' },
  { key: 'unlockAt', label: 'Avail. From' },
  { key: 'lockAt', label: 'Avail. Until' },
]

function countActiveFields(actions) {
  let count = 0
  for (const { key } of DATE_ROWS) {
    const f = actions[key]
    if (f.mode === 'clear') count++
    else if (f.mode === 'set' && f.setValue) count++
    else if (f.mode === 'shift' && f.shiftDays) count++
  }
  if (actions.points !== '') count++
  if (actions.status !== null) count++
  return count
}

export default function BulkActionBar({ selectedCount, actions, onActionsChange, onPreview, onClearAll }) {
  const [collapsed, setCollapsed] = useState(false)

  const fieldCount = countActiveFields(actions)
  const totalChanges = fieldCount * selectedCount

  useEffect(() => {
    if (fieldCount > 0 && collapsed) setCollapsed(false)
  }, [fieldCount])

  if (selectedCount === 0) return null

  function handleDateChange(key, field) {
    let updated = { ...actions, [key]: field }
    if (actions.applyToAllDates && key === 'dueAt' &&
        (field.mode === 'shift' || field.mode === 'clear')) {
      updated = { ...updated, unlockAt: { ...field }, lockAt: { ...field } }
    }
    onActionsChange(updated)
  }

  function handleApplyToAll(checked) {
    let updated = { ...actions, applyToAllDates: checked }
    if (checked && (actions.dueAt.mode === 'shift' || actions.dueAt.mode === 'clear')) {
      updated = { ...updated, unlockAt: { ...actions.dueAt }, lockAt: { ...actions.dueAt } }
    }
    onActionsChange(updated)
  }

  function handleStatusToggle(intent) {
    onActionsChange({ ...actions, status: actions.status === intent ? null : intent })
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[53.75rem] z-20 px-4"
    >
      <div className="bg-[var(--color-bg-page)] border border-b-0 border-[var(--color-border)] rounded-t-xl shadow-xl">

        {/* Header strip */}
        <div
          className={`flex items-center justify-between px-4 h-11 ${collapsed ? 'cursor-pointer' : ''}`}
          onClick={() => { if (collapsed) setCollapsed(false) }}
        >
          <span className="text-sm font-medium text-[var(--color-text-body)]">
            {selectedCount} selected
            {fieldCount > 0 && (
              <>
                <span className="text-[var(--color-text-secondary)] font-normal"> · </span>
                <span
                  className="text-[var(--color-text-secondary)] font-normal"
                  title={`${fieldCount} field${fieldCount !== 1 ? 's' : ''} × ${selectedCount} assignment${selectedCount !== 1 ? 's' : ''}`}
                >
                  {totalChanges} field change{totalChanges !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </span>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={onClearAll}>Clear All</Button>
            <IconButton
              icon={collapsed ? ChevronDown : ChevronUp}
              label={collapsed ? 'Expand action bar' : 'Collapse action bar'}
              size="sm"
              onClick={() => setCollapsed(c => !c)}
            />
          </div>
        </div>

        {!collapsed && (
          <div className="flex border-t border-[var(--color-border)]">

            {/* Dates column */}
            <div className="flex-1 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Calendar size={12} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Dates</span>
              </div>
              <div className="space-y-2">
                {DATE_ROWS.map(({ key, label }) => (
                  <DateRow
                    key={key}
                    label={label}
                    field={actions[key]}
                    onChange={field => handleDateChange(key, field)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Checkbox
                  checked={actions.applyToAllDates}
                  onChange={handleApplyToAll}
                  ariaLabel="Apply same shift/clear to all dates"
                />
                <span
                  className="text-xs text-[var(--color-text-secondary)] cursor-pointer select-none"
                  onClick={() => handleApplyToAll(!actions.applyToAllDates)}
                >
                  Apply same shift/clear to all dates
                </span>
              </div>
            </div>

            <div className="w-px bg-[var(--color-border)] shrink-0" />

            {/* Points + Status + Preview column */}
            <div className="w-52 shrink-0 p-4 flex flex-col gap-4">
              <div>
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide"># Points</span>
                <div className="flex items-center gap-2 mt-2">
                  <NumberField
                    value={actions.points}
                    onChange={v => onActionsChange({ ...actions, points: v })}
                    min={0}
                    placeholder="Set all to…"
                    aria-label="Set points for all selected assignments"
                  />
                  <span className="text-sm text-[var(--color-text-secondary)] shrink-0">pts</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <Eye size={12} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Status</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusButton
                    icon={Eye}
                    label="Publish"
                    active={actions.status === 'publish'}
                    onClick={() => handleStatusToggle('publish')}
                  />
                  <StatusButton
                    icon={EyeOff}
                    label="Unpublish"
                    active={actions.status === 'unpublish'}
                    onClick={() => handleStatusToggle('unpublish')}
                  />
                </div>
              </div>

              <div className="mt-auto">
                <Button
                  variant="primary"
                  onClick={onPreview}
                  disabled={fieldCount === 0}
                  style={{ width: '100%' }}
                >
                  Preview Changes →
                </Button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

function DateRow({ label, field, onChange }) {
  function handleModeChange(mode) {
    onChange({ ...field, mode: field.mode === mode ? 'none' : mode })
  }

  return (
    <div className="flex items-center gap-2 min-h-[2rem]">
      <span className="w-24 shrink-0 text-sm text-[var(--color-text-secondary)]">{label}</span>
      <SegmentedToggle
        options={DATE_MODES}
        value={field.mode === 'none' ? '' : field.mode}
        onChange={handleModeChange}
        ariaLabel={`${label} edit mode`}
      />
      <div className="flex-1 min-w-0">
        {field.mode === 'set' && (
          <DateInput
            value={field.setValue}
            onChange={v => onChange({ ...field, setValue: v ?? '' })}
          />
        )}
        {field.mode === 'shift' && (
          <div className="flex items-center gap-1">
            <select
              value={field.shiftDir}
              onChange={e => onChange({ ...field, shiftDir: e.target.value })}
              className="input text-sm w-14"
              aria-label="Shift direction"
            >
              <option value="+">+</option>
              <option value="-">−</option>
            </select>
            <NumberField
              value={field.shiftDays}
              onChange={v => onChange({ ...field, shiftDays: v })}
              min={1}
              placeholder="Days"
              aria-label="Number of days to shift"
            />
          </div>
        )}
        {field.mode === 'clear' && (
          <span className="text-xs text-[var(--color-error)]" role="alert">
            Removes this date from all selected assignments.
          </span>
        )}
        {field.mode === 'none' && (
          <span className="text-xs text-[var(--color-text-disabled)]">No change</span>
        )}
      </div>
    </div>
  )
}

function StatusButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors
        ${active
          ? 'bg-[rgba(var(--cpt-color-rgb),0.1)] text-[var(--cpt-color)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)]'
        }`}
    >
      <Icon size={18} aria-hidden="true" />
      {label}
    </button>
  )
}
