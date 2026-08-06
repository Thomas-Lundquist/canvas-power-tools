import { ArrowRight } from 'lucide-react'
import { formatDate } from './DateInput.jsx'

const FIELD_LABELS = {
  dueAt: 'Due Date',
  unlockAt: 'Available From',
  lockAt: 'Available Until',
  pointsPossible: 'Points',
  published: 'Status',
}

function formatValue(field, value) {
  if (value === null || value === undefined) return '—'
  if (field === 'published') return value ? 'Published' : 'Unpublished'
  if (field === 'pointsPossible') return `${value} pts`
  if (field.endsWith('At')) return formatDate(value)
  return String(value)
}

export default function PreviewDiff({ changes }) {
  if (!changes || changes.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No changes to preview.</p>
  }

  const byAssignment = changes.reduce((acc, c) => {
    if (!acc[c.assignmentId]) acc[c.assignmentId] = { name: c.assignmentName, changes: [] }
    acc[c.assignmentId].changes.push(c)
    return acc
  }, {})

  const assignmentCount = Object.keys(byAssignment).length

  return (
    <div className="space-y-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Assignment</th>
            <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Field</th>
            <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-muted)] text-xs uppercase tracking-wide">From</th>
            <th className="text-left py-2 font-medium text-[var(--color-text-muted)] text-xs uppercase tracking-wide">To</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(byAssignment).map(({ name, changes: aChanges }) =>
            aChanges.map((c, i) => (
              <tr key={`${c.assignmentId}-${c.field}`} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)]">
                <td className="py-2 pr-4 text-[var(--color-text-body)] font-medium">{i === 0 ? name : ''}</td>
                <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{FIELD_LABELS[c.field] ?? c.field}</td>
                <td className="py-2 pr-4 text-[var(--color-text-muted)]">{formatValue(c.field, c.previousValue)}</td>
                <td className="py-2 font-medium flex items-center gap-1" style={{ color: 'var(--cpt-color)' }}>
                  <ArrowRight size={12} className="text-[var(--color-text-disabled)] shrink-0" />
                  {formatValue(c.field, c.newValue)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="pt-3 text-sm text-[var(--color-text-muted)]">
        {changes.length} change{changes.length !== 1 ? 's' : ''} across {assignmentCount} assignment{assignmentCount !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
