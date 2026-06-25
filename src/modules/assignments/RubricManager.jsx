import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Upload, Search, Loader, Download, X, CheckCircle } from 'lucide-react'
import { getRubrics, saveRubric, deleteRubric as deleteLocalRubric, newRubricId } from '../../storage/rubrics.js'
import { getRubrics as getCanvasRubrics } from '../../api/rubrics.js'
import { getCourses } from '../../api/courses.js'
import RubricEditor from './RubricEditor.jsx'
import DeployRubric from './DeployRubric.jsx'

function totalPoints(rubric) {
  return rubric.criteria.reduce((sum, c) => sum + c.ratings.reduce((m, r) => Math.max(m, r.points), 0), 0)
}

export default function RubricManager() {
  const [rubrics, setRubrics]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState('library') // 'library' | 'edit' | 'deploy'
  const [activeRubric, setActiveRubric] = useState(null)
  const [search, setSearch]           = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showImport, setShowImport]   = useState(false)

  async function reload() {
    const data = await getRubrics()
    setRubrics(data.items)
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  async function handleSave(rubricData) {
    const base = activeRubric ?? {
      id: newRubricId(),
      createdAt: new Date().toISOString(),
      lastUsed: null,
    }
    await saveRubric({ ...base, ...rubricData })
    await reload()
    setView('library')
    setActiveRubric(null)
  }

  async function handleDelete(id) {
    await deleteLocalRubric(id)
    await reload()
    setConfirmDelete(null)
  }

  function goEdit(rubric = null) {
    setActiveRubric(rubric)
    setView('edit')
  }

  function goDeploy(rubric) {
    setActiveRubric(rubric)
    setView('deploy')
  }

  function goBack() {
    setView('library')
    setActiveRubric(null)
  }

  const filtered = search.trim()
    ? rubrics.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : rubrics

  /* ─── Edit view ─── */
  if (view === 'edit') {
    return (
      <div className="space-y-5">
        <Breadcrumb label={activeRubric ? `Edit: ${activeRubric.name}` : 'New Rubric'} onBack={goBack} />
        <RubricEditor rubric={activeRubric} onSave={handleSave} onCancel={goBack} />
      </div>
    )
  }

  /* ─── Deploy view ─── */
  if (view === 'deploy') {
    return (
      <div className="space-y-5">
        <Breadcrumb label={`Deploy: ${activeRubric.name}`} onBack={goBack} />
        <DeployRubric rubric={activeRubric} onDone={goBack} onBack={goBack} />
      </div>
    )
  }

  /* ─── Library view ─── */
  return (
    <div className="space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rubric Manager</h1>
        <p className="text-sm text-gray-500 mt-1">
          Build reusable rubric templates and deploy them to any Canvas course.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 text-sm w-full"
            placeholder="Search rubrics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
          onClick={() => setShowImport(true)}
        >
          <Download size={15} /> Import from Canvas
        </button>
        <button
          className="btn-primary flex items-center gap-1.5 text-sm shrink-0"
          onClick={() => goEdit(null)}
        >
          <Plus size={15} /> New Rubric
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-16 justify-center">
          <Loader size={18} className="animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search.trim()} onCreate={() => goEdit(null)} />
      ) : (
        <div className="space-y-2">
          {filtered.map(rubric => (
            <RubricCard
              key={rubric.id}
              rubric={rubric}
              pts={totalPoints(rubric)}
              onEdit={() => goEdit(rubric)}
              onDeploy={() => goDeploy(rubric)}
              onDelete={() => setConfirmDelete(rubric.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <h3 className="font-semibold text-gray-900 mb-2">Delete Rubric?</h3>
          <p className="text-sm text-gray-600 mb-5">
            This removes the local template only. Rubrics already created in Canvas are not affected.
          </p>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn-danger" onClick={() => handleDelete(confirmDelete)}>Delete</button>
          </div>
        </Modal>
      )}

      {/* Import from Canvas */}
      {showImport && (
        <ImportFromCanvas
          onImport={async rubric => {
            await saveRubric({ ...rubric, id: newRubricId(), createdAt: new Date().toISOString(), lastUsed: null })
            await reload()
            setShowImport(false)
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}

function Breadcrumb({ label, onBack }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button className="btn-ghost text-sm text-gray-500 hover:text-gray-800" onClick={onBack}>
        ← Rubric Library
      </button>
      <span className="text-gray-300">/</span>
      <span className="font-medium text-gray-700">{label}</span>
    </div>
  )
}

function RubricCard({ rubric, pts, onEdit, onDeploy, onDelete }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{rubric.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {rubric.criteria.length} {rubric.criteria.length === 1 ? 'criterion' : 'criteria'}
          {' · '}{pts} pts
          {rubric.lastUsed && ` · Last deployed ${new Date(rubric.lastUsed).toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={onEdit}>
          <Pencil size={13} /> Edit
        </button>
        <button className="btn-primary text-sm flex items-center gap-1.5" onClick={onDeploy}>
          <Upload size={13} /> Deploy
        </button>
        <button
          className="btn-ghost p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function EmptyState({ hasSearch, onCreate }) {
  if (hasSearch) {
    return <p className="text-center text-gray-400 py-16 text-sm">No rubrics match your search.</p>
  }
  return (
    <div className="text-center py-20 space-y-3">
      <p className="text-gray-500 font-medium">No rubric templates yet.</p>
      <p className="text-sm text-gray-400 max-w-xs mx-auto">
        Create a rubric template below, or import existing rubrics from a Canvas course.
      </p>
      <button className="btn-primary text-sm inline-flex items-center gap-1.5 mx-auto" onClick={onCreate}>
        <Plus size={15} /> Create Your First Rubric
      </button>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        {children}
      </div>
    </div>
  )
}

function ImportFromCanvas({ onImport, onClose }) {
  const [courses, setCourses]           = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [rubrics, setRubrics]           = useState([])
  const [loadingRubrics, setLoadingRubrics] = useState(false)
  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [importing, setImporting]       = useState(false)
  const [imported, setImported]         = useState(0)

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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Import Rubrics from Canvas</h3>
          <button className="btn-ghost p-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {imported > 0 ? (
            <div className="flex items-center gap-2 text-green-700 py-4 justify-center">
              <CheckCircle size={18} /> {imported} rubric{imported !== 1 ? 's' : ''} imported successfully.
            </div>
          ) : (
            <>
              <div>
                <label className="label">Course</label>
                <select
                  className="input w-full text-sm mt-1"
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  disabled={loadingCourses}
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <p className="label mb-1.5">Rubrics in this course</p>
                {loadingRubrics ? (
                  <div className="flex items-center gap-2 text-gray-400 py-4 text-sm justify-center">
                    <Loader size={15} className="animate-spin" /> Loading rubrics…
                  </div>
                ) : rubrics.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No rubrics found in this course.</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                    {rubrics.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggle(r.id)}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-gray-50 transition-colors text-left"
                      >
                        <span
                          className="w-4.5 h-4.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
                          style={selectedIds.has(r.id)
                            ? { backgroundColor: 'var(--cpt-color)', borderColor: 'var(--cpt-color)' }
                            : { borderColor: '#d1d5db' }}
                        >
                          {selectedIds.has(r.id) && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5L4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                          <p className="text-xs text-gray-400">
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
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button className="btn-secondary" onClick={onClose}>
            {imported > 0 ? 'Close' : 'Cancel'}
          </button>
          {imported === 0 && (
            <button
              className="btn-primary"
              disabled={selectedIds.size === 0 || importing}
              onClick={doImport}
            >
              {importing
                ? <><Loader size={13} className="animate-spin inline mr-1.5" />Importing…</>
                : `Import ${selectedIds.size > 0 ? selectedIds.size : ''} Rubric${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
