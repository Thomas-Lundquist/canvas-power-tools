import { useState, useEffect } from 'react'
import { Loader, ArrowRight, ArrowLeft } from 'lucide-react'
import { getCourses } from '../../api/courses.js'
import { getAssignments } from '../../api/assignments.js'
import { createRubricInCanvas } from '../../api/rubrics.js'
import { saveRubric } from '../../storage/rubrics.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import Button from '../../components/Button.jsx'
import Callout from '../../components/Callout.jsx'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-12 shrink-0 rounded-[var(--radius-control)] border border-[var(--color-border)] transition-colors ${
        checked ? 'bg-[var(--color-domain-grading)]' : 'bg-[var(--color-bg-page)]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-all ${
          checked ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
        }`}
      />
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  )
}

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
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-text-disabled)]">
        <Loader className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading courses…
      </div>
    )
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="border-b border-[var(--color-border-subtle)] pb-3">
          <span className="section-label !mb-0">
            {result.success ? 'Deploy complete' : 'Deploy failed'}
          </span>
        </div>

        {result.success ? (
          <Callout tone="success" title={`Rubric created in ${result.course?.name}`}>
            {result.assignment
              ? <>Attached to “{result.assignment.name}”{useForGrading ? ' — set as grading rubric' : ' — view only'}</>
              : 'Saved as a standalone rubric. Attach to assignments from within Canvas.'}
          </Callout>
        ) : (
          <Callout tone="error">{result.error}</Callout>
        )}

        <div className="flex justify-end gap-3">
          {result.success && (
            <Button variant="secondary" size="sm" onClick={() => setResult(null)}>Deploy Again</Button>
          )}
          <Button variant="primary" size="sm" onClick={onDone}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Deploy header ──────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border-subtle)] pb-3">
        <span className="section-label !mb-0">Deploy to Canvas</span>
        <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--color-text-body)]">
          {rubric.name}
        </h2>
        <p className="list-row-meta mt-0.5 text-xs text-[var(--color-text-muted)]">
          {rubric.criteria.length} {rubric.criteria.length === 1 ? 'criterion' : 'criteria'} · {totalPoints} pts total
        </p>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-4">
        <div>
          <label htmlFor="rubric-deploy-course" className="section-label">Target course</label>
          <select
            id="rubric-deploy-course"
            className="input text-sm"
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
          >
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="rubric-deploy-assignment" className="section-label">
            Attach to assignment
            <span className="ml-1 font-normal normal-case tracking-normal text-[var(--color-text-disabled)]">(optional)</span>
          </label>
          <select
            id="rubric-deploy-assignment"
            className="input text-sm"
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
          <p className="mt-1 text-xs text-[var(--color-text-disabled)]">
            Standalone rubrics attach to assignments later from within Canvas.
          </p>
        </div>

        {selectedAssignmentId && (
          <div className="flex items-center gap-3 border-t border-[var(--color-border-subtle)] pt-3">
            <Toggle checked={useForGrading} onChange={setUseForGrading} />
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-body)]">Use for grading</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {useForGrading
                  ? 'Rubric scores feed into the assignment grade.'
                  : 'Rubric visible but does not affect the grade.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Criteria preview ───────────────────────────────────────────── */}
      <div className="space-y-1.5 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] p-3">
        <p className="section-label">Criteria preview</p>
        {rubric.criteria.map(crit => {
          const maxPts = crit.ratings.reduce((m, r) => Math.max(m, r.points), 0)
          return (
            <div key={crit.id} className="flex items-baseline justify-between text-xs">
              <span className="mr-3 truncate text-[var(--color-text-body)]">
                {crit.description || <em className="text-[var(--color-text-disabled)]">Unnamed criterion</em>}
              </span>
              <span className="list-row-meta shrink-0 text-[var(--color-text-disabled)]">{maxPts} pts</span>
            </div>
          )
        })}
        <div className="flex justify-between border-t border-[var(--color-border-subtle)] pt-2 text-xs font-semibold">
          <span className="section-label !mb-0">Total</span>
          <span className="list-row-meta text-[var(--color-text-body)]">{totalPoints} pts</span>
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex justify-between">
        <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={onBack}>Back</Button>
        <Button variant="primary" size="sm" disabled={!selectedCourseId || deploying} onClick={deploy}>
          {deploying
            ? <><Loader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Creating…</>
            : <><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> Create in Canvas</>
          }
        </Button>
      </div>
    </div>
  )
}
