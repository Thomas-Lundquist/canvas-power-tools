import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Save, X, Layers } from 'lucide-react'
import { newCriterionId, newRatingId } from '../../storage/rubrics.js'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'

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
      {/* ── Edit mode header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <Badge tone="warning">Edit mode</Badge>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text-body)]">
            {rubric ? `Editing: ${name || 'Untitled rubric'}` : 'New rubric'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={X} onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="sm" icon={Save} onClick={handleSave} disabled={!canSave}>Save Rubric</Button>
        </div>
      </div>

      {/* ── Name + Category ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-4 md:grid-cols-2">
        <div>
          <label htmlFor="rubric-title" className="section-label">Rubric Title</label>
          <input
            id="rubric-title"
            className="input text-sm font-semibold"
            placeholder="e.g. Lab Report Rubric, Argumentative Essay…"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="rubric-category" className="section-label">Category / Grouping</label>
          <select
            id="rubric-category"
            className="input text-sm"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Criteria ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
          <h3 className="section-label !mb-0 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--color-domain-grading)]" aria-hidden="true" />
            Criteria &amp; rating levels ({criteria.length})
          </h3>
          <Button variant="secondary" size="sm" icon={Plus} onClick={addCriterion}>Add Criterion</Button>
        </div>

        {criteria.map((crit, idx) => {
          const maxPts = criterionMaxPoints(crit)
          const open = expanded.has(crit.id)
          return (
            <div key={crit.id} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              {/* Criterion header */}
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(crit.id)}
                  className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
                  aria-label={open ? 'Collapse' : 'Expand'}
                >
                  {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
                <span className="shrink-0"><Badge tone="neutral">Criterion {idx + 1}</Badge></span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-xs font-semibold text-[var(--color-text-body)] placeholder-[var(--color-text-disabled)] focus:outline-none"
                  placeholder="Criterion title…"
                  value={crit.description}
                  onChange={e => updateCriterion(crit.id, 'description', e.target.value)}
                />
                <span className="list-row-meta shrink-0 text-xs font-semibold text-[var(--color-domain-grading)]">
                  {maxPts} pts
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCriterion(crit.id, -1)}
                    className="p-0.5 text-[var(--color-text-disabled)] hover:text-[var(--color-text-body)] disabled:opacity-25"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === criteria.length - 1}
                    onClick={() => moveCriterion(crit.id, 1)}
                    className="p-0.5 text-[var(--color-text-disabled)] hover:text-[var(--color-text-body)] disabled:opacity-25"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCriterion(crit.id)}
                    disabled={criteria.length === 1}
                    className="ml-1 p-0.5 text-[var(--color-error)] hover:text-[color-mix(in_srgb,var(--color-error)_85%,black)] disabled:opacity-25"
                    aria-label="Remove criterion"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Criterion body */}
              {open && (
                <div className="space-y-3 bg-[var(--color-bg-surface)] px-3 py-3">
                  <textarea
                    className="input resize-none text-sm"
                    rows={2}
                    placeholder="Long description / grading expectations…"
                    value={crit.longDescription}
                    onChange={e => updateCriterion(crit.id, 'longDescription', e.target.value)}
                  />

                  {/* Ratings */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="section-label !mb-0">Rating levels for this criterion</p>
                      <button
                        type="button"
                        onClick={() => addRating(crit.id)}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--color-domain-grading)] hover:underline"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" /> Add rating level
                      </button>
                    </div>

                    <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                      {[...crit.ratings]
                        .sort((a, b) => b.points - a.points)
                        .map(r => (
                          <div key={r.id} className="flex items-center gap-3 bg-[var(--color-bg-page)] p-2.5 transition-colors hover:bg-[var(--color-bg-surface)]">
                            {/* Points on left */}
                            <div className="flex w-28 shrink-0 items-center gap-1.5">
                              <span className="list-row-meta text-xs font-medium text-[var(--color-text-muted)]">Pts:</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                className="input p-1.5 text-center text-xs font-semibold text-[var(--color-domain-grading)]"
                                value={r.points}
                                onChange={e => updateRating(crit.id, r.id, 'points', parseFloat(e.target.value) || 0)}
                                aria-label="Points"
                              />
                            </div>
                            {/* Description on right */}
                            <div className="flex-1">
                              <input
                                className="input p-1.5 text-xs"
                                placeholder="Rating level description…"
                                value={r.description}
                                onChange={e => updateRating(crit.id, r.id, 'description', e.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={crit.ratings.length === 1}
                              onClick={() => removeRating(crit.id, r.id)}
                              className="shrink-0 p-1.5 text-[var(--color-text-disabled)] transition-colors hover:text-[var(--color-error)] disabled:opacity-25"
                              aria-label="Remove rating"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        {onDelete ? (
          <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>Delete This Rubric</Button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={X} onClick={onCancel}>
            {rubric ? 'Cancel' : 'Discard'}
          </Button>
          <Button variant="primary" size="sm" icon={Save} onClick={handleSave} disabled={!canSave}>Save Rubric</Button>
        </div>
      </div>
    </div>
  )
}
