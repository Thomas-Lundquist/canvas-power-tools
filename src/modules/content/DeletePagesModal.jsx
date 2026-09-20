import { useState } from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import { deletePage } from '../../api/pages.js'
import { AuthError, NotFoundError, RateLimitError } from '../../api/errors.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { PinRequiredError } from '../../security/pin.js'

/**
 * DeletePagesModal — permanently deletes the already-selected pages from
 * Canvas.
 *
 * Delete is the one irreversible action in the Pages Tool: a deleted page takes
 * its revision history with it, so the per-page Revert that covers every other
 * write cannot recover it. It therefore uses `forcePrompt` on the PIN gate,
 * matching how other destructive operations in the extension behave (doc 21,
 * Safety; doc 11, Forced PIN Re-Entry).
 */
export default function DeletePagesModal({ pages, courseId, courseName, onClose, onDeleted }) {
  const { requirePin } = usePinGate()
  const [phase, setPhase] = useState('confirm') // confirm | deleting | result
  const [error, setError] = useState(null)
  const [failures, setFailures] = useState([])
  const [succeededCount, setSucceededCount] = useState(0)

  const count = pages.length
  const plural = count !== 1 ? 's' : ''
  const frontPageCount = pages.filter(p => p.frontPage).length

  async function handleConfirm() {
    setError(null)
    try {
      await requirePin(
        {
          action: 'pages_delete',
          summary: `Deleted ${count} page${plural} from ${courseName}`,
          courseId,
          courseName,
          warning: `This permanently deletes ${count} page${plural} from Canvas, along with ${count !== 1 ? 'their' : 'its'} revision history. This cannot be undone.`,
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
    const succeededUrls = []
    const failed = []
    for (const page of pages) {
      try {
        await deletePage(courseId, page.url)
        succeededUrls.push(page.url)
      } catch (err) {
        failed.push({ url: page.url, title: page.title, reason: translate(err) })
      }
    }
    setSucceededCount(succeededUrls.length)
    setFailures(failed)
    setPhase('result')
    if (succeededUrls.length > 0) onDeleted(succeededUrls)
  }

  if (phase === 'result') {
    const allOk = failures.length === 0
    return (
      <Modal
        title="Pages Deleted"
        size="md"
        onClose={onClose}
        footer={<Button variant="primary" onClick={onClose}>Done</Button>}
      >
        {allOk ? (
          <div className="flex items-center gap-2 text-[var(--color-success)]">
            <CheckCircle size={20} aria-hidden="true" />
            <span className="text-base font-medium">
              {succeededCount} page{succeededCount !== 1 ? 's' : ''} deleted
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
                  key={f.url}
                  className="rounded-[var(--radius-card)] border border-[var(--color-error)] px-4 py-3"
                  style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}
                >
                  <p className="text-sm font-medium text-[var(--color-text-body)]">{f.title}</p>
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
      title={`Delete ${count} page${plural}?`}
      size="md"
      onClose={() => !deleting && onClose()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : `Delete ${count} Page${plural}`}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm font-semibold text-[var(--color-error)]">
        This permanently deletes the selected page{plural} from Canvas, along with
        {count !== 1 ? ' their' : ' its'} revision history. This cannot be undone — Revisions
        cannot bring a deleted page back.
      </p>

      <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
        Any module item, syllabus link, or link from another page that points at
        {count !== 1 ? ' these pages' : ' this page'} will break.
      </p>

      {frontPageCount > 0 && (
        <p className="mb-3 text-sm font-medium text-[var(--color-warning)]" role="alert">
          {frontPageCount === 1
            ? 'One of these is the course front page.'
            : `${frontPageCount} of these are course front pages.`}{' '}
          Deleting it leaves the course home page empty until another page is set.
        </p>
      )}

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
        {pages.map(p => (
          <div key={p.url} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="flex-1 truncate text-[var(--color-text-body)]">{p.title}</span>
            {p.frontPage && <Badge tone="warning">Front page</Badge>}
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {p.published ? 'Published' : 'Unpublished'}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function translate(err) {
  if (err instanceof AuthError) {
    return "You don't have permission to delete this page, or your Canvas token needs reconnecting."
  }
  if (err instanceof NotFoundError) return 'This page no longer exists in Canvas (it may already be deleted).'
  if (err instanceof RateLimitError) return 'Canvas is temporarily throttling requests. Try again in a moment.'
  if (err?.statusCode === 422) return 'Canvas flagged a validation error with this page.'
  return 'Canvas had a temporary problem. This usually works on retry.'
}
