import { useState, useEffect } from 'react'
import { Loader, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { getCourses } from '../../api/courses.js'
import { getAssignments } from '../../api/assignments.js'
import { createRubricInCanvas } from '../../api/rubrics.js'
import { saveRubric } from '../../storage/rubrics.js'
import { usePinGate } from '../../security/usePinGate.jsx'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-12 h-6 border border-[#1B1C1A] rounded-[2px] transition-colors shrink-0 ${
        checked ? 'bg-[#059669]' : 'bg-[#FAF9F5]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 bg-white border border-[#1B1C1A] rounded-[2px] transition-all ${
          checked ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
        }`}
      />
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  )
}

const labelCls = 'block text-[10px] font-mono font-bold uppercase text-[var(--color-text-muted)] mb-1'
const selectCls = 'w-full bg-white border border-[#1B1C1A] rounded-[2px] text-xs font-mono p-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]'

export default function DeployRubric({ rubric, onDone, onBack }) {
  const { requirePin } = usePinGate()
  const [courses, setCourses]                               = useState([])
  const [loadingCourses, setLoadingCourses]                 = useState(true)
  const [selectedCourseId, setSelectedCourseId]             = useState('')
  const [assignments, setAssignments]                       = useState([])
  const [loadingAssignments, setLoadingAssignments]         = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId]     = useState('')
  const [useForGrading, setUseForGrading]                   = useState(true)
  const [deploying, setDeploying]                           = useState(false)
  const [result, setResult]                                 = useState(null)

  const totalPoints = rubric.criteria.reduce((sum, c) =>
    sum + c.ratings.reduce((m, r) => Math.max(m, r.points), 0), 0)

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
      <div className="flex items-center gap-2 text-[var(--color-text-disabled)] py-12 justify-center font-mono text-xs">
        <Loader className="w-4 h-4 animate-spin" /> LOADING COURSES…
      </div>
    )
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="border-b border-[#E3E2DF] pb-3">
          <span className="text-[10px] font-mono font-bold uppercase text-[var(--color-text-disabled)]">
            {result.success ? 'DEPLOY COMPLETE' : 'DEPLOY FAILED'}
          </span>
        </div>

        <div className={`border border-[#1B1C1A] rounded-[2px] p-4 ${result.success ? 'bg-[#ECFDF5]' : 'bg-[#FEF2F2]'}`}>
          {result.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#059669] font-mono font-bold text-xs uppercase">
                <CheckCircle className="w-4 h-4 shrink-0" />
                RUBRIC CREATED IN {result.course?.name}
              </div>
              {result.assignment ? (
                <p className="text-xs text-[var(--color-text-secondary)] font-mono pl-6">
                  ATTACHED TO &quot;{result.assignment.name}&quot;
                  {useForGrading ? ' — SET AS GRADING RUBRIC' : ' — VIEW ONLY'}
                </p>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)] font-mono pl-6">
                  SAVED AS STANDALONE RUBRIC. ATTACH TO ASSIGNMENTS FROM WITHIN CANVAS.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#B7102A] font-mono text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {result.error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          {result.success && (
            <button
              onClick={() => setResult(null)}
              className="px-3 py-1.5 bg-[#FAF9F5] border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[#EFEEEA]"
            >
              DEPLOY AGAIN
            </button>
          )}
          <button
            onClick={onDone}
            className="px-4 py-1.5 bg-[#059669] text-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[#047857]"
          >
            DONE
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Deploy header ──────────────────────────────────────────────── */}
      <div className="border-b border-[#E3E2DF] pb-3">
        <span className="text-[10px] font-mono font-bold uppercase text-[var(--color-text-disabled)]">DEPLOY TO CANVAS</span>
        <h2 className="text-xl font-black text-[#1B1C1A] uppercase tracking-tight mt-0.5">
          {rubric.name}
        </h2>
        <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">
          {rubric.criteria.length} {rubric.criteria.length === 1 ? 'CRITERION' : 'CRITERIA'} · {totalPoints} PTS TOTAL
        </p>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────── */}
      <div className="bg-[#EFEEEA] border border-[#1B1C1A] rounded-[2px] p-4 space-y-4">
        <div>
          <label className={labelCls}>Target course</label>
          <select
            className={selectCls}
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
          >
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>
            Attach to assignment
            <span className="ml-1 font-normal normal-case text-[var(--color-text-disabled)]">(optional)</span>
          </label>
          <select
            className={selectCls}
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
          <p className="text-[10px] font-mono text-[var(--color-text-disabled)] mt-1">
            Standalone rubrics attach to assignments later from within Canvas.
          </p>
        </div>

        {selectedAssignmentId && (
          <div className="flex items-center gap-3 pt-3 border-t border-[#E3E2DF]">
            <Toggle checked={useForGrading} onChange={setUseForGrading} />
            <div>
              <p className="text-xs font-mono font-bold uppercase text-[#1B1C1A]">Use for grading</p>
              <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">
                {useForGrading
                  ? 'Rubric scores feed into the assignment grade.'
                  : 'Rubric visible but does not affect the grade.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Criteria preview ───────────────────────────────────────────── */}
      <div className="border border-[#E3E2DF] rounded-[2px] p-3 space-y-1.5">
        <p className="text-[10px] font-mono font-bold uppercase text-[var(--color-text-disabled)] mb-2">Criteria preview</p>
        {rubric.criteria.map(crit => {
          const maxPts = crit.ratings.reduce((m, r) => Math.max(m, r.points), 0)
          return (
            <div key={crit.id} className="flex items-baseline justify-between text-xs font-mono">
              <span className="text-[#1B1C1A] truncate mr-3">
                {crit.description || <em className="text-[var(--color-text-disabled)]">Unnamed criterion</em>}
              </span>
              <span className="text-[var(--color-text-disabled)] shrink-0">{maxPts} pts</span>
            </div>
          )
        })}
        <div className="pt-2 border-t border-[#E3E2DF] flex justify-between text-xs font-mono font-bold">
          <span className="text-[var(--color-text-muted)] uppercase">Total</span>
          <span className="text-[#1B1C1A]">{totalPoints} pts</span>
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-[#FAF9F5] border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[#EFEEEA]"
        >
          ← BACK
        </button>
        <button
          disabled={!selectedCourseId || deploying}
          onClick={deploy}
          className="px-4 py-1.5 bg-[#059669] text-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-[#047857] disabled:opacity-40 flex items-center gap-2"
        >
          {deploying
            ? <><Loader className="w-3.5 h-3.5 animate-spin" /> CREATING…</>
            : <><ArrowRight className="w-3.5 h-3.5" /> CREATE IN CANVAS</>
          }
        </button>
      </div>
    </div>
  )
}
