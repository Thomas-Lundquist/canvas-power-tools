import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Eye, EyeOff, Calendar, X, Copy, FolderKanban } from 'lucide-react'
import SegmentedToggle from '../../components/SegmentedToggle.jsx'
import NumberField from '../../components/NumberField.jsx'
import IconButton from '../../components/IconButton.jsx'
import Button from '../../components/Button.jsx'
import DateInput from '../../components/DateInput.jsx'

const INITIAL_DATE_FIELD = { mode: 'none', setValue: '', shiftDir: '+', shiftDays: '' }

export const INITIAL_ACTIONS = {
  dueAt: { ...INITIAL_DATE_FIELD },
  unlockAt: { ...INITIAL_DATE_FIELD },
  lockAt: { ...INITIAL_DATE_FIELD },
  points: '',
  status: null,
  assignmentGroupId: '',
}

const DATE_MODES = [
  { value: 'set', label: 'Set' },
  { value: 'shift', label: 'Shift' },
  { value: 'clear', label: 'Clear' },
]

const DATE_ROWS = [
  { key: 'dueAt', label: 'Due Date' },
  { key: 'unlockAt', label: 'Open Date' },
  { key: 'lockAt', label: 'Close Date' },
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
  if (actions.assignmentGroupId !== '') count++
  return count
}

export default function BulkActionBar({ selectedCount, actions, onActionsChange, onPreview, onClearAll, onCopyTo, groups = [] }) {
  const [collapsed, setCollapsed] = useState(false)

  const fieldCount = countActiveFields(actions)
  const totalChanges = fieldCount * selectedCount

  useEffect(() => {
    if (fieldCount > 0 && collapsed) setCollapsed(false)
  }, [fieldCount])

  function handleDateChange(key, field) {
    onActionsChange({ ...actions, [key]: field })
  }

  function handleStatusToggle(intent) {
    onActionsChange({ ...actions, status: actions.status === intent ? null : intent })
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      aria-hidden={selectedCount === 0 ? 'true' : undefined}
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[61.5rem] z-20 px-4 transition-transform duration-300 ease-out ${
        selectedCount === 0 ? 'translate-y-full pointer-events-none' : 'translate-y-0'
      }`}
    >
      <div className="bg-[var(--color-bg-surface)] border border-b-0 border-[var(--color-border)] rounded-t-[var(--radius-card)] shadow-[var(--shadow-lg)]">

        {/* Header strip */}
        <div
          className={`flex items-center justify-between px-4 h-11 bg-[var(--color-bg-hover)] rounded-t-[var(--radius-card)] border-b-2 border-[var(--cpt-color)] ${collapsed ? 'cursor-pointer' : ''}`}
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
            {onCopyTo && (
              <button
                type="button"
                onClick={onCopyTo}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-body)] transition-colors duration-75"
                aria-label={`Copy ${selectedCount} selected assignment${selectedCount !== 1 ? 's' : ''} to another course`}
              >
                <Copy size={12} aria-hidden="true" />
                Copy To
              </button>
            )}
            <IconButton
              icon={collapsed ? ChevronUp : ChevronDown}
              label={collapsed ? 'Expand action bar' : 'Collapse action bar'}
              size="sm"
              onClick={() => setCollapsed(c => !c)}
            />
            <IconButton
              icon={X}
              label="Clear selection and close"
              size="sm"
              onClick={onClearAll}
            />
          </div>
        </div>

        <div className={`overflow-hidden transition-[height,opacity] duration-300 ease-out ${
          collapsed ? 'h-0 opacity-0' : 'h-[19rem] opacity-100'
        }`}>
          <div className="flex h-full">

            {/* Dates column */}
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar size={12} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
                <span className="section-label !mb-0">Dates</span>
              </div>
              <div className="flex flex-col flex-1 divide-y divide-[var(--color-border-subtle)] py-2">
                {DATE_ROWS.map(({ key, label }) => (
                  <DateRow
                    key={key}
                    label={label}
                    field={actions[key]}
                    onChange={field => handleDateChange(key, field)}
                  />
                ))}
              </div>
            </div>

            <div className="w-px bg-[var(--color-border)] shrink-0" />

            {/* Points + Status + Preview column */}
            <div className="w-52 shrink-0 p-4 flex flex-col gap-4">
              <div>
                <span className="section-label !mb-0"># Points</span>
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
                  <FolderKanban size={12} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
                  <span className="section-label !mb-0">Assignment Group</span>
                </div>
                <select
                  value={actions.assignmentGroupId}
                  onChange={e => onActionsChange({ ...actions, assignmentGroupId: e.target.value })}
                  className="input mt-2 w-full text-sm"
                  aria-label="Move all selected assignments to a group"
                >
                  <option value="">No change</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <Eye size={12} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
                  <span className="section-label !mb-0">Status</span>
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
        </div>
      </div>
    </div>
  )
}

function DateRow({ label, field, onChange }) {
  function handleModeChange(mode) {
    const nextMode = field.mode === mode ? 'none' : mode
    const nextField = { ...field, mode: nextMode }
    if (nextMode === 'set' && !nextField.setValue) {
      nextField.setValue = new Date().toISOString().slice(0, 10)
    }
    onChange(nextField)
  }

  return (
    <div className="flex-1 min-h-[2.75rem] flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-[var(--color-text-secondary)]">{label}</span>
      <SegmentedToggle
        options={DATE_MODES}
        value={field.mode === 'none' ? '' : field.mode}
        onChange={handleModeChange}
        ariaLabel={`${label} edit mode`}
      />
      <div className="flex-1 flex items-center justify-center min-w-0">
        {field.mode === 'set' && (
          <DateInput
            value={field.setValue}
            onChange={v => onChange({ ...field, setValue: v ?? '' })}
            className="w-40"
          />
        )}
        {field.mode === 'shift' && (
          <div className="w-40 flex items-center gap-1">
            <div className="flex rounded-[var(--radius-control)] border border-[var(--color-border)] overflow-hidden shrink-0" role="group" aria-label="Shift direction">
              <button
                type="button"
                onClick={() => onChange({ ...field, shiftDir: '+' })}
                aria-pressed={field.shiftDir === '+'}
                className={`px-2.5 py-1 text-sm font-medium transition-colors duration-75 border-r border-[var(--color-border)] ${field.shiftDir === '+' ? 'bg-[rgba(var(--cpt-color-rgb),0.1)] text-[var(--cpt-color)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}
              >+</button>
              <button
                type="button"
                onClick={() => onChange({ ...field, shiftDir: '-' })}
                aria-pressed={field.shiftDir === '-'}
                className={`px-2.5 py-1 text-sm font-medium transition-colors duration-75 ${field.shiftDir === '-' ? 'bg-[rgba(var(--cpt-color-rgb),0.1)] text-[var(--cpt-color)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}
              >−</button>
            </div>
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
          <span className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-control)] text-xs border border-[var(--color-error)] text-[var(--color-error)]" role="alert">
            Clears this date from all selected
          </span>
        )}
        {field.mode === 'none' && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-control)] text-xs border border-[var(--color-border)] text-[var(--color-text-disabled)]">No change</span>
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
      className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-[var(--radius-control)] text-xs font-medium transition-colors
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
