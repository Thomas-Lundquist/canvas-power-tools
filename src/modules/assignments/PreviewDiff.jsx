import { useState } from 'react'
import { CheckCircle, AlertCircle, Loader, Circle, ChevronRight, ChevronDown } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import { buildChanges } from './bulkEditorHelpers.js'
import { updateAssignment } from '../../api/assignments.js'
import { buildChangeLogEntry, addChangeLogEntry } from '../../storage/changeLogs.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { AuthError, NotFoundError, RateLimitError } from '../../api/errors.js'

const FIELD_LABELS = {
  dueAt: 'Due Date',
  unlockAt: 'Avail. From',
  lockAt: 'Avail. Until',
  pointsPossible: 'Points',
  published: 'Status',
}

function formatValue(field, value) {
  if (value === null || value === undefined) return '—'
  if (field === 'published') return value ? 'Published' : 'Unpublished'
  if (field === 'pointsPossible') return `${value} pts`
  return formatDate(value) ?? String(value)
}

function getErrorStatus(err) {
  if (err instanceof AuthError) return 401
  if (err instanceof NotFoundError) return 404
  if (err instanceof RateLimitError) return 429
  return err?.statusCode ?? null
}

function translateError(err) {
  if (err instanceof AuthError) return "You don't have permission to edit this assignment, or your Canvas token needs reconnecting."
  if (err instanceof NotFoundError) return 'This assignment no longer exists in Canvas (it may have been deleted).'
  if (err instanceof RateLimitError) return 'Canvas is temporarily throttling requests. Try again in a moment.'
  if (err?.statusCode === 422) return 'Canvas flagged a validation error with one or more fields.'
  return 'Canvas had a temporary problem. This usually works on retry.'
}

function actionsToSpec(actions) {
  function dateSpec(f) {
    if (f.mode === 'none') return null
    if (f.mode === 'clear') return { mode: 'clear' }
    if (f.mode === 'set') return { mode: 'set', value: f.setValue }
    if (f.mode === 'shift' && f.shiftDays) {
      const days = f.shiftDir === '-' ? -parseInt(f.shiftDays, 10) : parseInt(f.shiftDays, 10)
      return { mode: 'shift', days }
    }
    return null
  }
  return {
    dueAt: dateSpec(actions.dueAt),
    unlockAt: dateSpec(actions.unlockAt),
    lockAt: dateSpec(actions.lockAt),
    points: actions.points !== '' ? { value: actions.points } : null,
    published: actions.status !== null ? { value: actions.status === 'published' } : null,
  }
}

function groupChangesByAssignment(changes) {
  const map = new Map()
  for (const change of changes) {
    if (!map.has(change.assignmentId)) {
      map.set(change.assignmentId, { id: change.assignmentId, name: change.assignmentName, fields: [] })
    }
    map.get(change.assignmentId).fields.push(change)
  }
  return Array.from(map.values())
}

export default function PreviewDiff({
  selectedAssignments, actions, courseId, courseName, onCancel, onDone, onViewReport,
}) {
  const [phase, setPhase] = useState('preview')
  const [assignmentStatus, setAssignmentStatus] = useState({})
  const [succeededAssignments, setSucceededAssignments] = useState([])
  const [failures, setFailures] = useState([])
  const [showSucceeded, setShowSucceeded] = useState(false)
  const { requirePin } = usePinGate()

  const changes = buildChanges(selectedAssignments, actionsToSpec(actions))
  const grouped = groupChangesByAssignment(changes)
  const totalFields = changes.length
  const totalAssignments = grouped.length
  const succeededFieldCount = succeededAssignments.reduce((sum, a) => sum + a.fields.length, 0)

  const MODAL_TITLES = { preview: 'Preview Changes', applying: 'Applying Changes…', result: 'Changes Applied' }
  const modalClose = phase === 'preview' ? onCancel : phase === 'result' ? onDone : undefined

  async function handleConfirm() {
    await requirePin(
      {
        action: 'bulk-edit',
        summary: `${totalFields} field change${totalFields !== 1 ? 's' : ''} across ${totalAssignments} assignment${totalAssignments !== 1 ? 's' : ''} in ${courseName}`,
        courseId,
        courseName,
      },
      () => runApply(grouped),
    )
  }

  async function runApply(assignmentsToApply) {
    setPhase('applying')

    const batchSuccesses = []
    const batchSuccessFields = []
    const batchFailures = []

    for (const assignment of assignmentsToApply) {
      setAssignmentStatus(prev => ({ ...prev, [assignment.id]: 'applying' }))

      const payload = {}
      for (const change of assignment.fields) payload[change.field] = change.newValue

      try {
        await updateAssignment(courseId, assignment.id, payload)
        batchSuccesses.push(assignment)
        batchSuccessFields.push(...assignment.fields)
        setAssignmentStatus(prev => ({ ...prev, [assignment.id]: 'done' }))
      } catch (err) {
        batchFailures.push({
          assignmentId: assignment.id,
          assignmentName: assignment.name,
          status: getErrorStatus(err),
          reason: translateError(err),
        })
        setAssignmentStatus(prev => ({ ...prev, [assignment.id]: 'failed' }))
      }
    }

    if (batchSuccessFields.length > 0) {
      const entry = await buildChangeLogEntry({ courseId, courseName, changes: batchSuccessFields })
      if (batchFailures.length > 0) {
        entry.failures = batchFailures.map(f => ({ assignmentName: f.assignmentName, status: f.status, reason: f.reason }))
      }
      await addChangeLogEntry(entry)
    }

    setSucceededAssignments(prev => [...prev, ...batchSuccesses])
    setFailures(batchFailures)
    setPhase('result')
  }

  async function handleRetry() {
    const failedIds = new Set(failures.map(f => f.assignmentId))
    const assignmentsToRetry = grouped.filter(a => failedIds.has(a.id))
    setFailures([])
    setShowSucceeded(false)
    await runApply(assignmentsToRetry)
  }

  if (phase === 'preview') {
    return (
      <Modal title={MODAL_TITLES.preview} onClose={modalClose} size="lg">
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-[var(--color-border)]">
          {grouped.map(assignment => (
            <AssignmentBlock key={assignment.id} assignment={assignment} />
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {totalFields} field{totalFields !== 1 ? 's' : ''} to change across {totalAssignments} assignment{totalAssignments !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirm}>Confirm &amp; Apply</Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (phase === 'applying') {
    return (
      <Modal title={MODAL_TITLES.applying} size="lg">
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-[var(--color-border)]">
          {grouped.map(assignment => (
            <AssignmentBlock
              key={assignment.id}
              assignment={assignment}
              status={assignmentStatus[assignment.id]}
              showStatus
            />
          ))}
        </div>
      </Modal>
    )
  }

  const allSucceeded = failures.length === 0

  return (
    <Modal title={MODAL_TITLES.result} onClose={modalClose} size="lg">
      <div className="space-y-4">
        {allSucceeded ? (
          <div className="flex items-center gap-2 text-[var(--color-success)]">
            <CheckCircle size={20} aria-hidden="true" />
            <span className="text-base font-medium">
              {succeededFieldCount} field{succeededFieldCount !== 1 ? 's' : ''} updated across {succeededAssignments.length} assignment{succeededAssignments.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertCircle size={20} aria-hidden="true" />
              <span className="text-base font-medium">
                {succeededAssignments.length} updated · {failures.length} failed
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--color-error)]">Failed</p>
              {failures.map(f => (
                <div
                  key={f.assignmentId}
                  className="rounded-[var(--radius-card)] border border-[var(--color-error)] px-4 py-3"
                  style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}
                >
                  <p className="text-sm font-medium text-[var(--color-text-body)]">
                    {f.assignmentName}
                    {f.status && (
                      <span className="ml-2 text-xs text-[var(--color-text-muted)] font-normal">({f.status})</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.reason}</p>
                </div>
              ))}
            </div>

            {succeededAssignments.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] transition-colors duration-75"
                  onClick={() => setShowSucceeded(s => !s)}
                >
                  {showSucceeded
                    ? <ChevronDown size={14} aria-hidden="true" />
                    : <ChevronRight size={14} aria-hidden="true" />}
                  {succeededAssignments.length} succeeded
                </button>
                {showSucceeded && (
                  <ul className="mt-2 space-y-1 pl-5 list-disc">
                    {succeededAssignments.map(a => (
                      <li key={a.id} className="text-sm text-[var(--color-text-secondary)]">{a.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-[var(--color-border)]">
        <Button variant="ghost" onClick={onViewReport}>View Report</Button>
        {!allSucceeded && (
          <Button variant="secondary" onClick={handleRetry}>Retry all failed</Button>
        )}
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    </Modal>
  )
}

function AssignmentBlock({ assignment, status, showStatus = false }) {
  return (
    <div className="py-3 flex items-start gap-3">
      {showStatus && (
        <div className="mt-0.5 shrink-0 w-4">
          {status === 'applying' && (
            <Loader size={16} className="animate-spin text-[var(--cpt-color)]" aria-label="Applying" />
          )}
          {status === 'done' && (
            <CheckCircle size={16} className="text-[var(--color-success)]" aria-label="Done" />
          )}
          {status === 'failed' && (
            <AlertCircle size={16} className="text-[var(--color-error)]" aria-label="Failed" />
          )}
          {!status && (
            <Circle size={16} className="text-[var(--color-text-disabled)]" aria-label="Pending" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-body)] mb-1.5">{assignment.name}</p>
        <div className="space-y-1">
          {assignment.fields.map((change, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="w-28 shrink-0 text-xs text-[var(--color-text-secondary)]">
                {FIELD_LABELS[change.field] ?? change.field}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatValue(change.field, change.previousValue)}
              </span>
              <span className="text-xs font-medium text-[var(--cpt-color)]" aria-hidden="true">→</span>
              <span className="text-xs font-medium text-[var(--color-text-body)]">
                {formatValue(change.field, change.newValue)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
