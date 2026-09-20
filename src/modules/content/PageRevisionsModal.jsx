import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { RotateCcw, Loader, AlertCircle, CheckCircle, ChevronRight, ChevronDown } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import Callout from '../../components/Callout.jsx'
import Spinner from '../../components/Spinner.jsx'
import { getPage, getPageRevisions, getPageRevision, revertPageRevision } from '../../api/pages.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { AuthError, NotFoundError, RateLimitError } from '../../api/errors.js'

function translate(err) {
  if (err instanceof AuthError) return "You don't have permission to view this page's history, or your Canvas token needs reconnecting."
  if (err instanceof NotFoundError) return 'This page no longer exists in Canvas (it may have been deleted or renamed).'
  if (err instanceof RateLimitError) return 'Canvas is temporarily throttling requests. Try again in a moment.'
  return 'Canvas had a temporary problem. This usually works on retry.'
}

function formatTimestamp(iso) {
  if (!iso) return 'Unknown date'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// Revision bodies are Canvas-authored HTML. They are sanitized before render
// and images are stripped so a preview never issues a network request.
function previewHtml(body) {
  const clean = DOMPurify.sanitize(body ?? '')
  return clean.replace(/<img[^>]*>/gi, '')
}

/**
 * PageRevisionsModal — per-page undo, built on Canvas's own page revisions.
 *
 * Revisions are the only real undo Canvas offers on any resource this extension
 * touches, which is why they are a first-class part of V1 rather than a later
 * addition (doc 21, Decision 5). Restoring does not discard history: Canvas
 * writes the restored content as a *new* revision, so a restore is itself
 * revertable.
 *
 * Restore is a Canvas write, so it is PIN-gated and audit-logged like every
 * other write in the extension.
 */
export default function PageRevisionsModal({ page, courseId, courseName, onClose, onReverted }) {
  const { requirePin } = usePinGate()
  const [revisions, setRevisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [bodies, setBodies] = useState({})        // revisionId -> html | 'error'
  const [confirmingId, setConfirmingId] = useState(null)
  const [revertingId, setRevertingId] = useState(null)
  const [result, setResult] = useState(null)

  // Canvas addresses a page by its slug, and restoring a revision with a
  // different title renames the page — which changes that slug. The prop is a
  // snapshot from when the modal opened, so the live slug is tracked here and
  // every call below goes through it.
  const [pageUrl, setPageUrl] = useState(page.url)
  const [pageTitle, setPageTitle] = useState(page.title)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const fetched = await getPageRevisions(courseId, pageUrl)
        if (!cancelled) setRevisions(fetched)
      } catch (err) {
        if (!cancelled) setError(translate(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [courseId, pageUrl])

  // The list endpoint returns summaries only. A body is fetched once, the first
  // time a teacher opens that revision, and cached for the life of the modal.
  async function toggleExpand(revision) {
    if (expandedId === revision.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(revision.id)
    if (bodies[revision.id] !== undefined) return
    try {
      const full = await getPageRevision(courseId, pageUrl, revision.id)
      setBodies(prev => ({ ...prev, [revision.id]: full.body ?? '' }))
    } catch {
      setBodies(prev => ({ ...prev, [revision.id]: 'error' }))
    }
  }

  async function handleRestore(revision) {
    setConfirmingId(null)
    await requirePin(
      {
        action: 'page_revision_restore',
        summary: `Restored "${pageTitle}" to its ${formatTimestamp(revision.updatedAt)} revision in ${courseName}`,
        courseId,
        courseName,
      },
      () => runRestore(revision),
    )
  }

  async function runRestore(revision) {
    setRevertingId(revision.id)
    setResult(null)
    try {
      await revertPageRevision(courseId, pageUrl, revision.id)

      // Re-resolve by page_id, which never changes, rather than reusing the
      // slug we just invalidated. Reading it back is also the only way to learn
      // the new slug: Canvas derives it from the title it just restored.
      const refreshed = page.id
        ? await getPage(courseId, page.id)
        : await getPage(courseId, pageUrl)
      setPageUrl(refreshed.url)
      setPageTitle(refreshed.title)

      const fetched = await getPageRevisions(courseId, refreshed.url)
      setRevisions(fetched)
      setBodies({})
      setExpandedId(null)
      setResult({ ok: true, timestamp: revision.updatedAt, renamedTo: refreshed.url !== pageUrl ? refreshed.title : null })
      onReverted?.()
    } catch (err) {
      setResult({ ok: false, message: translate(err) })
    } finally {
      setRevertingId(null)
    }
  }

  return (
    <Modal
      title={`Revisions — ${pageTitle}`}
      subtitle="Restoring saves the old content as a new revision. Nothing in this history is lost."
      onClose={onClose}
      size="lg"
      footer={<Button variant="primary" onClick={onClose}>Close</Button>}
    >
      <div aria-live="polite">
        {result?.ok && (
          <Callout tone="success" title="Page restored" className="mb-4">
            <p>This page now matches its {formatTimestamp(result.timestamp)} revision.</p>
            {result.renamedTo && (
              <p className="mt-1" style={{ color: 'var(--color-warning)' }}>
                It was renamed to &ldquo;{result.renamedTo}&rdquo;, so its Canvas address changed.
                Links pointing at the old address will no longer resolve.
              </p>
            )}
          </Callout>
        )}
        {result && !result.ok && (
          <Callout tone="error" title="Restore failed" className="mb-4">
            {result.message}
          </Callout>
        )}
      </div>

      {loading && (
        <div className="py-10">
          <Spinner label="Loading revision history…" showLabel />
        </div>
      )}

      {!loading && error && (
        <Callout tone="error" title="Could not load revisions">{error}</Callout>
      )}

      {!loading && !error && revisions.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          Canvas has no saved revisions for this page yet.
        </p>
      )}

      {!loading && !error && revisions.length > 0 && (
        <ul className="space-y-2">
          {revisions.map(revision => {
            const expanded = expandedId === revision.id
            const body = bodies[revision.id]
            // A revision carrying a different title is the one case where
            // restoring is not purely safe: changing a page's title changes its
            // URL, silently breaking every inbound link (doc 21, Decision 3).
            const titleChanges = !!revision.title && revision.title !== pageTitle
            return (
              <li
                key={revision.id}
                className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--color-bg-page)]">
                  <button
                    className="flex items-center gap-2 min-w-0 text-left"
                    onClick={() => toggleExpand(revision)}
                    aria-expanded={expanded}
                  >
                    {expanded
                      ? <ChevronDown size={16} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                      : <ChevronRight size={16} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />}
                    <span className="text-sm text-[var(--color-text-body)] truncate">
                      {formatTimestamp(revision.updatedAt)}
                    </span>
                    {revision.latest && <Badge tone="success">Current</Badge>}
                    {titleChanges && <Badge tone="warning">Different title</Badge>}
                  </button>

                  {revision.latest ? (
                    <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                      This is the live version
                    </span>
                  ) : revertingId === revision.id ? (
                    <Loader size={16} className="shrink-0 animate-spin" style={{ color: 'var(--cpt-color)' }} aria-label="Restoring" />
                  ) : confirmingId === revision.id ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-[var(--color-text-secondary)]">Restore this version?</span>
                      <Button variant="danger" size="sm" onClick={() => handleRestore(revision)}>Confirm</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => setConfirmingId(revision.id)}
                      disabled={revertingId !== null}
                    >
                      Restore
                    </Button>
                  )}
                </div>

                {titleChanges && confirmingId === revision.id && (
                  <p
                    className="border-t border-[var(--color-border-subtle)] px-4 py-2 text-xs font-medium text-[var(--color-warning)]"
                    role="alert"
                  >
                    This version is titled &ldquo;{revision.title}&rdquo;. Restoring it renames the
                    page, which changes its Canvas URL and breaks links pointing at it from
                    modules, the syllabus, and other pages.
                  </p>
                )}

                {expanded && (
                  <div className="border-t border-[var(--color-border-subtle)] px-4 py-3">
                    {body === undefined && (
                      <Spinner size="sm" label="Loading this version…" showLabel inline />
                    )}
                    {body === 'error' && (
                      <p className="flex items-center gap-1.5 text-xs text-[var(--color-error)]">
                        <AlertCircle size={13} aria-hidden="true" />
                        Could not load this version&apos;s content.
                      </p>
                    )}
                    {typeof body === 'string' && body !== 'error' && (
                      body.trim() === '' ? (
                        <p className="text-xs text-[var(--color-text-muted)]">This version was empty.</p>
                      ) : (
                        <div
                          className="max-h-56 overflow-y-auto text-sm text-[var(--color-text-body)]"
                          dangerouslySetInnerHTML={{ __html: previewHtml(body) }}
                        />
                      )
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!loading && !error && revisions.some(r => r.latest) && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
          <CheckCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          Restoring changes the page title and body only. Published status and editing
          permissions stay as they are now.
        </p>
      )}
    </Modal>
  )
}
