import { useState, useEffect, useMemo } from 'react'
import { Loader, TrendingUp } from 'lucide-react'
import CourseSelector from '../../components/CourseSelector.jsx'
import { getCourses } from '../../api/courses.js'
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Preview Grade Changes</h3>
            <p className="text-xs text-gray-500 mt-0.5">{assignment.name} · {changed.length} grade{changed.length !== 1 ? 's' : ''} will change</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Student</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Current</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">New</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => {
                const delta = r.newScore !== null && r.currentScore !== null ? r.newScore - r.currentScore : null
                const unchanged = r.newScore === r.currentScore
                return (
                  <tr key={r.userId} className={unchanged ? 'opacity-40' : ''}>
                    <td className="px-4 py-2.5 text-gray-900">{r.userName ?? 'Unknown'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{fmt(r.currentScore, max)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">{fmt(r.newScore, max)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
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

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          {beforeAvg !== null && afterAvg !== null && (
            <p className="text-xs text-gray-400 mb-4">
              Class average: <span className="font-medium text-gray-700">{applyRound(beforeAvg)}</span>
              {' → '}
              <span className="font-medium text-gray-700">{applyRound(afterAvg)}</span>
              {max > 0 && ` (${Math.round((afterAvg / max) * 100)}%)`}
            </p>
          )}
          {applying && <p className="text-xs text-gray-400 mb-3">{progress}</p>}
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={onCancel} disabled={applying}>Cancel</button>
            <button
              className="btn-primary flex items-center gap-1.5"
              onClick={onApply}
              disabled={applying || changed.length === 0}
            >
              {applying && <Loader size={13} className="animate-spin" />}
              {applying ? 'Applying…' : `Apply ${changed.length} Change${changed.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GradeAdjustments() {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]                   = useState([])
  const [loadingCourses, setLoadingCourses]     = useState(true)
  const [courseId, setCourseId]                 = useState(null)
  const [courseName, setCourseName]             = useState('')
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
    getCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) loadAssignments(list[0].id, list[0].name)
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  async function loadAssignments(cId, cName) {
    setCourseId(cId)
    setCourseName(cName ?? courses.find(c => c.id === cId)?.name ?? '')
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Grade Adjustments</h1>
        <p className="text-sm text-gray-500 mt-1">Apply a curve to grades on a single assignment. Preview before any changes are written.</p>
      </div>

      {/* Course + Assignment pickers */}
      <div className="card p-4 mb-5 space-y-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 shrink-0 w-24">Course</span>
          <CourseSelector courses={courses} selectedId={courseId} onChange={cId => {
            const c = courses.find(x => x.id === cId)
            loadAssignments(cId, c?.name)
          }} loading={loadingCourses} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 shrink-0 w-24">Assignment</span>
          {loadingAssignments ? (
            <span className="text-sm text-gray-400 flex items-center gap-1.5"><Loader size={13} className="animate-spin" /> Loading…</span>
          ) : (
            <select
              className="input text-sm flex-1"
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
        </div>
      </div>

      {/* Curve options */}
      {selectedAssignment && (
        <div className="card p-5 mb-5 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Curve Type</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CURVE_TYPES.map(ct => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => { setCurveType(ct.id); setCurveValue('') }}
                  className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    curveType === ct.id
                      ? 'border-transparent text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  style={curveType === ct.id ? { backgroundColor: 'var(--cpt-color)' } : undefined}
                >
                  <span className="font-medium block">{ct.label}</span>
                  <span className={`text-xs mt-0.5 block ${curveType === ct.id ? 'text-white/80' : 'text-gray-400'}`}>{ct.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {curveNeedsValue && (
            <div>
              <label className="label">
                {activeCurve.label} Value
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  className="input w-32 text-sm"
                  value={curveValue}
                  onChange={e => setCurveValue(e.target.value)}
                  placeholder={activeCurve.placeholder}
                  min="0"
                />
                {activeCurve.unit && <span className="text-sm text-gray-500">{activeCurve.unit}</span>}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Apply To</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="applyTo" value="all" checked={applyTo === 'all'}
                  onChange={() => setApplyTo('all')} className="accent-[var(--cpt-color)]" />
                All graded students
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="applyTo" value="below" checked={applyTo === 'below'}
                  onChange={() => setApplyTo('below')} className="accent-[var(--cpt-color)]" />
                Students below
                <input
                  type="number"
                  className="input w-16 text-sm py-1 px-2"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  min="0"
                  max="100"
                  disabled={applyTo !== 'below'}
                />
                <span className="text-gray-500">%</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {loadingSubmissions ? (
              <span className="text-sm text-gray-400 flex items-center gap-1.5"><Loader size={13} className="animate-spin" /> Loading submissions…</span>
            ) : (
              <span className="text-sm text-gray-400">{submissions.length} graded submission{submissions.length !== 1 ? 's' : ''}</span>
            )}
            <button
              className="btn-primary flex items-center gap-1.5"
              disabled={!canPreview || loadingSubmissions}
              onClick={() => setShowPreview(true)}
            >
              <TrendingUp size={15} /> Preview Changes
            </button>
          </div>
        </div>
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
