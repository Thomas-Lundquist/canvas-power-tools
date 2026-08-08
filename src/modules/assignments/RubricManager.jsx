import { useState, useEffect, useCallback } from 'react'
import { Plus, Folder, Search, Download, Loader, Trash2, Pencil, ArrowRight, Layers, HelpCircle, X, CheckCircle, Check, Copy, CheckCircle2 } from 'lucide-react'
import { getRubrics, saveRubric, deleteRubric as deleteLocalRubric, newRubricId, newCriterionId, newRatingId } from '../../storage/rubrics.js'
import { getRubrics as getCanvasRubrics } from '../../api/rubrics.js'
import { getCourses } from '../../api/courses.js'
import RubricEditor from './RubricEditor.jsx'
import DeployRubric from './DeployRubric.jsx'

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
    showToast(`RUBRIC "${saved.name.toUpperCase()}" SAVED SUCCESSFULLY!`)
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
    if (target) showToast(`DELETED RUBRIC "${target.name.toUpperCase()}"`)
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
    showToast(`DUPLICATED AS "${duped.name.toUpperCase()}"!`)
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
        <div className="bg-[var(--color-bauhaus-ochre-light)] border-2 border-[var(--color-stroke)] p-3 rounded-[2px] font-mono text-xs font-bold text-[var(--color-stroke)] flex items-center justify-between">
          <div className="flex items-center gap-2 uppercase">
            <CheckCircle2 className="w-4 h-4 text-[var(--color-domain-grading)]" />
            {toast}
          </div>
          <button onClick={() => setToast(null)} className="hover:text-[var(--color-domain-alert)] font-bold">✕</button>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-stroke)] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 bg-[var(--color-domain-grading)] text-white font-mono font-bold text-[10px] uppercase">
            GRADING MODULE // RUBRICS
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-stroke)] uppercase mt-1">
            RUBRIC MANAGER & LIBRARY
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] font-mono mt-0.5">
            Build, save, and deploy rubrics across Canvas courses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 bg-[var(--color-canvas-paper)] border border-[var(--color-stroke)] font-mono font-bold text-xs uppercase rounded-[2px] flex items-center gap-1.5 hover:bg-[var(--color-container-inset)]"
          >
            <Download className="w-3.5 h-3.5" />
            IMPORT
          </button>
          <button
            onClick={startNew}
            className="px-4 py-2 bg-[var(--color-domain-grading)] text-white font-mono font-bold text-xs uppercase border border-[var(--color-stroke)] rounded-[2px] flex items-center gap-2 hover:bg-[color-mix(in_srgb,var(--color-domain-grading)_85%,black)]"
          >
            <Plus className="w-4 h-4" />
            BUILD NEW RUBRIC
          </button>
        </div>
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left: Rubric List ──────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-disabled)]" />
            <input
              className="w-full bg-white border border-[var(--color-stroke)] rounded-[2px] text-xs font-mono p-2 pl-8 focus:outline-none focus:ring-1 focus:ring-[var(--color-bauhaus-blue-bright)]"
              placeholder="SEARCH RUBRICS…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-[var(--color-container-inset)] border border-[var(--color-stroke)] p-3 text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 text-[var(--color-stroke)]">
            <Folder className="w-3.5 h-3.5 text-[var(--color-domain-grading)]" />
            SAVED RUBRICS ({filtered.length})
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-[var(--color-text-disabled)] py-12 justify-center font-mono text-xs">
              <Loader className="w-4 h-4 animate-spin" /> LOADING…
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-[var(--color-grid-divider)] rounded-[2px] p-6 text-center space-y-2">
              <p className="text-xs font-mono font-bold uppercase text-[var(--color-text-muted)]">
                {search.trim() ? 'No rubrics match' : 'No rubrics yet'}
              </p>
              {!search.trim() && (
                <button
                  onClick={startNew}
                  className="text-[10px] font-mono font-bold uppercase text-[var(--color-domain-grading)] hover:underline"
                >
                  BUILD FIRST RUBRIC →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => {
                const isSelected = selectedId === r.id
                return (
                  <div
                    key={r.id}
                    onClick={() => selectRubric(r)}
                    className={`p-3 border rounded-[2px] cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-white border-[var(--color-stroke)] border-l-4 border-l-[var(--color-domain-grading)]'
                        : 'bg-[var(--color-canvas-paper)] border-[var(--color-grid-divider)] hover:border-[var(--color-stroke)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold uppercase text-[var(--color-domain-grading)] bg-[color-mix(in_srgb,var(--color-domain-grading)_8%,white)] px-1.5 py-0.5 border border-[color-mix(in_srgb,var(--color-domain-grading)_30%,white)] rounded-[2px]">
                        {r.category ?? 'General'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[var(--color-text-muted)]">
                        {maxPoints(r)} PTS
                      </span>
                    </div>
                    <h4 className="font-bold text-[var(--color-stroke)] text-sm leading-tight mb-1">{r.name}</h4>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-text-disabled)] mt-1.5 pt-1.5 border-t border-[var(--color-grid-divider)]">
                      <span>{r.criteria.length} {r.criteria.length === 1 ? 'CRITERION' : 'CRITERIA'}</span>
                      <div className="flex items-center gap-1.5">
                        {r.lastUsed && <span>USED {new Date(r.lastUsed).toLocaleDateString()}</span>}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDuplicate(r) }}
                          className="p-0.5 rounded-[2px] hover:bg-[var(--color-container-inset)] text-[var(--color-text-disabled)] hover:text-[var(--color-stroke)] transition-colors"
                          aria-label="Duplicate rubric"
                          title="Duplicate rubric"
                        >
                          {copiedId === r.id
                            ? <Check className="w-3.5 h-3.5 text-[var(--color-domain-grading)]" />
                            : <Copy className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right: Detail Panel ────────────────────────────────────────── */}
        <div className="lg:col-span-8 bg-white border border-[var(--color-stroke)] rounded-[2px] p-6 min-h-[400px]">
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
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-grid-divider)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase text-white bg-[var(--color-stroke)] px-2 py-0.5 rounded-[2px]">
              {rubric.category ?? 'General'}
            </span>
            <span className="text-[10px] font-mono font-bold text-[var(--color-text-muted)]">
              TOTAL: {pts} PTS
            </span>
          </div>
          <h2 className="text-2xl font-black text-[var(--color-stroke)] uppercase tracking-tight leading-tight">
            {rubric.name}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDeploy}
            className="px-3 py-1.5 bg-[var(--color-domain-grading)] text-white font-mono font-bold text-xs uppercase border border-[var(--color-stroke)] rounded-[2px] flex items-center gap-1.5 hover:bg-[color-mix(in_srgb,var(--color-domain-grading)_85%,black)]"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            DEPLOY
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 bg-[var(--color-canvas-paper)] text-[var(--color-stroke)] font-mono font-bold text-xs uppercase border border-[var(--color-stroke)] rounded-[2px] flex items-center gap-1.5 hover:bg-[var(--color-container-inset)]"
          >
            <Pencil className="w-3.5 h-3.5" />
            EDIT
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 bg-[var(--color-canvas-paper)] border border-[var(--color-stroke)] rounded-[2px] hover:bg-[color-mix(in_srgb,var(--color-domain-alert)_6%,white)] text-[var(--color-domain-alert)]"
            aria-label="Delete rubric"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-disabled)] flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[var(--color-bauhaus-blue-bright)]" />
          CRITERIA & RATING BREAKDOWN
        </h3>

        {rubric.criteria.map((c, idx) => {
          const cPts = c.ratings.reduce((m, r) => Math.max(m, r.points), 0)
          const sorted = [...c.ratings].sort((a, b) => b.points - a.points)
          return (
            <div key={c.id} className="border border-[var(--color-stroke)] rounded-[2px] overflow-hidden">
              <div className="bg-[var(--color-container-inset)] p-2.5 border-b border-[var(--color-stroke)] flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-[var(--color-stroke)]">
                  {idx + 1}. {c.description || <em className="font-normal text-[var(--color-text-disabled)]">Unnamed</em>}
                </span>
                <span className="font-bold text-[var(--color-bauhaus-blue-bright)] bg-white px-2 py-0.5 border border-[var(--color-stroke)] rounded-[2px] shrink-0 ml-2">
                  MAX {cPts} PTS
                </span>
              </div>
              <div className="p-3 bg-white space-y-2">
                {c.longDescription && (
                  <p className="text-xs text-[var(--color-text-muted)] pb-2 border-b border-[var(--color-grid-divider)]">{c.longDescription}</p>
                )}
                <div className="border border-[var(--color-border)] rounded-[2px] divide-y divide-[var(--color-border)] overflow-hidden bg-[var(--color-canvas-paper)]">
                  {sorted.map(rt => (
                    <div key={rt.id} className="p-3 flex items-start gap-4 hover:bg-white transition-colors">
                      <div className="w-24 shrink-0">
                        <span className="inline-block px-2.5 py-1 bg-white border border-[var(--color-stroke)] text-xs font-black font-mono text-[var(--color-stroke)] text-center w-full rounded-[1px]">
                          {rt.points} PTS
                        </span>
                      </div>
                      <p className="flex-1 text-xs text-[var(--color-text-body)] pt-0.5 leading-relaxed font-sans font-medium">
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

      <div className="p-3 bg-[color-mix(in_srgb,var(--color-bauhaus-ochre-light)_20%,transparent)] border border-[var(--color-stroke)] rounded-[2px] flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-[var(--color-bauhaus-ochre)] shrink-0 mt-0.5" />
        <p className="text-[11px] font-mono text-[var(--color-stroke)] leading-relaxed">
          <strong>Canvas Lock Note:</strong> Canvas locks rubrics once graded. Deploy creates a new copy in the target course — it does not modify rubrics already attached to graded submissions.
        </p>
      </div>
    </div>
  )
}

// ─── Right panel: empty state ─────────────────────────────────────────────────

function EmptyPanel({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] space-y-4 text-center">
      <div className="w-14 h-14 bg-[var(--color-container-inset)] border border-[var(--color-stroke)] rounded-[2px] flex items-center justify-center">
        <Folder className="w-7 h-7 text-[var(--color-domain-grading)]" />
      </div>
      <div>
        <p className="font-mono font-black uppercase text-[var(--color-stroke)] text-sm">NO RUBRIC SELECTED</p>
        <p className="text-xs text-[var(--color-text-muted)] font-mono mt-1">Select from the list or build a new one.</p>
      </div>
      <button
        onClick={onNew}
        className="px-4 py-2 bg-[var(--color-domain-grading)] text-white font-mono font-bold text-xs uppercase border border-[var(--color-stroke)] rounded-[2px] flex items-center gap-2 hover:bg-[color-mix(in_srgb,var(--color-domain-grading)_85%,black)]"
      >
        <Plus className="w-4 h-4" />
        BUILD FIRST RUBRIC
      </button>
    </div>
  )
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rubric-del-title"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white border border-[var(--color-stroke)] rounded-[2px] p-6 max-w-sm w-full space-y-4">
        <h2 id="rubric-del-title" className="font-mono font-black uppercase text-[var(--color-stroke)]">
          DELETE RUBRIC?
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] font-mono leading-relaxed">
          Removes the local template only. Rubrics already deployed to Canvas are not affected.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-[var(--color-canvas-paper)] border border-[var(--color-stroke)] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[var(--color-container-inset)]"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 bg-[var(--color-domain-alert)] text-white border border-[var(--color-stroke)] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[color-mix(in_srgb,var(--color-domain-alert)_85%,black)]"
          >
            DELETE
          </button>
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
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-[var(--color-stroke)] rounded-[2px] w-full max-w-lg">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--color-stroke)] bg-[var(--color-container-inset)]">
          <h3 className="font-mono font-black uppercase text-xs text-[var(--color-stroke)]">
            IMPORT RUBRICS FROM CANVAS
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[color-mix(in_srgb,var(--color-stroke)_10%,transparent)] rounded-[2px]"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[var(--color-stroke)]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {imported > 0 ? (
            <div className="flex items-center gap-2 text-[var(--color-domain-grading)] py-4 justify-center font-mono text-xs font-bold uppercase">
              <CheckCircle className="w-5 h-5" />
              {imported} RUBRIC{imported !== 1 ? 'S' : ''} IMPORTED
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-text-muted)] mb-1">
                  Course
                </label>
                <select
                  className="w-full bg-white border border-[var(--color-stroke)] rounded-[2px] text-xs font-mono p-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-bauhaus-blue-bright)]"
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  disabled={loadingCourses}
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <p className="text-[10px] font-mono font-bold uppercase text-[var(--color-text-muted)] mb-1">
                  Rubrics in this course
                </p>
                {loadingRubrics ? (
                  <div className="flex items-center gap-2 text-[var(--color-text-disabled)] py-4 text-xs font-mono justify-center">
                    <Loader className="w-4 h-4 animate-spin" /> LOADING…
                  </div>
                ) : rubrics.length === 0 ? (
                  <p className="text-xs font-mono text-[var(--color-text-disabled)] py-4 text-center uppercase">
                    No rubrics in this course
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1 border border-[var(--color-stroke)] rounded-[2px] p-2">
                    {rubrics.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggle(r.id)}
                        className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-[var(--color-canvas-paper)] transition-colors text-left rounded-[2px]"
                      >
                        <span
                          className="w-4 h-4 border border-[var(--color-stroke)] rounded-[2px] flex items-center justify-center shrink-0 transition-colors"
                          style={selectedIds.has(r.id)
                            ? { backgroundColor: 'var(--color-domain-grading)', borderColor: 'var(--color-domain-grading)' }
                            : { backgroundColor: 'var(--color-bg-surface)' }}
                        >
                          {selectedIds.has(r.id) && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[var(--color-stroke)] truncate font-mono">{r.title}</p>
                          <p className="text-[10px] text-[var(--color-text-disabled)] font-mono">
                            {r.criteria.length} CRITERIA · {r.pointsPossible} PTS
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

        <div className="flex justify-end gap-3 px-5 pb-5 border-t border-[var(--color-grid-divider)] pt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[var(--color-canvas-paper)] border border-[var(--color-stroke)] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[var(--color-container-inset)]"
          >
            {imported > 0 ? 'CLOSE' : 'CANCEL'}
          </button>
          {imported === 0 && (
            <button
              onClick={doImport}
              disabled={selectedIds.size === 0 || importing}
              className="px-4 py-1.5 bg-[var(--color-domain-grading)] text-white border border-[var(--color-stroke)] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[color-mix(in_srgb,var(--color-domain-grading)_85%,black)] disabled:opacity-40 flex items-center gap-2"
            >
              {importing
                ? <><Loader className="w-3.5 h-3.5 animate-spin" /> IMPORTING…</>
                : `IMPORT${selectedIds.size > 0 ? ` ${selectedIds.size}` : ''} RUBRIC${selectedIds.size !== 1 ? 'S' : ''}`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
