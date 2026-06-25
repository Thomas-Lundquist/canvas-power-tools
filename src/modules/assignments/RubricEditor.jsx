import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { newCriterionId, newRatingId } from '../../storage/rubrics.js'

function defaultRatings() {
  return [
    { id: newRatingId(), description: 'Excellent', points: 5 },
    { id: newRatingId(), description: 'Good',      points: 3 },
    { id: newRatingId(), description: 'Needs Work', points: 0 },
  ]
}

function defaultCriterion() {
  return { id: newCriterionId(), description: '', longDescription: '', ratings: defaultRatings() }
}

function criterionMaxPoints(crit) {
  return crit.ratings.reduce((m, r) => Math.max(m, r.points), 0)
}

export default function RubricEditor({ rubric, onSave, onCancel }) {
  const [name, setName]         = useState(rubric?.name ?? '')
  const [criteria, setCriteria] = useState(() =>
    rubric?.criteria?.length > 0 ? rubric.criteria : [defaultCriterion()]
  )
  const [expanded, setExpanded] = useState(() => new Set(
    (rubric?.criteria?.length > 0 ? rubric.criteria : [defaultCriterion()]).map(c => c.id)
  ))

  const totalPoints = criteria.reduce((sum, c) => sum + criterionMaxPoints(c), 0)

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
    if (!name.trim() || criteria.length === 0) return
    onSave({ name: name.trim(), criteria })
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Name + total */}
      <div className="flex items-center gap-4">
        <input
          className="input flex-1 font-semibold text-base"
          placeholder="Rubric name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div className="text-sm text-gray-500 shrink-0">
          Total: <span className="font-bold text-gray-900">{totalPoints} pts</span>
        </div>
      </div>

      {/* Criteria */}
      <div className="space-y-3">
        {criteria.map((crit, idx) => {
          const maxPts = criterionMaxPoints(crit)
          const open = expanded.has(crit.id)
          return (
            <div key={crit.id} className="card border border-gray-200 overflow-hidden">
              {/* Criterion header row */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleExpand(crit.id)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                <input
                  className="input flex-1 text-sm"
                  placeholder="Criterion description (e.g. Organization, Content, Grammar…)"
                  value={crit.description}
                  onChange={e => updateCriterion(crit.id, 'description', e.target.value)}
                />
                <span className="text-xs text-gray-400 shrink-0 w-14 text-right">{maxPts} pts</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCriterion(crit.id, -1)}
                    className="btn-ghost p-1 disabled:opacity-25"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === criteria.length - 1}
                    onClick={() => moveCriterion(crit.id, 1)}
                    className="btn-ghost p-1 disabled:opacity-25"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={criteria.length === 1}
                    onClick={() => removeCriterion(crit.id)}
                    className="btn-ghost p-1 text-red-400 hover:text-red-600 disabled:opacity-25"
                    title="Remove criterion"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Ratings */}
              {open && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 mb-2">Ratings (highest → lowest)</p>
                  {crit.ratings.map(r => (
                    <div key={r.id} className="flex items-center gap-2">
                      <input
                        className="input flex-1 text-sm"
                        placeholder="Rating label (e.g. Excellent, Proficient…)"
                        value={r.description}
                        onChange={e => updateRating(crit.id, r.id, 'description', e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="input w-20 text-sm text-right shrink-0"
                        value={r.points}
                        onChange={e => updateRating(crit.id, r.id, 'points', parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-xs text-gray-400 shrink-0">pts</span>
                      <button
                        type="button"
                        disabled={crit.ratings.length === 1}
                        onClick={() => removeRating(crit.id, r.id)}
                        className="btn-ghost p-1 text-red-400 hover:text-red-600 disabled:opacity-25 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRating(crit.id)}
                    className="flex items-center gap-1.5 text-xs font-medium mt-1"
                    style={{ color: 'var(--cpt-color)' }}
                  >
                    <Plus size={12} /> Add Rating
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add criterion */}
      <button
        type="button"
        onClick={addCriterion}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        <Plus size={15} /> Add Criterion
      </button>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!name.trim() || criteria.length === 0}
        >
          Save Rubric
        </button>
      </div>
    </div>
  )
}
