import { useState, useEffect } from 'react'
import { Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { getCourses } from '../../api/courses.js'
import { getAssignments } from '../../api/assignments.js'
import { createRubricInCanvas } from '../../api/rubrics.js'
import { saveRubric } from '../../storage/rubrics.js'
import { usePinGate } from '../../security/usePinGate.jsx'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? '' : 'bg-gray-300'}`}
      style={checked ? { backgroundColor: 'var(--cpt-color)' } : undefined}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} style={{ backgroundColor: 'white' }} />
    </button>
  )
}

export default function DeployRubric({ rubric, onDone, onBack }) {
  const { requirePin } = usePinGate()
  const [courses, setCourses]                     = useState([])
  const [loadingCourses, setLoadingCourses]       = useState(true)
  const [selectedCourseId, setSelectedCourseId]   = useState('')
  const [assignments, setAssignments]             = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [useForGrading, setUseForGrading]         = useState(true)
  const [deploying, setDeploying]                 = useState(false)
  const [result, setResult]                       = useState(null)

  const totalPoints = rubric.criteria.reduce((sum, c) => {
    return sum + c.ratings.reduce((m, r) => Math.max(m, r.points), 0)
  }, 0)

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
    setLoadingAssignments(true)
    setSelectedAssignmentId('')
    setAssignments([])
    getAssignments(selectedCourseId)
      .then(setAssignments)
      .catch(() => {})
      .finally(() => setLoadingAssignments(false))
  }, [selectedCourseId])

  async function deploy() {
    const course = courses.find(c => c.id === selectedCourseId)
    const assignment = assignments.find(a => a.id === selectedAssignmentId)
    await requirePin(
      {
        action: 'rubric_deploy',
        summary: `Deployed rubric "${rubric.name}" to ${course?.name ?? selectedCourseId}${assignment ? ` / ${assignment.name}` : ''}`,
        courseId: selectedCourseId,
        courseName: course?.name ?? selectedCourseId,
      },
      runDeploy,
    )
  }

  async function runDeploy() {
    setDeploying(true)
    const course = courses.find(c => c.id === selectedCourseId)
    try {
      const associationData = selectedAssignmentId
        ? { assignmentId: selectedAssignmentId, useForGrading }
        : null
      const created = await createRubricInCanvas(selectedCourseId, {
        title: rubric.name,
        criteria: rubric.criteria,
        associationData,
      })
      const assignment = assignments.find(a => a.id === selectedAssignmentId)
      await saveRubric({ ...rubric, lastUsed: new Date().toISOString() })
      setResult({ success: true, course, assignment: assignment ?? null, canvasRubric: created })
    } catch (err) {
      setResult({ success: false, error: err.message })
    } finally {
      setDeploying(false)
    }
  }

  if (loadingCourses) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
        <Loader size={18} className="animate-spin" /> Loading courses…
      </div>
    )
  }

  if (result) {
    return (
      <div className="max-w-2xl space-y-6">
        <h2 className="text-xl font-bold text-gray-900">
          {result.success ? 'Rubric Created' : 'Deploy Failed'}
        </h2>
        <div className="card p-6">
          {result.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <CheckCircle size={16} />
                "{rubric.name}" created in {result.course.name}
              </div>
              {result.assignment && (
                <p className="text-sm text-gray-600 pl-6">
                  Attached to "{result.assignment.name}"
                  {useForGrading ? ' and set as the grading rubric.' : ' as a view-only rubric.'}
                </p>
              )}
              {!result.assignment && (
                <p className="text-sm text-gray-500 pl-6">
                  Saved as a standalone rubric in the course. You can attach it to assignments from within Canvas.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle size={16} /> {result.error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          {result.success && (
            <button className="btn-secondary" onClick={() => setResult(null)}>
              Deploy to Another Course
            </button>
          )}
          <button className="btn-primary" onClick={onDone}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Deploy Rubric to Canvas</h2>
        <p className="text-sm text-gray-500 mt-1">
          "{rubric.name}" — {rubric.criteria.length} {rubric.criteria.length === 1 ? 'criterion' : 'criteria'} · {totalPoints} pts total
        </p>
      </div>

      <div className="card p-5 space-y-5">
        {/* Course */}
        <div>
          <label className="label">Target course</label>
          <select
            className="input w-full text-sm mt-1"
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
          >
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Assignment (optional) */}
        <div>
          <label className="label">
            Attach to assignment
            <span className="ml-1.5 font-normal text-gray-400">(optional)</span>
          </label>
          <select
            className="input w-full text-sm mt-1"
            value={selectedAssignmentId}
            onChange={e => setSelectedAssignmentId(e.target.value)}
            disabled={loadingAssignments}
          >
            <option value="">— None / standalone rubric —</option>
            {loadingAssignments
              ? <option disabled>Loading assignments…</option>
              : assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
            }
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Standalone rubrics are saved to the course and can be attached to assignments later from within Canvas.
          </p>
        </div>

        {/* Use for grading toggle (only when assignment selected) */}
        {selectedAssignmentId && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <Toggle checked={useForGrading} onChange={setUseForGrading} />
            <div>
              <p className="text-sm font-medium text-gray-900">Use rubric for grading</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {useForGrading
                  ? 'Rubric scores will feed into the assignment grade.'
                  : 'Rubric will be visible but will not affect the grade.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rubric preview */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Criteria preview</p>
        <div className="space-y-1">
          {rubric.criteria.map(crit => {
            const maxPts = crit.ratings.reduce((m, r) => Math.max(m, r.points), 0)
            return (
              <div key={crit.id} className="flex items-baseline justify-between text-sm">
                <span className="text-gray-800">{crit.description || <em className="text-gray-400">Unnamed criterion</em>}</span>
                <span className="text-xs text-gray-400 shrink-0 ml-3">{maxPts} pts</span>
              </div>
            )
          })}
        </div>
        <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-medium">
          <span className="text-gray-600">Total</span>
          <span className="text-gray-900">{totalPoints} pts</span>
        </div>
      </div>

      <div className="flex justify-between">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <button
          className="btn-primary"
          disabled={!selectedCourseId || deploying}
          onClick={deploy}
        >
          {deploying
            ? <><Loader size={14} className="animate-spin inline mr-1.5" />Creating…</>
            : 'Create in Canvas'}
        </button>
      </div>
    </div>
  )
}
