import { useState, useEffect, useMemo } from 'react'
import { Loader, TrendingUp } from 'lucide-react'
import Card from '../../components/Card.jsx'
import Button from '../../components/Button.jsx'
import FieldLabel from '../../components/FieldLabel.jsx'
import NumberField from '../../components/NumberField.jsx'
import RadioGroup from '../../components/RadioGroup.jsx'
import Modal from '../../components/Modal.jsx'
import { getAssignmentsWithGradingData, getAssignmentSubmissions, updateSubmissionGrade } from '../../api/submissions.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'

const CURVE_TYPES = [
  { id: 'flat',         label: 'Flat Addition',        unit: 'pts',  placeholder: '5',   hint: 'Add points to every score' },
  { id: 'percent',      label: 'Percentage Scale',     unit: '%',    placeholder: '110', hint: 'Multiply every score by this percentage' },
  { id: 'floor',        label: 'Score Floor',          unit: '%',    placeholder: '60',  hint: 'No student scores below this percentage' },
  { id: 'sqrt',         label: 'Square Root Curve',    unit: null,   placeholder: null,  hint: 'Classic bell curve (no input needed)' },
  { id: 'scale-to-100', label: 'Scale Highest to 100', unit: null,   placeholder: null,  hint: 'Scales so the top scorer gets full marks' },
]

function applyRound(n) {
  return Math.round(n * 100) / 100
}

function calcNewScore(score, max, curveType, curveValue, highestScore) {
  if (score === null) return null
  switch (curveType) {
    case 'flat':
      return applyRound(Math.min(score + Number(curveValue), max))
    case 'percent':
      return applyRound(Math.min(score * (Number(curveValue) / 100), max))
    case 'floor':
      return applyRound(Math.max(score, max * (Number(curveValue) / 100)))
    case 'sqrt':
      if (max <= 0) return score
      return applyRound(Math.sqrt(score / max) * max)
    case 'scale-to-100':
      if (!highestScore || highestScore <= 0) return score
      return applyRound(Math.min(score * (max / highestScore), max))
    default:
      return score
  }
}

function avg(rows) {
  const graded = rows.filter(r => r.currentScore !== null)
  if (!graded.length) return null
  return graded.reduce((s, r) => s + r.currentScore, 0) / graded.length
}

function avgNew(rows) {
  const graded = rows.filter(r => r.newScore !== null)
  if (!graded.length) return null
  return graded.reduce((s, r) => s + r.newScore, 0) / graded.length
}

function fmt(n, max) {
  if (n === null) return '—'
  const pct = max > 0 ? ` (${Math.round((n / max) * 100)}%)` : ''
  return `${n}${pct}`
}

function PreviewModal({ rows, assignment, onApply, onCancel, applying, progress }) {
  const changed = rows.filter(r => r.newScore !== r.currentScore && r.newScore !== null)
  const beforeAvg = avg(rows)
  const afterAvg = avgNew(rows)
  const max = assignment.pointsPossible

  return (
    <Modal
      title="Preview Grade Changes"
      subtitle={`${assignment.name} · ${changed.length} grade${changed.length !== 1 ? 's' : ''} will change`}
      onClose={onCancel}
      size="md"
      footer={
        <div className="w-full">
          {beforeAvg !== null && afterAvg !== null && (
            <p className="text-xs text-[var(--color-text-disabled)] mb-3">
              Class average: <span className="font-medium text-[var(--color-text-body)]">{applyRound(beforeAvg)}</span>
              {' → '}
              <span className="font-medium" style={{ color: 'var(--color-success)' }}>{applyRound(afterAvg)}</span>
              {max > 0 && ` (${Math.round((afterAvg / max) * 100)}%)`}
            </p>
          )}
          {applying && <p className="text-xs text-[var(--color-text-disabled)] mb-3">{progress}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCancel} disabled={applying}>Cancel</Button>
            <Button onClick={onApply} disabled={applying || changed.length === 0}>
              <span className="flex items-center gap-1.5">
                {applying && <Loader size={13} className="animate-spin" />}
                {applying ? 'Applying…' : `Apply ${changed.length} Change${changed.length !== 1 ? 's' : ''}`}
              </span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="-mx-6 -my-4">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--color-bg-page)] border-b border-[var(--color-border)]">
            <tr>
              <th className="table-header-cell px-4 py-2.5 text-left">Student</th>
              <th className="table-header-cell px-4 py-2.5 text-right">Current</th>
              <th className="table-header-cell px-4 py-2.5 text-right">New</th>
              <th className="table-header-cell px-4 py-2.5 text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {rows.map(r => {
              const delta = r.newScore !== null && r.currentScore !== null ? r.newScore - r.currentScore : null
              const unchanged = r.newScore === r.currentScore
              return (
                <tr key={r.userId} className={unchanged ? 'opacity-40' : ''}>
                  <td className="px-4 py-2.5 text-[var(--color-text-body)]">{r.userName ?? 'Unknown'}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{fmt(r.currentScore, max)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-[var(--color-text-body)]">{fmt(r.newScore, max)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {delta !== null && delta !== 0 && (
                      <span className="font-medium" style={{ color: delta > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {delta > 0 ? '+' : ''}{applyRound(delta)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

export default function GradeAdjustments({ courseId, courseName, loadingCourse }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [assignments, setAssignments]           = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [submissions, setSubmissions]           = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [curveType, setCurveType]               = useState('flat')
  const [curveValue, setCurveValue]             = useState('')
  const [applyTo, setApplyTo]                   = useState('all')
  const [threshold, setThreshold]               = useState('70')
  const [showPreview, setShowPreview]           = useState(false)
  const [applying, setApplying]                 = useState(false)
  const [progress, setProgress]                 = useState('')

  useEffect(() => {
    if (!courseId) { setAssignments([]); setSubmissions([]); return }
    loadAssignments(courseId)
  }, [courseId])

  async function loadAssignments(cId) {
    setAssignments([])
    setSubmissions([])
    setSelectedAssignmentId('')
    setShowPreview(false)
    setLoadingAssignments(true)
    try {
      const data = await getAssignmentsWithGradingData(cId)
      const gradable = data.filter(a => a.gradingType !== 'not_graded' && a.published)
      setAssignments(gradable)
      if (gradable.length > 0) loadSubmissions(cId, gradable[0].id)
    } finally {
      setLoadingAssignments(false)
    }
  }

  async function loadSubmissions(cId, aId) {
    setSelectedAssignmentId(aId)
    setSubmissions([])
    setShowPreview(false)
    setLoadingSubmissions(true)
    try {
      const subs = await getAssignmentSubmissions(cId, aId)
      setSubmissions(subs.filter(s => s.workflowState === 'graded' || s.score !== null))
    } finally {
      setLoadingSubmissions(false)
    }
  }

  const selectedAssignment = useMemo(
    () => assignments.find(a => a.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  )

  const highestScore = useMemo(
    () => submissions.reduce((m, s) => (s.score !== null ? Math.max(m, s.score) : m), 0),
    [submissions],
  )

  const previewRows = useMemo(() => {
    if (!selectedAssignment || submissions.length === 0) return []
    const max = selectedAssignment.pointsPossible
    const thresholdScore = max * (Number(threshold) / 100)

    return submissions.map(s => {
      const shouldApply = applyTo === 'all' || (s.score !== null && s.score < thresholdScore)
      const newScore = shouldApply
        ? calcNewScore(s.score, max, curveType, curveValue, highestScore)
        : s.score
      return {
        userId:       s.userId,
        userName:     s.userName,
        currentScore: s.score,
        newScore:     newScore,
      }
    }).sort((a, b) => (a.userName ?? '').localeCompare(b.userName ?? ''))
  }, [submissions, selectedAssignment, curveType, curveValue, applyTo, threshold, highestScore])

  const curveNeedsValue = !['sqrt', 'scale-to-100'].includes(curveType)
  const canPreview = selectedAssignment && submissions.length > 0 && (!curveNeedsValue || curveValue !== '')

  const beforeAvg = avg(previewRows)
  const afterAvg = avgNew(previewRows)

  async function handleApply() {
    const changed = previewRows.filter(r => r.newScore !== r.currentScore && r.newScore !== null)
    if (!changed.length) return

    const summary = `Applied ${CURVE_TYPES.find(c => c.id === curveType)?.label} curve to ${changed.length} grades on "${selectedAssignment.name}"`
    await requirePin({ action: 'grade_adjustment', summary, courseId, courseName }, async () => {
      setApplying(true)
      let done = 0
      for (const row of changed) {
        await updateSubmissionGrade(courseId, selectedAssignment.id, row.userId, {
          posted_grade: String(row.newScore),
        })
        done++
        setProgress(`${done} of ${changed.length} updated…`)
      }
      setApplying(false)
      setProgress('')
      setShowPreview(false)
      toast(`Updated ${changed.length} grade${changed.length !== 1 ? 's' : ''}`, 'success')
      loadSubmissions(courseId, selectedAssignment.id)
    })
  }

  const activeCurve = CURVE_TYPES.find(c => c.id === curveType)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Grade Adjustments</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Apply a curve to grades on a single assignment. Preview before any changes are written.</p>
      </div>

      <Card>
        <FieldLabel htmlFor="ga-assignment">Assignment</FieldLabel>
        {loadingAssignments || loadingCourse ? (
          <span className="text-sm text-[var(--color-text-disabled)] flex items-center gap-1.5 mt-1"><Loader size={13} className="animate-spin" /> Loading…</span>
        ) : (
          <select
            id="ga-assignment"
            className="input text-sm w-full mt-1"
            value={selectedAssignmentId}
            onChange={e => loadSubmissions(courseId, e.target.value)}
            disabled={assignments.length === 0}
          >
            {assignments.length === 0
              ? <option>No gradable assignments</option>
              : assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
            }
          </select>
        )}
      </Card>

      {selectedAssignment && (
        <Card className="space-y-5">
          <div>
            <FieldLabel>Curve Type</FieldLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mt-1">
              {CURVE_TYPES.map(ct => {
                const active = curveType === ct.id
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => { setCurveType(ct.id); setCurveValue('') }}
                    className="px-3 py-2.5 rounded-[var(--radius-control)] border text-sm text-left transition-colors"
                    style={active
                      ? { borderColor: 'var(--color-stroke, var(--cpt-color))', background: 'var(--cpt-color)', color: 'white' }
                      : { borderColor: 'var(--color-border)', color: 'var(--color-text-body)' }}
                  >
                    <span className="font-medium block">{ct.label}</span>
                    <span className="text-xs mt-0.5 block" style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--color-text-disabled)' }}>{ct.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {curveNeedsValue && (
            <div>
              <FieldLabel htmlFor="ga-curve-value">{activeCurve.label} Value</FieldLabel>
              <div className="flex items-center gap-2 mt-1">
                <NumberField id="ga-curve-value" className="w-32" value={curveValue} onChange={setCurveValue} min={0} />
                {activeCurve.unit && <span className="text-sm text-[var(--color-text-muted)]">{activeCurve.unit}</span>}
              </div>
            </div>
          )}

          <div>
            <FieldLabel>Apply To</FieldLabel>
            <div className="mt-1">
              <RadioGroup
                name="applyTo"
                ariaLabel="Apply to"
                value={applyTo}
                onChange={setApplyTo}
                options={[
                  { value: 'all', label: 'All graded students' },
                  {
                    value: 'below',
                    label: (
                      <span className="flex items-center gap-2">
                        Students below
                        <NumberField
                          className="w-16"
                          value={threshold}
                          onChange={setThreshold}
                          min={0}
                          max={100}
                          disabled={applyTo !== 'below'}
                        />
                        %
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          {(beforeAvg !== null && afterAvg !== null) && (
            <Card padding="sm" style={{ background: 'var(--color-bg-page)' }}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Class average before/after</span>
                <span>
                  <span className="font-semibold text-[var(--color-text-body)]">{applyRound(beforeAvg)}</span>
                  <span className="text-[var(--color-text-disabled)]"> → </span>
                  <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{applyRound(afterAvg)}</span>
                </span>
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between pt-1">
            {loadingSubmissions ? (
              <span className="text-sm text-[var(--color-text-disabled)] flex items-center gap-1.5"><Loader size={13} className="animate-spin" /> Loading submissions…</span>
            ) : (
              <span className="text-sm text-[var(--color-text-disabled)]">{submissions.length} graded submission{submissions.length !== 1 ? 's' : ''}</span>
            )}
            <Button icon={TrendingUp} disabled={!canPreview || loadingSubmissions} onClick={() => setShowPreview(true)}>
              Preview Changes
            </Button>
          </div>
        </Card>
      )}

      {showPreview && selectedAssignment && (
        <PreviewModal
          rows={previewRows}
          assignment={selectedAssignment}
          applying={applying}
          progress={progress}
          onApply={handleApply}
          onCancel={() => !applying && setShowPreview(false)}
        />
      )}
    </div>
  )
}
