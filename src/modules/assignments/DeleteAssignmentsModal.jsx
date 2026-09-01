import { useState } from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import { deleteAssignment } from '../../api/assignments.js'
import { AuthError, NotFoundError, RateLimitError } from '../../api/errors.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { PinRequiredError } from '../../security/pin.js'

/**
 * DeleteAssignmentsModal — permanently deletes the already-selected assignments
 * from Canvas. This is deliberately not part of the Preview/Apply/Change-Log
 * flow: deletions are not revertable, so there is no change-log entry (the
 * audit log still records the action via the PIN gate).
 *
 * Forced-PIN operation (see Doc 11, Forced PIN Re-Entry): the PIN prompt shows
 * every time regardless of recent verification, and if no PIN is configured the
 * operation is blocked outright.
 */
export default function DeleteAssignmentsModal({ assignments, courseId, courseName, onClose, onDeleted }) {
  const { requirePin } = usePinGate()
  const [phase, setPhase] = useState('confirm') // confirm | deleting | result
  const [error, setError] = useState(null)
  const [failures, setFailures] = useState([])
  const [succeededCount, setSucceededCount] = useState(0)

  const count = assignments.length
  const plural = count !== 1 ? 's' : ''

  async function handleConfirm() {
    setError(null)
    try {
      await requirePin(
        {
          action: 'assignment_delete',
          summary: `Deleted ${count} assignment${plural} from ${courseName}`,
          courseId,
          courseName,
          warning: `This permanently deletes ${count} assignment${plural} from Canvas — including all student submissions and grades. This cannot be undone.`,
        },
        runDelete,
        { forcePrompt: true },
      )
    } catch (err) {
      if (err instanceof PinRequiredError) {
        setError(err.message)
      } else {
        setError(err.message ?? 'Something went wrong.')
      }
    }
  }

  async function runDelete() {
    setPhase('deleting')
    const succeededIds = []
    const failed = []
    for (const a of assignments) {
      try {
        await deleteAssignment(courseId, a.id)
        succeededIds.push(a.id)
      } catch (err) {
        failed.push({ id: a.id, name: a.name, reason: translate(err) })
      }
    }
    setSucceededCount(succeededIds.length)
    setFailures(failed)
    setPhase('result')
    if (succeededIds.length > 0) onDeleted(succeededIds)
  }

  if (phase === 'result') {
    const allOk = failures.length === 0
    return (
      <Modal
        title="Assignments Deleted"
        size="md"
        onClose={onClose}
        footer={<Button variant="primary" onClick={onClose}>Done</Button>}
      >
        {allOk ? (
          <div className="flex items-center gap-2 text-[var(--color-success)]">
            <CheckCircle size={20} aria-hidden="true" />
            <span className="text-base font-medium">
              {succeededCount} assignment{succeededCount !== 1 ? 's' : ''} deleted
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertCircle size={20} aria-hidden="true" />
              <span className="text-base font-medium">
                {succeededCount} deleted · {failures.length} failed
              </span>
            </div>
            <div className="space-y-2">
              {failures.map(f => (
                <div
                  key={f.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-error)] px-4 py-3"
                  style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}
                >
                  <p className="text-sm font-medium text-[var(--color-text-body)]">{f.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    )
  }

  const deleting = phase === 'deleting'

  return (
    <Modal
      title={`Delete ${count} assignment${plural}?`}
      size="md"
      onClose={() => !deleting && onClose()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : `Delete ${count} Assignment${plural}`}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm font-semibold text-[var(--color-error)]">
        This permanently deletes the selected assignment{plural} from Canvas — including all
        student submissions and grades. This cannot be undone, and there is no Change Log entry
        to revert it.
      </p>

      {error && (
        <div
          className="mb-3 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--color-error)] p-3 text-sm text-[var(--color-error)]"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 12%, var(--color-bg-surface))' }}
          role="alert"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="max-h-72 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {assignments.map(a => (
          <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="flex-1 truncate text-[var(--color-text-body)]">{a.name}</span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{a.pointsPossible ?? '—'} pts</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function translate(err) {
  if (err instanceof AuthError) {
    return "You don't have permission to delete this assignment, or your Canvas token needs reconnecting."
  }
  if (err instanceof NotFoundError) return 'This assignment no longer exists in Canvas (it may already be deleted).'
  if (err instanceof RateLimitError) return 'Canvas is temporarily throttling requests. Try again in a moment.'
  if (err?.statusCode === 422) return 'Canvas flagged a validation error with this assignment.'
  return 'Canvas had a temporary problem. This usually works on retry.'
}
