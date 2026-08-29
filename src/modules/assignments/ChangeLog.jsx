import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, AlertCircle, Loader } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Callout from '../../components/Callout.jsx'
import Badge from '../../components/Badge.jsx'
import Button from '../../components/Button.jsx'
import { getChangeLog, addChangeLogEntry, buildChangeLogEntry } from '../../storage/changeLogs.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { updateAssignment } from '../../api/assignments.js'
import { formatDate } from '../../components/DateInput.jsx'

const FIELD_LABELS = {
  dueAt: 'Due Date', unlockAt: 'Available From', lockAt: 'Available Until',
  pointsPossible: 'Points', published: 'Status',
}

function formatValue(field, value) {
  if (value === null || value === undefined) return '—'
  if (field === 'published') return value ? 'Published' : 'Unpublished'
  if (field === 'pointsPossible') return `${value} pts`
  if (field.endsWith('At')) return formatDate(value)
  return String(value)
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ChangeLog({ courseId, courseName, onClose, onRevertComplete }) {
  const [entries, setEntries] = useState([])
  const [expanded, setExpanded] = useState(new Set())
  const [confirming, setConfirming] = useState(null)
  const [reverting, setReverting] = useState(null)
  const [revertResult, setRevertResult] = useState(null)
  const { requirePin } = usePinGate()

  useEffect(() => {
    getChangeLog(courseId).then(setEntries)
  }, [courseId])

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleRevert(entry) {
    await requirePin(
      {
        action: 'revert',
        summary: `Reverted ${entry.changes.length} change${entry.changes.length !== 1 ? 's' : ''} in ${courseName}`,
        courseId,
        courseName,
      },
      () => runRevert(entry),
    )
  }

  async function runRevert(entry) {
    setReverting(entry.id)
    setConfirming(null)

    const succeeded = []
    const skipped = []

    for (const change of entry.changes) {
      try {
        await updateAssignment(courseId, change.assignmentId, { [change.field]: change.previousValue })
        succeeded.push(change)
      } catch {
        skipped.push(change)
      }
    }

    const revertEntry = await buildChangeLogEntry({
      courseId,
      courseName,
      changes: succeeded.map(c => ({
        assignmentId: c.assignmentId,
        assignmentName: c.assignmentName,
        field: c.field,
        previousValue: c.newValue,
        newValue: c.previousValue,
      })),
      type: 'revert',
      revertedFromId: entry.id,
    })

    const updated = await addChangeLogEntry(revertEntry)
    setEntries(updated)
    setReverting(null)
    setRevertResult({ entryId: entry.id, succeeded, skipped })
    onRevertComplete?.()
  }

  return (
    <Modal title={`Change Log — ${courseName}`} onClose={onClose} size="lg">
      {revertResult && (
        <Callout tone="success" title="Revert complete" className="mb-4">
          <p>{revertResult.succeeded.length} change{revertResult.succeeded.length !== 1 ? 's' : ''} reverted successfully.</p>
          {revertResult.skipped.length > 0 && (
            <p className="mt-1 flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
              <AlertCircle size={14} /> {revertResult.skipped.length} skipped (assignment may have been deleted).
            </p>
          )}
          <button className="text-xs underline mt-2" style={{ color: 'var(--color-success)' }} onClick={() => setRevertResult(null)}>Dismiss</button>
        </Callout>
      )}

      {entries.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">No changes recorded for this course yet.</p>
      )}

      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-page)] cursor-pointer hover:bg-[var(--color-bg-hover)]"
              onClick={() => toggleExpand(entry.id)}
            >
              <div className="flex items-center gap-3">
                <button className="text-[var(--color-text-muted)]">
                  {expanded.has(entry.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-body)]">{entry.summary}</span>
                  {entry.type === 'revert' && (
                    <span className="ml-2"><Badge tone="warning">Revert</Badge></span>
                  )}
                  <span className="ml-3 text-xs text-[var(--color-text-muted)]">{timeAgo(entry.timestamp)}</span>
                </div>
              </div>
              {confirming === entry.id ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-[var(--color-text-secondary)]">Revert {entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}?</span>
                  <Button variant="danger" size="sm" onClick={() => handleRevert(entry)}>Confirm</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Cancel</Button>
                </div>
              ) : reverting === entry.id ? (
                <Loader size={16} className="animate-spin" style={{ color: 'var(--cpt-color)' }} />
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={e => { e.stopPropagation(); setConfirming(entry.id) }}
                >
                  Revert
                </Button>
              )}
            </div>

            {expanded.has(entry.id) && (
              <div className="px-4 py-3 border-t border-[var(--color-border-subtle)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border-subtle)]">
                      <th className="text-left py-1 pr-4 font-medium">Assignment</th>
                      <th className="text-left py-1 pr-4 font-medium">Field</th>
                      <th className="text-left py-1 pr-4 font-medium">Before</th>
                      <th className="text-left py-1 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.changes.map((c, i) => (
                      <tr key={i} className="border-b border-[var(--color-border-subtle)] last:border-0">
                        <td className="py-1.5 pr-4 text-[var(--color-text-secondary)] font-medium">{c.assignmentName}</td>
                        <td className="py-1.5 pr-4 text-[var(--color-text-muted)]">{FIELD_LABELS[c.field] ?? c.field}</td>
                        <td className="py-1.5 pr-4 text-[var(--color-text-muted)]">{formatValue(c.field, c.previousValue)}</td>
                        <td className="py-1.5 font-medium" style={{ color: 'var(--cpt-color)' }}>{formatValue(c.field, c.newValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
