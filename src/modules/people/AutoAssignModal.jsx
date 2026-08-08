import { useState, useMemo } from 'react'
import { X, Loader, Users } from 'lucide-react'
import Callout from '../../components/Callout.jsx'

// ── Assignment algorithms ──────────────────────────────────────────────────

function sortedByLastName(students) {
  return [...students].sort((a, b) => {
    const aName = (a.userSortableName ?? a.userName ?? '').toLowerCase()
    const bName = (b.userSortableName ?? b.userName ?? '').toLowerCase()
    return aName.localeCompare(bName)
  })
}

function splitByLastName(students, numGroups) {
  const sorted = sortedByLastName(students)
  const groups = []
  for (let i = 0; i < numGroups; i++) {
    const start = Math.round((i / numGroups) * sorted.length)
    const end   = Math.round(((i + 1) / numGroups) * sorted.length)
    const slice = sorted.slice(start, end)
    if (slice.length === 0) continue
    const first = (slice[0].userSortableName ?? '')[0]?.toUpperCase() ?? '?'
    const last  = (slice[slice.length - 1].userSortableName ?? '')[0]?.toUpperCase() ?? '?'
    const label = first === last ? first : `${first}–${last}`
    groups.push({ name: `${label}`, students: slice })
  }
  return groups
}

function splitRandomly(students, numGroups) {
  const shuffled = [...students].sort(() => Math.random() - 0.5)
  const groups = []
  for (let i = 0; i < numGroups; i++) {
    const start = Math.round((i / numGroups) * shuffled.length)
    const end   = Math.round(((i + 1) / numGroups) * shuffled.length)
    groups.push({ name: `Group ${i + 1}`, students: shuffled.slice(start, end) })
  }
  return groups
}

function splitByCount(students, perGroup) {
  const shuffled = [...students].sort(() => Math.random() - 0.5)
  const groups = []
  for (let i = 0; i < shuffled.length; i += perGroup) {
    groups.push({ name: `Group ${groups.length + 1}`, students: shuffled.slice(i, i + perGroup) })
  }
  return groups
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AutoAssignModal({ students, categoryName, existingGroupCount, onAssign, onClose, applying }) {
  const [method, setMethod]       = useState('lastNameRange')
  const [numGroups, setNumGroups] = useState(4)
  const [perGroup, setPerGroup]   = useState(5)
  const [step, setStep]           = useState('config') // 'config' | 'preview'

  const preview = useMemo(() => {
    if (step !== 'preview') return null
    if (method === 'lastNameRange') return splitByLastName(students, numGroups)
    if (method === 'random')        return splitRandomly(students, numGroups)
    return splitByCount(students, perGroup)
  }, [step, method, numGroups, perGroup, students])

  const methodOptions = [
    {
      value: 'lastNameRange',
      label: 'By last name',
      description: 'Sort alphabetically by last name, split into N equal-sized groups.',
    },
    {
      value: 'random',
      label: 'Randomly',
      description: 'Shuffle all students and distribute them evenly across N groups.',
    },
    {
      value: 'equalCount',
      label: 'By group size',
      description: 'Set how many students per group; groups are filled randomly.',
    },
  ]

  function ModePill({ value, label, description }) {
    const active = method === value
    return (
      <button
        type="button"
        onClick={() => setMethod(value)}
        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
          active ? 'border-transparent' : 'border-[var(--color-border)] hover:border-[var(--color-border)]'
        }`}
        style={active ? { borderColor: 'var(--cpt-color)', backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)' } : undefined}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
            style={active
              ? { borderColor: 'var(--cpt-color)', backgroundColor: 'var(--cpt-color)' }
              : { borderColor: '#d1d5db' }}
          >
            {active && <span className="w-1.5 h-1.5 rounded-full block" style={{ backgroundColor: 'white' }} />}
          </span>
          <span className={`text-sm font-medium ${active ? 'text-[var(--color-text-body)]' : 'text-[var(--color-text-secondary)]'}`}>{label}</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 pl-6">{description}</p>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[var(--color-bg-surface)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border-subtle)] sticky top-0 bg-[var(--color-bg-surface)]">
          <div>
            <h3 className="font-semibold text-[var(--color-text-body)]">Auto-assign Students</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {students.length} students in "{categoryName}"
              {existingGroupCount > 0 && ` · ${existingGroupCount} existing groups`}
            </p>
          </div>
          <button className="btn-ghost p-1" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="p-5">
          {step === 'config' ? (
            <div className="space-y-5">
              {/* Method selection */}
              <div className="space-y-2">
                {methodOptions.map(o => <ModePill key={o.value} {...o} />)}
              </div>

              {/* Config inputs */}
              {method !== 'equalCount' ? (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0">Number of groups</label>
                  <input
                    type="number" min="2" max={Math.max(2, students.length)}
                    value={numGroups}
                    onChange={e => setNumGroups(Math.max(2, parseInt(e.target.value) || 2))}
                    className="input w-20 text-sm"
                  />
                  <span className="text-xs text-[var(--color-text-disabled)]">
                    ~{Math.round(students.length / numGroups)} students each
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0">Students per group</label>
                  <input
                    type="number" min="1" max={students.length}
                    value={perGroup}
                    onChange={e => setPerGroup(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input w-20 text-sm"
                  />
                  <span className="text-xs text-[var(--color-text-disabled)]">
                    → {Math.ceil(students.length / perGroup)} groups
                  </span>
                </div>
              )}

              {existingGroupCount > 0 && (
                <Callout tone="warning">
                  This will add new groups alongside the {existingGroupCount} existing group{existingGroupCount !== 1 ? 's' : ''}.
                  Remove old groups manually if needed.
                </Callout>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  className="btn-primary"
                  onClick={() => setStep('preview')}
                  disabled={students.length === 0}
                >
                  Preview Assignment →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {preview.map((group, i) => (
                  <div key={i} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-hover)]">
                      <span className="text-sm font-semibold text-[var(--color-text-body)]">{group.name}</span>
                      <span className="text-xs text-[var(--color-text-disabled)] flex items-center gap-1">
                        <Users size={12} /> {group.students.length}
                      </span>
                    </div>
                    <div className="px-3 py-2 space-y-0.5 max-h-32 overflow-y-auto">
                      {group.students.map(s => (
                        <p key={s.userId} className="text-xs text-[var(--color-text-secondary)]">{s.userSortableName ?? s.userName}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2 border-t border-[var(--color-border-subtle)]">
                <button className="btn-secondary" onClick={() => setStep('config')}>← Back</button>
                <button
                  className="btn-primary"
                  onClick={() => onAssign(preview)}
                  disabled={applying}
                >
                  {applying
                    ? <><Loader size={13} className="animate-spin inline mr-1.5" />Creating groups…</>
                    : `Create ${preview.length} Groups in Canvas`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
