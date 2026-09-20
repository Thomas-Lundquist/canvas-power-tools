import { useState } from 'react'
import { CheckCircle, AlertCircle, Loader, Circle, ChevronRight, ChevronDown } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import { updatePage } from '../../api/pages.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { AuthError, NotFoundError, RateLimitError } from '../../api/errors.js'
import { buildPageChanges, groupChangesByPage, formatEditingRoles } from './pagesHelpers.js'

const FIELD_LABELS = {
  published: 'Status',
  editingRoles: 'Who Can Edit',
}

function formatValue(field, value) {
  if (field === 'published') return value ? 'Published' : 'Unpublished'
  if (field === 'editingRoles') return formatEditingRoles(value)
  return String(value)
}

function getErrorStatus(err) {
  if (err instanceof AuthError) return 401
  if (err instanceof NotFoundError) return 404
  if (err instanceof RateLimitError) return 429
  return err?.statusCode ?? null
}

function translateError(err) {
  if (err instanceof AuthError) return "You don't have permission to edit this page, or your Canvas token needs reconnecting."
  if (err instanceof NotFoundError) return 'This page no longer exists in Canvas (it may have been deleted or renamed).'
  if (err instanceof RateLimitError) return 'Canvas is temporarily throttling requests. Try again in a moment.'
  if (err?.statusCode === 422) return 'Canvas flagged a validation error with one or more fields.'
  return 'Canvas had a temporary problem. This usually works on retry.'
}

/**
 * PagesPreviewDiff — preview / apply for the Pages Tool's bulk edits.
 *
 * Mirrors the Bulk Editor's PreviewDiff: show exactly what changes, PIN-gate
 * the write, apply page by page, report per-page failures with a retry.
 *
 * Unlike the Bulk Editor there is no change-log entry. Undo for pages comes
 * from Canvas's own page revisions (doc 21, Decision 5), which are per page and
 * survive independently of anything this extension stores; a parallel local log
 * would be a second, weaker source of truth. The audit log still records every
 * write via the PIN gate.
 */
export default function PagesPreviewDiff({
  selectedPages, actions, courseId, courseName, onCancel, onDone,
}) {
  const [phase, setPhase] = useState('preview')
  const [pageStatus, setPageStatus] = useState({})
  const [succeededPages, setSucceededPages] = useState([])
  const [failures, setFailures] = useState([])
  const [showSucceeded, setShowSucceeded] = useState(false)
  const { requirePin } = usePinGate()

  const changes = buildPageChanges(selectedPages, actions)
  const grouped = groupChangesByPage(changes)
  const totalFields = changes.length
  const totalPages = grouped.length
  const succeededFieldCount = succeededPages.reduce((sum, p) => sum + p.fields.length, 0)

  // Pages already holding the target values produce no diff rows — say so
  // rather than showing an empty confirm dialog.
  const unchangedCount = selectedPages.length - totalPages

  const MODAL_TITLES = { preview: 'Preview Changes', applying: 'Applying Changes…', result: 'Changes Applied' }
  const modalClose = phase === 'preview' ? onCancel : phase === 'result' ? onDone : undefined

  async function handleConfirm() {
    await requirePin(
      {
        action: 'pages_bulk_edit',
        summary: `${totalFields} field change${totalFields !== 1 ? 's' : ''} across ${totalPages} page${totalPages !== 1 ? 's' : ''} in ${courseName}`,
        courseId,
        courseName,
      },
      () => runApply(grouped),
    )
  }

  async function runApply(pagesToApply) {
    setPhase('applying')

    const batchSuccesses = []
    const batchFailures = []

    for (const page of pagesToApply) {
      setPageStatus(prev => ({ ...prev, [page.url]: 'applying' }))

      // One PUT per page carries every changed field, so a page is either
      // fully updated or fully failed — never half-applied.
      const payload = {}
      for (const change of page.fields) payload[change.field] = change.newValue

      try {
        await updatePage(courseId, page.url, payload)
        batchSuccesses.push(page)
        setPageStatus(prev => ({ ...prev, [page.url]: 'done' }))
      } catch (err) {
        batchFailures.push({
          pageUrl: page.url,
          pageTitle: page.title,
          status: getErrorStatus(err),
          reason: translateError(err),
        })
        setPageStatus(prev => ({ ...prev, [page.url]: 'failed' }))
      }
    }

    setSucceededPages(prev => [...prev, ...batchSuccesses])
    setFailures(batchFailures)
    setPhase('result')
  }

  async function handleRetry() {
    const failedUrls = new Set(failures.map(f => f.pageUrl))
    const pagesToRetry = grouped.filter(p => failedUrls.has(p.url))
    setFailures([])
    setShowSucceeded(false)
    await runApply(pagesToRetry)
  }

  if (phase === 'preview') {
    return (
      <Modal title={MODAL_TITLES.preview} onClose={modalClose} size="lg">
        {totalPages === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            Every selected page already has these settings. Nothing to change.
          </p>
        ) : (
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-[var(--color-border)]">
            {grouped.map(page => (
              <PageBlock key={page.url} page={page} />
            ))}
          </div>
        )}

        {unchangedCount > 0 && totalPages > 0 && (
          <p className="pt-3 text-xs text-[var(--color-text-muted)]">
            {unchangedCount} selected page{unchangedCount !== 1 ? 's' : ''} already
            {unchangedCount !== 1 ? ' have' : ' has'} these settings and will be left alone.
          </p>
        )}

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {totalFields} field{totalFields !== 1 ? 's' : ''} to change across {totalPages} page{totalPages !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirm} disabled={totalPages === 0}>
              Confirm &amp; Apply
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (phase === 'applying') {
    return (
      <Modal title={MODAL_TITLES.applying} size="lg">
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-[var(--color-border)]">
          {grouped.map(page => (
            <PageBlock
              key={page.url}
              page={page}
              status={pageStatus[page.url]}
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
              {succeededFieldCount} field{succeededFieldCount !== 1 ? 's' : ''} updated across {succeededPages.length} page{succeededPages.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertCircle size={20} aria-hidden="true" />
              <span className="text-base font-medium">
                {succeededPages.length} updated · {failures.length} failed
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--color-error)]">Failed</p>
              {failures.map(f => (
                <div
                  key={f.pageUrl}
                  className="rounded-[var(--radius-card)] border border-[var(--color-error)] px-4 py-3"
                  style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}
                >
                  <p className="text-sm font-medium text-[var(--color-text-body)]">
                    {f.pageTitle}
                    {f.status && (
                      <span className="ml-2 text-xs text-[var(--color-text-muted)] font-normal">({f.status})</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.reason}</p>
                </div>
              ))}
            </div>

            {succeededPages.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] transition-colors duration-75"
                  onClick={() => setShowSucceeded(s => !s)}
                >
                  {showSucceeded
                    ? <ChevronDown size={14} aria-hidden="true" />
                    : <ChevronRight size={14} aria-hidden="true" />}
                  {succeededPages.length} succeeded
                </button>
                {showSucceeded && (
                  <ul className="mt-2 space-y-1 pl-5 list-disc">
                    {succeededPages.map(p => (
                      <li key={p.url} className="text-sm text-[var(--color-text-secondary)]">{p.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-xs text-[var(--color-text-muted)]">
          To undo a change to one page, open its Revisions and restore an earlier version.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-[var(--color-border)]">
        {!allSucceeded && (
          <Button variant="secondary" onClick={handleRetry}>Retry all failed</Button>
        )}
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    </Modal>
  )
}

function PageBlock({ page, status, showStatus = false }) {
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
        <p className="text-sm font-semibold text-[var(--color-text-body)] mb-1.5">{page.title}</p>
        <div className="space-y-1">
          {page.fields.map((change, i) => (
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
