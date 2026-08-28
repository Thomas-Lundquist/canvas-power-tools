import { useState, useEffect, useCallback } from 'react'
import { Plus, Folder, Search, Download, Loader, Trash2, Pencil, ArrowRight, Layers, HelpCircle, X, CheckCircle, Check, Copy, CheckCircle2 } from 'lucide-react'
import { getRubrics, saveRubric, deleteRubric as deleteLocalRubric, newRubricId, newCriterionId, newRatingId } from '../../storage/rubrics.js'
import { getRubrics as getCanvasRubrics } from '../../api/rubrics.js'
import { getCourses } from '../../api/courses.js'
import RubricEditor from './RubricEditor.jsx'
import DeployRubric from './DeployRubric.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import Callout from '../../components/Callout.jsx'

const GRADING_ACCENT = { '--domain-color': 'var(--color-domain-grading)' }

function maxPoints(rubric) {
  return rubric.criteria.reduce((sum, c) => sum + c.ratings.reduce((m, r) => Math.max(m, r.points), 0), 0)
}

export default function RubricManager() {
  const [rubrics, setRubrics]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [selectedId, setSelectedId]       = useState(null)
  const [rightPanel, setRightPanel]       = useState('empty') // 'empty' | 'view' | 'edit' | 'deploy'
  const [isNewDraft, setIsNewDraft]       = useState(false)
  const [search, setSearch]               = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showImport, setShowImport]       = useState(false)
  const [copiedId, setCopiedId]           = useState(null)
  const [toast, setToast]                 = useState(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  async function reload() {
    const data = await getRubrics()
    setRubrics(data.items)
    return data.items
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? rubrics.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : rubrics

  const selectedRubric = rubrics.find(r => r.id === selectedId) ?? null

  function selectRubric(rubric) {
    setSelectedId(rubric.id)
    setIsNewDraft(false)
    setRightPanel('view')
  }

  function startNew() {
    setSelectedId(null)
    setIsNewDraft(true)
    setRightPanel('edit')
  }

  function startEdit() {
    setIsNewDraft(false)
    setRightPanel('edit')
  }

  function startDeploy() {
    setRightPanel('deploy')
  }

  async function handleSave(rubricData) {
    const base = isNewDraft
      ? { id: newRubricId(), createdAt: new Date().toISOString(), lastUsed: null }
      : { ...selectedRubric }
    const saved = {
      ...base,
      ...rubricData,
      pointsPossible: maxPoints({ criteria: rubricData.criteria }),
    }
    await saveRubric(saved)
    await reload()
    setSelectedId(saved.id)
    setIsNewDraft(false)
    setRightPanel('view')
    showToast(`Rubric “${saved.name}” saved`)
  }

  function handleCancelEdit() {
    if (isNewDraft) {
      setSelectedId(null)
      setIsNewDraft(false)
      setRightPanel('empty')
    } else {
      setRightPanel('view')
    }
  }

  async function handleDelete(id) {
    const target = rubrics.find(r => r.id === id)
    await deleteLocalRubric(id)
    if (selectedId === id) {
      setSelectedId(null)
      setRightPanel('empty')
    }
    await reload()
    setConfirmDelete(null)
    if (target) showToast(`Deleted rubric “${target.name}”`)
  }

  async function handleDuplicate(rubric) {
    const duped = {
      ...rubric,
      id: newRubricId(),
      name: `${rubric.name} (Copy)`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      criteria: rubric.criteria.map(c => ({
        ...c,
        id: newCriterionId(),
        ratings: c.ratings.map(r => ({ ...r, id: newRatingId() })),
      })),
    }
    await saveRubric(duped)
    const items = await reload()
    const saved = items.find(r => r.id === duped.id)
    if (saved) { setSelectedId(saved.id); setRightPanel('view') }
    setCopiedId(duped.id)
    setTimeout(() => setCopiedId(null), 2000)
    showToast(`Duplicated as “${duped.name}”`)
  }

  async function handleImport(rubricData) {
    await saveRubric({
      ...rubricData,
      id: newRubricId(),
      createdAt: new Date().toISOString(),
      lastUsed: null,
    })
    await reload()
    setShowImport(false)
  }

  return (
    <div className="space-y-6">
      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] p-3 text-sm text-[var(--color-text-body)]"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-success) 12%, var(--color-bg-surface))' }}
          role="status"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
            {toast}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Rubric Manager & Library"
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => setShowImport(true)}>Import</Button>
            <Button variant="primary" icon={Plus} onClick={startNew}>Build New Rubric</Button>
          </>
        }
      >
        Build, save, and deploy rubrics across Canvas courses.
      </PageHeader>

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* ── Left: Rubric List ──────────────────────────────────────────── */}
        <div className="space-y-3 lg:col-span-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-disabled)]" aria-hidden="true" />
            <input
              className="input pl-8 text-sm"
              placeholder="Search rubrics…"
              aria-label="Search rubrics"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <h2 className="section-label !mb-0 flex items-center gap-1.5">
            <Folder className="h-3.5 w-3.5 text-[var(--color-domain-grading)]" aria-hidden="true" />
            Saved rubrics ({filtered.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-text-disabled)]">
              <Loader className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="space-y-2 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] p-6 text-center">
              <p className="text-sm font-medium text-[var(--color-text-muted)]">
                {search.trim() ? 'No rubrics match' : 'No rubrics yet'}
              </p>
              {!search.trim() && (
                <button
                  onClick={startNew}
                  className="text-xs font-medium text-[var(--color-domain-grading)] hover:underline"
                >
                  Build first rubric →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => {
                const isSelected = selectedId === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRubric(r)}
                    className={`block w-full cursor-pointer rounded-[var(--radius-card)] border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-[var(--color-border)] border-l-4 border-l-[var(--color-domain-grading)] bg-[var(--color-bg-surface)]'
                        : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] hover:border-[var(--color-border)]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <Badge tone="success">{r.category ?? 'General'}</Badge>
                      <span className="list-row-meta text-xs font-medium text-[var(--color-text-muted)]">
                        {maxPoints(r)} pts
                      </span>
                    </div>
                    <h4 className="mb-1 text-sm font-semibold leading-tight text-[var(--color-text-body)]">{r.name}</h4>
                    <div className="list-row-meta mt-1.5 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-1.5 text-xs text-[var(--color-text-disabled)]">
                      <span>{r.criteria.length} {r.criteria.length === 1 ? 'criterion' : 'criteria'}</span>
                      <div className="flex items-center gap-1.5">
                        {r.lastUsed && <span>Used {new Date(r.lastUsed).toLocaleDateString()}</span>}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => { e.stopPropagation(); handleDuplicate(r) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDuplicate(r) } }}
                          className="rounded-[var(--radius-control)] p-0.5 text-[var(--color-text-disabled)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)]"
                          aria-label="Duplicate rubric"
                          title="Duplicate rubric"
                        >
                          {copiedId === r.id
                            ? <Check className="h-3.5 w-3.5 text-[var(--color-domain-grading)]" aria-hidden="true" />
                            : <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          }
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right: Detail Panel ────────────────────────────────────────── */}
        <div className="card domain-accent min-h-[400px] overflow-hidden lg:col-span-8" style={GRADING_ACCENT}>
          <div className="p-6">
            {rightPanel === 'empty' && (
              <EmptyPanel onNew={startNew} />
            )}
            {rightPanel === 'view' && selectedRubric && (
              <RubricDetailView
                rubric={selectedRubric}
                onEdit={startEdit}
                onDeploy={startDeploy}
                onDelete={() => setConfirmDelete(selectedRubric.id)}
              />
            )}
            {rightPanel === 'edit' && (
              <RubricEditor
                key={selectedId ?? 'new'}
                rubric={isNewDraft ? null : selectedRubric}
                onSave={handleSave}
                onCancel={handleCancelEdit}
                onDelete={isNewDraft ? null : () => setConfirmDelete(selectedRubric.id)}
              />
            )}
            {rightPanel === 'deploy' && selectedRubric && (
              <DeployRubric
                rubric={selectedRubric}
                onDone={() => setRightPanel('view')}
                onBack={() => setRightPanel('view')}
              />
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <DeleteModal
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showImport && (
        <ImportFromCanvas
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}

// ─── Right panel: view mode ───────────────────────────────────────────────────

function RubricDetailView({ rubric, onEdit, onDeploy, onDelete }) {
  const pts = maxPoints(rubric)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="neutral">{rubric.category ?? 'General'}</Badge>
            <span className="list-row-meta text-xs font-medium text-[var(--color-text-muted)]">
              Total: {pts} pts
            </span>
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-[var(--color-text-body)]">
            {rubric.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="primary" size="sm" icon={ArrowRight} onClick={onDeploy}>Deploy</Button>
          <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>Edit</Button>
          <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete} aria-label="Delete rubric">Delete</Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="section-label !mb-0 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-[var(--cpt-color)]" aria-hidden="true" />
          Criteria &amp; rating breakdown
        </h3>

        {rubric.criteria.map((c, idx) => {
          const cPts = c.ratings.reduce((m, r) => Math.max(m, r.points), 0)
          const sorted = [...c.ratings].sort((a, b) => b.points - a.points)
          return (
            <div key={c.id} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              <div className="card-titlebar">
                <span className="normal-case tracking-normal text-[var(--color-text-body)]">
                  {idx + 1}. {c.description || <em className="text-[var(--color-text-disabled)]">Unnamed</em>}
                </span>
                <Badge tone="neutral">Max {cPts} pts</Badge>
              </div>
              <div className="space-y-2 bg-[var(--color-bg-surface)] p-3">
                {c.longDescription && (
                  <p className="border-b border-[var(--color-border-subtle)] pb-2 text-xs text-[var(--color-text-muted)]">{c.longDescription}</p>
                )}
                <div className="divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-page)]">
                  {sorted.map(rt => (
                    <div key={rt.id} className="flex items-start gap-4 p-3 transition-colors hover:bg-[var(--color-bg-surface)]">
                      <div className="w-24 shrink-0">
                        <span className="list-row-meta inline-block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2.5 py-1 text-center text-xs font-semibold text-[var(--color-text-body)]">
                          {rt.points} pts
                        </span>
                      </div>
                      <p className="flex-1 pt-0.5 text-xs font-medium leading-relaxed text-[var(--color-text-body)]">
                        {rt.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Callout tone="warning" title="Canvas lock note">
        Canvas locks rubrics once graded. Deploy creates a new copy in the target course — it does not modify rubrics already attached to graded submissions.
      </Callout>
    </div>
  )
}

// ─── Right panel: empty state ─────────────────────────────────────────────────

function EmptyPanel({ onNew }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center space-y-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-hover)]">
        <Folder className="h-7 w-7 text-[var(--color-domain-grading)]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-body)]">No rubric selected</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Select from the list or build a new one.</p>
      </div>
      <Button variant="primary" icon={Plus} onClick={onNew}>Build First Rubric</Button>
    </div>
  )
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rubric-del-title"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
        <h2 id="rubric-del-title" className="text-base font-semibold text-[var(--color-text-body)]">
          Delete rubric?
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Removes the local template only. Rubrics already deployed to Canvas are not affected.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Import from Canvas modal ──────────────────────────────────────────────────

function ImportFromCanvas({ onImport, onClose }) {
  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [rubrics, setRubrics]               = useState([])
  const [loadingRubrics, setLoadingRubrics] = useState(false)
  const [selectedIds, setSelectedIds]       = useState(new Set())
  const [importing, setImporting]           = useState(false)
  const [imported, setImported]             = useState(0)

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) setSelectedCourseId(list[0].id)
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  useEffect(() => {
    if (!selectedCourseId) return
    setLoadingRubrics(true)
    setRubrics([])
    setSelectedIds(new Set())
    getCanvasRubrics(selectedCourseId)
      .then(setRubrics)
      .catch(() => setRubrics([]))
      .finally(() => setLoadingRubrics(false))
  }, [selectedCourseId])

  function toggle(id) {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function doImport() {
    setImporting(true)
    let count = 0
    for (const r of rubrics.filter(r => selectedIds.has(r.id))) {
      await onImport({
        name: r.title,
        criteria: r.criteria.map(c => ({
          ...c,
          ratings: [...c.ratings].sort((a, b) => b.points - a.points),
        })),
      })
      count++
    }
    setImported(count)
    setImporting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rubric-import-title"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <div className="card-titlebar">
          <span id="rubric-import-title">Import rubrics from Canvas</span>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-control)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {imported > 0 ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-[var(--color-domain-grading)]">
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
              {imported} rubric{imported !== 1 ? 's' : ''} imported
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="rubric-import-course" className="section-label">Course</label>
                <select
                  id="rubric-import-course"
                  className="input text-sm"
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  disabled={loadingCourses}
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <p className="section-label">Rubrics in this course</p>
                {loadingRubrics ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-[var(--color-text-disabled)]">
                    <Loader className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
                  </div>
                ) : rubrics.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--color-text-disabled)]">
                    No rubrics in this course
                  </p>
                ) : (
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] p-2">
                    {rubrics.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggle(r.id)}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-bg-hover)]"
                      >
                        <span
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] transition-colors"
                          style={selectedIds.has(r.id)
                            ? { backgroundColor: 'var(--color-domain-grading)', borderColor: 'var(--color-domain-grading)' }
                            : { backgroundColor: 'var(--color-bg-surface)' }}
                        >
                          {selectedIds.has(r.id) && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[var(--color-text-body)]">{r.title}</p>
                          <p className="list-row-meta text-xs text-[var(--color-text-disabled)]">
                            {r.criteria.length} criteria · {r.pointsPossible} pts
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--color-border-subtle)] px-5 pb-5 pt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {imported > 0 ? 'Close' : 'Cancel'}
          </Button>
          {imported === 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={importing ? undefined : Download}
              onClick={doImport}
              disabled={selectedIds.size === 0 || importing}
            >
              {importing
                ? <><Loader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Importing…</>
                : `Import${selectedIds.size > 0 ? ` ${selectedIds.size}` : ''} rubric${selectedIds.size !== 1 ? 's' : ''}`
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
