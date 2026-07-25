import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Save, X, Layers } from 'lucide-react'
import { newCriterionId, newRatingId } from '../../storage/rubrics.js'

const CATEGORIES = ['Essays & Papers', 'Science Labs', 'Discussions', 'Projects', 'General']

function defaultRatings() {
  return [
    { id: newRatingId(), description: 'Exceeds Expectations', points: 10 },
    { id: newRatingId(), description: 'Meets Expectations',   points: 5 },
    { id: newRatingId(), description: 'Does Not Meet',        points: 0 },
  ]
}

function defaultCriterion() {
  return {
    id: newCriterionId(),
    description: '',
    longDescription: '',
    ratings: defaultRatings(),
  }
}

function criterionMaxPoints(crit) {
  return crit.ratings.reduce((m, r) => Math.max(m, r.points), 0)
}

const inputCls = 'w-full bg-white border border-[#1B1C1A] rounded-[2px] text-xs font-mono p-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]'

export default function RubricEditor({ rubric, onSave, onCancel, onDelete = null }) {
  const [name, setName]         = useState(rubric?.name ?? '')
  const [category, setCategory] = useState(rubric?.category ?? 'General')
  const [criteria, setCriteria] = useState(() =>
    rubric?.criteria?.length > 0 ? rubric.criteria : [defaultCriterion()]
  )
  const [expanded, setExpanded] = useState(() => new Set(
    (rubric?.criteria?.length > 0 ? rubric.criteria : [defaultCriterion()]).map(c => c.id)
  ))

  const totalPoints = criteria.reduce((sum, c) => sum + criterionMaxPoints(c), 0)
  const canSave = name.trim().length > 0 && criteria.length > 0

  function updateCriterion(id, field, value) {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function addCriterion() {
    const c = defaultCriterion()
    setCriteria(prev => [...prev, c])
    setExpanded(prev => new Set([...prev, c.id]))
  }

  function removeCriterion(id) {
    setCriteria(prev => prev.filter(c => c.id !== id))
    setExpanded(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  function moveCriterion(id, dir) {
    setCriteria(prev => {
      const idx = prev.findIndex(c => c.id === id)
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  function updateRating(critId, ratingId, field, value) {
    setCriteria(prev => prev.map(c => c.id !== critId ? c : {
      ...c,
      ratings: c.ratings.map(r => r.id === ratingId ? { ...r, [field]: value } : r),
    }))
  }

  function addRating(critId) {
    setCriteria(prev => prev.map(c => c.id !== critId ? c : {
      ...c,
      ratings: [...c.ratings, { id: newRatingId(), description: '', points: 0 }],
    }))
  }

  function removeRating(critId, ratingId) {
    setCriteria(prev => prev.map(c => c.id !== critId ? c : {
      ...c,
      ratings: c.ratings.filter(r => r.id !== ratingId),
    }))
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function handleSave() {
    if (!canSave) return
    onSave({ name: name.trim(), category, criteria })
  }

  return (
    <div className="space-y-6">
      {/* ── Edit mode header bar (bleeds to panel edges) ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1B1C1A] pb-4 bg-[#FEF08A]/40 -m-6 p-6 mb-2 rounded-t-[2px]">
        <div>
          <span className="px-2 py-0.5 bg-[#1B1C1A] text-[#FEF08A] font-mono font-bold text-[10px] uppercase">
            EDIT MODE ACTIVE
          </span>
          <h2 className="text-2xl font-black text-[#1B1C1A] uppercase tracking-tight mt-1">
            {rubric ? `EDITING: ${name || 'UNTITLED RUBRIC'}` : 'NEW RUBRIC'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 bg-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-gray-100 flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-5 py-2 bg-[#059669] text-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            SAVE RUBRIC
          </button>
        </div>
      </div>

      {/* ── Name + Category ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF9F5] p-4 border border-[#1B1C1A] rounded-[2px]">
        <div>
          <label className="block text-[10px] font-mono font-bold uppercase text-gray-500 mb-1">
            Rubric Title
          </label>
          <input
            className={`${inputCls} font-bold`}
            placeholder="e.g. Lab Report Rubric, Argumentative Essay…"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono font-bold uppercase text-gray-500 mb-1">
            Category / Grouping
          </label>
          <select
            className={inputCls}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Criteria ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-[#1B1C1A] pb-2">
          <h3 className="font-mono font-extrabold uppercase text-[#1B1C1A] flex items-center gap-2 text-xs">
            <Layers className="w-4 h-4 text-[#059669]" />
            CRITERIA & RATING LEVELS ({criteria.length})
          </h3>
          <button
            type="button"
            onClick={addCriterion}
            className="px-3 py-1.5 bg-[#2563EB] text-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            ADD CRITERION
          </button>
        </div>

        {criteria.map((crit, idx) => {
          const maxPts = criterionMaxPoints(crit)
          const open = expanded.has(crit.id)
          return (
            <div key={crit.id} className="border-2 border-[#1B1C1A] rounded-[2px] overflow-hidden">
              {/* Criterion header */}
              <div className="bg-[#EFEEEA] flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(crit.id)}
                  className="text-gray-500 hover:text-[#1B1C1A] shrink-0"
                  aria-label={open ? 'Collapse' : 'Expand'}
                >
                  {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <span className="px-1.5 py-0.5 bg-[#1B1C1A] text-white font-mono font-bold text-[10px] uppercase shrink-0">
                  CRITERION #{idx + 1}
                </span>
                <input
                  className="flex-1 bg-transparent border-0 text-xs font-mono font-bold text-[#1B1C1A] placeholder-gray-400 focus:outline-none min-w-0"
                  placeholder={`Criterion title…`}
                  value={crit.description}
                  onChange={e => updateCriterion(crit.id, 'description', e.target.value)}
                />
                <span className="text-[10px] font-mono text-[#2563EB] font-bold shrink-0">
                  {maxPts} PTS
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCriterion(crit.id, -1)}
                    className="p-0.5 text-gray-400 hover:text-[#1B1C1A] disabled:opacity-25"
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === criteria.length - 1}
                    onClick={() => moveCriterion(crit.id, 1)}
                    className="p-0.5 text-gray-400 hover:text-[#1B1C1A] disabled:opacity-25"
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCriterion(crit.id)}
                    disabled={criteria.length === 1}
                    className="text-[#B7102A] hover:text-red-800 disabled:opacity-25 text-[11px] font-mono font-bold uppercase flex items-center gap-1 ml-1"
                    aria-label="Remove criterion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Criterion body */}
              {open && (
                <div className="bg-white px-3 py-3 space-y-3 border-t border-[#E3E2DF]">
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={2}
                    placeholder="Long description / grading expectations…"
                    value={crit.longDescription}
                    onChange={e => updateCriterion(crit.id, 'longDescription', e.target.value)}
                  />

                  {/* Ratings */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-mono font-bold uppercase text-gray-500">
                        RATING LEVELS FOR THIS CRITERION:
                      </p>
                      <button
                        type="button"
                        onClick={() => addRating(crit.id)}
                        className="text-[10px] font-mono font-bold uppercase text-[#059669] flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3 h-3" /> ADD RATING LEVEL
                      </button>
                    </div>

                    <div className="border border-[#1B1C1A] rounded-[2px] divide-y divide-[#1B1C1A] overflow-hidden bg-white">
                      {[...crit.ratings]
                        .sort((a, b) => b.points - a.points)
                        .map(r => (
                          <div key={r.id} className="flex items-center gap-3 p-2.5 bg-[#FAF9F5] hover:bg-white transition-colors">
                            {/* Points on left */}
                            <div className="w-28 shrink-0 flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold uppercase text-gray-500">PTS:</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                className="w-full p-1.5 bg-white border border-[#1B1C1A] font-bold text-xs font-mono rounded-[2px] text-[#059669] text-center focus:outline-none focus:ring-1 focus:ring-[#059669]"
                                value={r.points}
                                onChange={e => updateRating(crit.id, r.id, 'points', parseFloat(e.target.value) || 0)}
                                aria-label="Points"
                              />
                            </div>
                            {/* Description on right */}
                            <div className="flex-1">
                              <input
                                className="w-full p-1.5 bg-white border border-gray-300 font-mono text-xs text-[#1B1C1A] rounded-[2px] focus:outline-none focus:border-[#1B1C1A]"
                                placeholder="Rating level description…"
                                value={r.description}
                                onChange={e => updateRating(crit.id, r.id, 'description', e.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={crit.ratings.length === 1}
                              onClick={() => removeRating(crit.id, r.id)}
                              className="p-1.5 text-gray-400 hover:text-[#B7102A] disabled:opacity-25 shrink-0 transition-colors"
                              aria-label="Remove rating"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Bottom action bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 border-t-2 border-[#1B1C1A]">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-2 bg-white border border-[#B7102A] text-[#B7102A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-red-50 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            DELETE THIS RUBRIC
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[#EFEEEA]"
          >
            {rubric ? 'CANCEL' : 'DISCARD'}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-6 py-2 bg-[#059669] text-white border border-[#1B1C1A] font-mono font-extrabold text-xs uppercase rounded-[2px] hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            SAVE RUBRIC
          </button>
        </div>
      </div>
    </div>
  )
}
