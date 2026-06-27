import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, X, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
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
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-green-800 flex items-center gap-2">
            <CheckCircle size={16} /> Revert complete
          </p>
          <p className="text-green-700 mt-1">{revertResult.succeeded.length} change{revertResult.succeeded.length !== 1 ? 's' : ''} reverted successfully.</p>
          {revertResult.skipped.length > 0 && (
            <p className="text-yellow-700 mt-1 flex items-center gap-1">
              <AlertCircle size={14} /> {revertResult.skipped.length} skipped (assignment may have been deleted).
            </p>
          )}
          <button className="text-xs text-green-600 underline mt-2" onClick={() => setRevertResult(null)}>Dismiss</button>
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">No changes recorded for this course yet.</p>
      )}

      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleExpand(entry.id)}
            >
              <div className="flex items-center gap-3">
                <button className="text-gray-400">
                  {expanded.has(entry.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div>
                  <span className="text-sm font-medium text-gray-900">{entry.summary}</span>
                  {entry.type === 'revert' && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Revert</span>
                  )}
                  <span className="ml-3 text-xs text-gray-500">{timeAgo(entry.timestamp)}</span>
                </div>
              </div>
              {confirming === entry.id ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-gray-600">Revert {entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}?</span>
                  <button className="btn-danger text-xs px-2 py-1" onClick={() => handleRevert(entry)}>Confirm</button>
                  <button className="btn-ghost text-xs px-2 py-1" onClick={() => setConfirming(null)}>Cancel</button>
                </div>
              ) : reverting === entry.id ? (
                <Loader size={16} className="animate-spin" style={{ color: 'var(--cpt-color)' }} />
              ) : (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                  onClick={e => { e.stopPropagation(); setConfirming(entry.id) }}
                >
                  <RotateCcw size={13} /> Revert
                </button>
              )}
            </div>

            {expanded.has(entry.id) && (
              <div className="px-4 py-3 border-t border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-1 pr-4 font-medium">Assignment</th>
                      <th className="text-left py-1 pr-4 font-medium">Field</th>
                      <th className="text-left py-1 pr-4 font-medium">Before</th>
                      <th className="text-left py-1 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.changes.map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 pr-4 text-gray-700 font-medium">{c.assignmentName}</td>
                        <td className="py-1.5 pr-4 text-gray-500">{FIELD_LABELS[c.field] ?? c.field}</td>
                        <td className="py-1.5 pr-4 text-gray-500">{formatValue(c.field, c.previousValue)}</td>
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
