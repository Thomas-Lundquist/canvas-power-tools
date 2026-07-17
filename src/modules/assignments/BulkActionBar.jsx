import { useState } from 'react'
import { Calendar, ArrowLeftRight, X, Hash, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import DateInput from '../../components/DateInput.jsx'
import { Checkbox } from '../../components/FormControls.jsx'

function ModePill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
        active
          ? 'bg-[rgba(var(--cpt-color-rgb),0.08)] text-[var(--cpt-color)] border-[var(--cpt-color)]'
          : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-body)]'
      }`}
    >
      {label}
    </button>
  )
}

function DateControlRow({ label, spec, onChange, mirrorActive, defaultShiftDays = 7 }) {
  const mode = spec?.mode ?? null

  function setMode(m) {
    if (mode === m) {
      onChange(null)
    } else {
      onChange({ mode: m, value: null, days: m === 'shift' ? defaultShiftDays : null, sign: '+' })
    }
  }

  return (
    <div className="flex items-center gap-3 min-h-[36px]">
      <span className="w-28 text-xs font-medium text-[var(--color-text-secondary)] shrink-0">{label}</span>

      <div className="flex items-center gap-1 shrink-0">
        <ModePill label="Set" active={mode === 'set'} onClick={() => setMode('set')} />
        <ModePill label="Shift" active={mode === 'shift'} onClick={() => setMode('shift')} />
        <ModePill label="Clear" active={mode === 'clear'} onClick={() => setMode('clear')} />
      </div>

      <div className="flex-1 flex items-center">
        {mode === 'set' && (
          <DateInput
            value={spec?.value ?? ''}
            onChange={v => onChange({ mode: 'set', value: v, days: null })}
            disabled={mirrorActive}
          />
        )}
        {mode === 'shift' && (
          <div className="flex items-center gap-1.5">
            <select
              value={spec?.sign ?? '+'}
              onChange={e => onChange({ ...spec, sign: e.target.value })}
              className="input w-14 text-sm py-1"
            >
              <option value="+">+</option>
              <option value="-">−</option>
            </select>
            <input
              type="number"
              min="1"
              value={spec?.days ?? ''}
              onChange={e => onChange({ ...spec, days: e.target.value })}
              placeholder="days"
              className="input w-20 text-sm py-1"
              disabled={mirrorActive}
            />
            <span className="text-xs text-[var(--color-text-muted)]">days</span>
          </div>
        )}
        {mode === 'clear' && (
          <span className="text-xs text-red-500 italic">Removes this date from all selected assignments</span>
        )}
        {!mode && (
          <span className="text-xs text-[var(--color-text-disabled)] italic">No change</span>
        )}
      </div>
    </div>
  )
}

export default function BulkActionBar({ selectedCount, bulkSpec, onChange, onPreview, shiftAllTogether, onShiftAllToggle, defaultShiftDays = 7 }) {
  const [collapsed, setCollapsed] = useState(false)

  const changeCount = [bulkSpec.dueAt, bulkSpec.unlockAt, bulkSpec.lockAt]
    .filter(Boolean).length
    + (bulkSpec.points?.value !== '' && bulkSpec.points?.value != null ? 1 : 0)
    + (bulkSpec.published?.value !== undefined && bulkSpec.published?.value !== null ? 1 : 0)

  const hasAnyChange = changeCount > 0

  function setDateSpec(field, spec) {
    const update = { ...bulkSpec, [field]: spec }
    if (shiftAllTogether && spec && (spec.mode === 'shift' || spec.mode === 'clear')) {
      update.dueAt = spec ? { ...spec } : null
      update.unlockAt = spec ? { ...spec } : null
      update.lockAt = spec ? { ...spec } : null
    }
    onChange(update)
  }

  function clearAll() {
    onChange({ dueAt: null, unlockAt: null, lockAt: null, points: null, published: null })
  }

  const mirrorActive = shiftAllTogether && !!(bulkSpec.dueAt?.mode === 'shift' || bulkSpec.dueAt?.mode === 'clear')

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 shadow-2xl border-t border-[var(--color-border)]">
      {/* Header strip */}
      <div className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[var(--color-text-body)]">
            <span style={{ color: 'var(--cpt-color)' }}>{selectedCount}</span> assignment{selectedCount !== 1 ? 's' : ''} selected
          </span>
          {hasAnyChange && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(var(--cpt-color-rgb),0.1)', color: 'var(--cpt-color)' }}>
              {changeCount} field{changeCount !== 1 ? 's' : ''} to change
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasAnyChange && (
            <button onClick={clearAll} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] text-xs flex items-center gap-1 transition-colors">
              <X size={13} /> Clear all
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors ml-2"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="bg-[var(--color-bg-surface)] px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-start gap-8">

            {/* Dates column */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={13} style={{ color: 'var(--cpt-color)' }} />
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Dates</span>
                <div
                  className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer select-none"
                  onClick={() => onShiftAllToggle(!shiftAllTogether)}
                >
                  <Checkbox checked={shiftAllTogether} onChange={v => onShiftAllToggle(v)} />
                  Apply same shift/clear to all
                </div>
              </div>
              <DateControlRow
                label="Due Date"
                spec={bulkSpec.dueAt}
                onChange={s => setDateSpec('dueAt', s)}
                mirrorActive={mirrorActive && bulkSpec.dueAt !== null}
                defaultShiftDays={defaultShiftDays}
              />
              <DateControlRow
                label="Avail. From"
                spec={bulkSpec.unlockAt}
                onChange={s => setDateSpec('unlockAt', s)}
                mirrorActive={mirrorActive}
                defaultShiftDays={defaultShiftDays}
              />
              <DateControlRow
                label="Avail. Until"
                spec={bulkSpec.lockAt}
                onChange={s => setDateSpec('lockAt', s)}
                mirrorActive={mirrorActive}
                defaultShiftDays={defaultShiftDays}
              />
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-[var(--color-border-subtle)] shrink-0" />

            {/* Points + Status column */}
            <div className="w-64 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Hash size={13} style={{ color: 'var(--cpt-color)' }} />
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Points</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={bulkSpec.points?.value ?? ''}
                    onChange={e => onChange({ ...bulkSpec, points: e.target.value !== '' ? { value: e.target.value } : null })}
                    placeholder="Set all to..."
                    className="input flex-1 text-sm py-1.5"
                  />
                  <span className="text-sm text-[var(--color-text-muted)] shrink-0">pts</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye size={13} style={{ color: 'var(--cpt-color)' }} />
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Status</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg border transition-colors ${
                      bulkSpec.published?.value === true
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)]'
                    }`}
                    onClick={() => onChange({ ...bulkSpec, published: bulkSpec.published?.value === true ? null : { value: true } })}
                  >
                    <Eye size={12} /> Publish
                  </button>
                  <button
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg border transition-colors ${
                      bulkSpec.published?.value === false
                        ? 'bg-[var(--color-bg-hover)] border-[var(--color-border)] text-[var(--color-text-body)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)]'
                    }`}
                    onClick={() => onChange({ ...bulkSpec, published: bulkSpec.published?.value === false ? null : { value: false } })}
                  >
                    <EyeOff size={12} /> Unpublish
                  </button>
                </div>
              </div>
            </div>

            {/* Action column */}
            <div className="shrink-0 flex flex-col gap-2 pt-7">
              <button
                className="btn-primary px-6"
                disabled={!hasAnyChange}
                onClick={onPreview}
              >
                Preview Changes
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
