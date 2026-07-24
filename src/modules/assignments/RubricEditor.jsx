import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react'
import { newCriterionId, newRatingId } from '../../storage/rubrics.js'

function defaultRatings() {
  return [
    { id: newRatingId(), description: 'Excellent',   points: 5 },
    { id: newRatingId(), description: 'Good',        points: 3 },
    { id: newRatingId(), description: 'Needs Work',  points: 0 },
  ]
}

function defaultCriterion() {
  return { id: newCriterionId(), description: '', longDescription: '', ratings: defaultRatings() }
}

function criterionMaxPoints(crit) {
  return crit.ratings.reduce((m, r) => Math.max(m, r.points), 0)
}

const inputCls = 'w-full bg-white border border-[#1B1C1A] rounded-[2px] text-xs font-mono p-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]'

export default function RubricEditor({ rubric, onSave, onCancel, onDelete = null }) {
  const [name, setName]         = useState(rubric?.name ?? '')
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
    onSave({ name: name.trim(), criteria })
  }

  return (
    <div className="space-y-4">
      {/* ── Edit mode header ─────────────────────────────────────────────── */}
      <div className="border-b border-[#E3E2DF] pb-3 flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold uppercase text-gray-400">
          {rubric ? 'EDITING RUBRIC' : 'NEW RUBRIC'}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-[#B7102A] hover:underline"
            aria-label="Delete rubric"
          >
            <X className="w-3 h-3" /> DELETE RUBRIC
          </button>
        )}
      </div>

      {/* ── Name + total ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <input
          className={`${inputCls} flex-1 font-bold`}
          placeholder="RUBRIC NAME…"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <div className="text-[10px] font-mono font-bold text-gray-500 shrink-0 whitespace-nowrap">
          TOTAL: <span className="text-[#1B1C1A]">{totalPoints} PTS</span>
        </div>
      </div>

      {/* ── Criteria ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {criteria.map((crit, idx) => {
          const maxPts = criterionMaxPoints(crit)
          const open = expanded.has(crit.id)
          return (
            <div key={crit.id} className="border border-[#1B1C1A] rounded-[2px] overflow-hidden">
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
                <input
                  className="flex-1 bg-transparent border-0 text-xs font-mono font-bold text-[#1B1C1A] placeholder-gray-400 focus:outline-none min-w-0"
                  placeholder={`CRITERION ${idx + 1} DESCRIPTION…`}
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
                    disabled={criteria.length === 1}
                    onClick={() => removeCriterion(crit.id)}
                    className="p-0.5 text-[#B7102A] hover:text-red-800 disabled:opacity-25"
                    aria-label="Remove criterion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Criterion body */}
              {open && (
                <div className="bg-white px-3 py-3 space-y-3 border-t border-[#E3E2DF]">
                  {/* Long description */}
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={2}
                    placeholder="FULL DESCRIPTION / EXPECTATIONS (optional)…"
                    value={crit.longDescription}
                    onChange={e => updateCriterion(crit.id, 'longDescription', e.target.value)}
                  />

                  {/* Ratings */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-mono font-bold uppercase text-gray-400">
                      RATINGS (HIGHEST → LOWEST)
                    </p>
                    {crit.ratings.map(r => (
                      <div key={r.id} className="flex items-center gap-2">
                        <input
                          className={`${inputCls} flex-1`}
                          placeholder="RATING LABEL…"
                          value={r.description}
                          onChange={e => updateRating(crit.id, r.id, 'description', e.target.value)}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          className={`${inputCls} w-20 text-right shrink-0`}
                          value={r.points}
                          onChange={e => updateRating(crit.id, r.id, 'points', parseFloat(e.target.value) || 0)}
                          aria-label="Points"
                        />
                        <span className="text-[10px] font-mono text-gray-400 shrink-0">PTS</span>
                        <button
                          type="button"
                          disabled={crit.ratings.length === 1}
                          onClick={() => removeRating(crit.id, r.id)}
                          className="text-[#B7102A] hover:text-red-800 disabled:opacity-25 shrink-0"
                          aria-label="Remove rating"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addRating(crit.id)}
                      className="text-[10px] font-mono font-bold uppercase text-[#059669] flex items-center gap-1 hover:underline mt-1"
                    >
                      <Plus className="w-3 h-3" /> ADD RATING
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Add criterion ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={addCriterion}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#1B1C1A] rounded-[2px] text-xs font-mono font-bold uppercase text-gray-500 hover:bg-[#FAF9F5] hover:text-[#1B1C1A] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> ADD CRITERION
      </button>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-3 border-t border-[#E3E2DF]">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-[#FAF9F5] border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[#EFEEEA]"
        >
          {rubric ? 'CANCEL' : 'DISCARD'}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-1.5 bg-[#059669] text-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-emerald-700 disabled:opacity-40"
        >
          SAVE RUBRIC
        </button>
      </div>
    </div>
  )
}
