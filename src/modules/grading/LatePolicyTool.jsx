import { useState, useEffect, useMemo } from 'react'
import { Loader, Calculator } from 'lucide-react'
import CourseSelector from '../../components/CourseSelector.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignmentsWithGradingData, getAssignmentSubmissions, updateSubmissionGrade } from '../../api/submissions.js'
import { getPreferences, setPreference } from '../../storage/preferences.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'

const DEFAULT_POLICY = {
  penaltyType: 'per-day',
  penaltyValue: 10,
  gracePeriodHours: 0,
  maxPenaltyPct: 50,
}

function calcPenalty(submission, assignment, policy) {
  if (submission.score === null || !submission.submittedAt || !assignment.dueAt) return null
  const graceMs = policy.gracePeriodHours * 3600000
  const lateMs = new Date(submission.submittedAt) - new Date(assignment.dueAt) - graceMs
  if (lateMs <= 0) return null
  const daysLate = Math.ceil(lateMs / 86400000)
  const penaltyPct = policy.penaltyType === 'flat'
    ? policy.penaltyValue
    : Math.min(daysLate * policy.penaltyValue, policy.maxPenaltyPct)
  const floor = assignment.pointsPossible * (1 - policy.maxPenaltyPct / 100)
  const newScore = Math.max(
    Math.round((submission.score * (1 - penaltyPct / 100)) * 100) / 100,
    Math.round(floor * 100) / 100,
  )
  return { daysLate, penaltyPct: Math.round(penaltyPct * 10) / 10, newScore }
}

function PreviewModal({ rows, onApply, onCancel, applying, progress }) {
  const changed = rows.filter(r => r.penalty !== null)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Preview Late Penalties</h3>
            <p className="text-xs text-gray-500 mt-0.5">{changed.length} submission{changed.length !== 1 ? 's' : ''} will be adjusted</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Assignment</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Student</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Days Late</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Penalty</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Current</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">New</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i} className={r.penalty === null ? 'opacity-30' : ''}>
                  <td className="px-4 py-2.5 text-gray-800 max-w-[10rem] truncate" title={r.assignmentName}>{r.assignmentName}</td>
                  <td className="px-4 py-2.5 text-gray-800">{r.userName ?? 'Unknown'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{r.penalty ? r.penalty.daysLate : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.penalty ? <span className="text-red-500 font-medium">−{r.penalty.penaltyPct}%</span> : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{r.currentScore ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                    {r.penalty ? r.penalty.newScore : r.currentScore ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          {applying && <p className="text-xs text-gray-400 mb-3">{progress}</p>}
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={onCancel} disabled={applying}>Cancel</button>
            <button
              className="btn-primary flex items-center gap-1.5"
              onClick={onApply}
              disabled={applying || changed.length === 0}
            >
              {applying && <Loader size={13} className="animate-spin" />}
              {applying ? 'Applying…' : `Apply ${changed.length} Penalt${changed.length !== 1 ? 'ies' : 'y'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LatePolicyTool() {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [policy, setPolicy]                     = useState(DEFAULT_POLICY)
  const [courses, setCourses]                   = useState([])
  const [loadingCourses, setLoadingCourses]     = useState(true)
  const [courseId, setCourseId]                 = useState(null)
  const [courseName, setCourseName]             = useState('')
  const [assignments, setAssignments]           = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [selected, setSelected]                 = useState(new Set())
  const [previewRows, setPreviewRows]           = useState(null)
  const [calculating, setCalculating]           = useState(false)
  const [showPreview, setShowPreview]           = useState(false)
  const [applying, setApplying]                 = useState(false)
  const [progress, setProgress]                 = useState('')

  useEffect(() => {
    getPreferences().then(p => {
      if (p.latePolicySettings) setPolicy(p.latePolicySettings)
    })
    getCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) loadAssignments(list[0].id, list[0].name)
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  function updatePolicy(patch) {
    const next = { ...policy, ...patch }
    setPolicy(next)
    setPreference('latePolicySettings', next)
  }

  async function loadAssignments(cId, cName) {
    setCourseId(cId)
    setCourseName(cName ?? courses.find(c => c.id === cId)?.name ?? '')
    setAssignments([])
    setSelected(new Set())
    setPreviewRows(null)
    setLoadingAssignments(true)
    try {
      const data = await getAssignmentsWithGradingData(cId)
      // Only show published assignments with a due date (penalty requires a reference point)
      const eligible = data.filter(a => a.published && a.dueAt)
      setAssignments(eligible)
    } finally {
      setLoadingAssignments(false)
    }
  }

  function toggleAssignment(id) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === assignments.length ? new Set() : new Set(assignments.map(a => a.id)))
  }

  async function handleCalculate() {
    if (selected.size === 0) return
    setCalculating(true)
    setPreviewRows(null)
    try {
      const rows = []
      for (const aId of selected) {
        const assignment = assignments.find(a => a.id === aId)
        if (!assignment) continue
        const subs = await getAssignmentSubmissions(courseId, aId)
        for (const sub of subs) {
          const penalty = calcPenalty(sub, assignment, policy)
          rows.push({
            assignmentId:   aId,
            assignmentName: assignment.name,
            userId:         sub.userId,
            userName:       sub.userName,
            currentScore:   sub.score,
            penalty,
          })
        }
      }
      setPreviewRows(rows)
      setShowPreview(true)
    } finally {
      setCalculating(false)
    }
  }

  async function handleApply() {
    if (!previewRows) return
    const toApply = previewRows.filter(r => r.penalty !== null)
    const summary = `Applied late penalties to ${toApply.length} submissions across ${selected.size} assignment${selected.size !== 1 ? 's' : ''}`

    await requirePin({ action: 'late_policy', summary, courseId, courseName }, async () => {
      setApplying(true)
      let done = 0
      for (const row of toApply) {
        await updateSubmissionGrade(courseId, row.assignmentId, row.userId, {
          posted_grade: String(row.penalty.newScore),
        })
        done++
        setProgress(`${done} of ${toApply.length} updated…`)
      }
      setApplying(false)
      setProgress('')
      setShowPreview(false)
      setPreviewRows(null)
      setSelected(new Set())
      toast(`Applied penalties to ${toApply.length} submission${toApply.length !== 1 ? 's' : ''}`, 'success')
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Late Policy</h1>
        <p className="text-sm text-gray-500 mt-1">Define a penalty formula and apply it to late submissions. Always previewed before writing.</p>
      </div>

      {/* Policy definition */}
      <div className="card p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Policy Settings</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Penalty Type</label>
            <select
              className="input w-full text-sm mt-1"
              value={policy.penaltyType}
              onChange={e => updatePolicy({ penaltyType: e.target.value })}
            >
              <option value="per-day">Percentage per day late</option>
              <option value="flat">Flat percentage (regardless of days)</option>
            </select>
          </div>
          <div>
            <label className="label">
              {policy.penaltyType === 'per-day' ? 'Penalty Per Day (%)' : 'Flat Penalty (%)'}
            </label>
            <input
              type="number"
              className="input w-full text-sm mt-1"
              value={policy.penaltyValue}
              onChange={e => updatePolicy({ penaltyValue: Number(e.target.value) })}
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="label">Grace Period (hours)</label>
            <input
              type="number"
              className="input w-full text-sm mt-1"
              value={policy.gracePeriodHours}
              onChange={e => updatePolicy({ gracePeriodHours: Number(e.target.value) })}
              min="0"
            />
            <p className="text-xs text-gray-400 mt-1">Submissions within this window after the due date are not penalized.</p>
          </div>
          <div>
            <label className="label">Maximum Penalty (%)</label>
            <input
              type="number"
              className="input w-full text-sm mt-1"
              value={policy.maxPenaltyPct}
              onChange={e => updatePolicy({ maxPenaltyPct: Number(e.target.value) })}
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-400 mt-1">Grade never drops below this percentage of points possible.</p>
          </div>
        </div>
      </div>

      {/* Course picker */}
      <div className="card p-4 mb-5 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600 shrink-0">Course</span>
        <CourseSelector courses={courses} selectedId={courseId} onChange={cId => {
          const c = courses.find(x => x.id === cId)
          loadAssignments(cId, c?.name)
        }} loading={loadingCourses} />
      </div>

      {/* Assignment selection */}
      {courseId && (
        <div className="card overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Select Assignments</h2>
            {assignments.length > 0 && (
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={toggleAll}>
                {selected.size === assignments.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          {loadingAssignments ? (
            <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm">
              <Loader size={14} className="animate-spin" /> Loading assignments…
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No published assignments with due dates found.</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {assignments.map(a => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(a.id)}
                    onChange={() => toggleAssignment(a.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      Due {new Date(a.dueAt).toLocaleDateString()} · {a.pointsPossible} pts
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          {selected.size > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
              <button
                className="btn-primary flex items-center gap-1.5"
                onClick={handleCalculate}
                disabled={calculating}
              >
                {calculating
                  ? <><Loader size={13} className="animate-spin" /> Calculating…</>
                  : <><Calculator size={15} /> Calculate Penalties ({selected.size})</>
                }
              </button>
            </div>
          )}
        </div>
      )}

      {showPreview && previewRows && (
        <PreviewModal
          rows={previewRows}
          applying={applying}
          progress={progress}
          onApply={handleApply}
          onCancel={() => !applying && setShowPreview(false)}
        />
      )}
    </div>
  )
}
