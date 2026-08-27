import { useState, useEffect } from 'react'
import { Loader, Calculator, Shield } from 'lucide-react'
import Card from '../../components/Card.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import FieldLabel from '../../components/FieldLabel.jsx'
import NumberField from '../../components/NumberField.jsx'
import Modal from '../../components/Modal.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
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
    <Modal
      title="Preview Late Penalties"
      subtitle={`${changed.length} submission${changed.length !== 1 ? 's' : ''} will be adjusted`}
      onClose={onCancel}
      size="lg"
      footer={
        <div className="w-full">
          {applying && <p className="text-xs text-[var(--color-text-disabled)] mb-3">{progress}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCancel} disabled={applying}>Cancel</Button>
            <Button onClick={onApply} disabled={applying || changed.length === 0}>
              <span className="flex items-center gap-1.5">
                {applying && <Loader size={13} className="animate-spin" />}
                {applying ? 'Applying…' : `Apply ${changed.length} Penalt${changed.length !== 1 ? 'ies' : 'y'}`}
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
              <th className="table-header-cell px-4 py-2.5 text-left">Assignment</th>
              <th className="table-header-cell px-4 py-2.5 text-left">Student</th>
              <th className="table-header-cell px-4 py-2.5 text-right">Days Late</th>
              <th className="table-header-cell px-4 py-2.5 text-right">Penalty</th>
              <th className="table-header-cell px-4 py-2.5 text-right">Current</th>
              <th className="table-header-cell px-4 py-2.5 text-right">New</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {rows.map((r, i) => (
              <tr key={i} className={r.penalty === null ? 'opacity-30' : ''}>
                <td className="px-4 py-2.5 text-[var(--color-text-body)] max-w-[10rem] truncate" title={r.assignmentName}>{r.assignmentName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-body)]">{r.userName ?? 'Unknown'}</td>
                <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{r.penalty ? r.penalty.daysLate : '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {r.penalty ? <span className="font-medium" style={{ color: 'var(--color-error)' }}>−{r.penalty.penaltyPct}%</span> : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{r.currentScore ?? '—'}</td>
                <td className="px-4 py-2.5 text-right font-medium text-[var(--color-text-body)]">
                  {r.penalty ? r.penalty.newScore : r.currentScore ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

export default function LatePolicyTool({ courseId, courseName, loadingCourse }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [policy, setPolicy]                     = useState(DEFAULT_POLICY)
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
  }, [])

  useEffect(() => {
    if (!courseId) { setAssignments([]); return }
    loadAssignments(courseId)
  }, [courseId])

  function updatePolicy(patch) {
    const next = { ...policy, ...patch }
    setPolicy(next)
    setPreference('latePolicySettings', next)
  }

  async function loadAssignments(cId) {
    setAssignments([])
    setSelected(new Set())
    setPreviewRows(null)
    setLoadingAssignments(true)
    try {
      const data = await getAssignmentsWithGradingData(cId)
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Late Policy</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Define a penalty formula and apply it to late submissions. Always previewed before writing.</p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--color-text-body)] mb-4">Policy Settings</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="lp-type">Penalty Type</FieldLabel>
            <select
              id="lp-type"
              className="input w-full text-sm mt-1"
              value={policy.penaltyType}
              onChange={e => updatePolicy({ penaltyType: e.target.value })}
            >
              <option value="per-day">Percentage per day late</option>
              <option value="flat">Flat percentage (regardless of days)</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="lp-value">
              {policy.penaltyType === 'per-day' ? 'Penalty Per Day (%)' : 'Flat Penalty (%)'}
            </FieldLabel>
            <NumberField
              id="lp-value"
              className="w-full mt-1"
              value={policy.penaltyValue}
              onChange={v => updatePolicy({ penaltyValue: Number(v) })}
              min={0}
              max={100}
            />
          </div>
          <div>
            <FieldLabel htmlFor="lp-grace">Grace Period (hours)</FieldLabel>
            <NumberField
              id="lp-grace"
              className="w-full mt-1"
              value={policy.gracePeriodHours}
              onChange={v => updatePolicy({ gracePeriodHours: Number(v) })}
              min={0}
            />
            <p className="text-xs text-[var(--color-text-disabled)] mt-1">Submissions within this window after the due date are not penalized.</p>
          </div>
          <div>
            <FieldLabel htmlFor="lp-cap">Maximum Penalty (%)</FieldLabel>
            <NumberField
              id="lp-cap"
              className="w-full mt-1"
              value={policy.maxPenaltyPct}
              onChange={v => updatePolicy({ maxPenaltyPct: Number(v) })}
              min={0}
              max={100}
            />
            <p className="text-xs text-[var(--color-text-disabled)] mt-1">Grade never drops below this percentage of points possible.</p>
          </div>
        </div>
      </Card>

      {courseId && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-body)]">Select Assignments</h2>
            {assignments.length > 0 && (
              <button className="text-xs text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]" onClick={toggleAll}>
                {selected.size === assignments.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          {loadingAssignments || loadingCourse ? (
            <div className="flex items-center gap-2 text-[var(--color-text-disabled)] py-8 justify-center text-sm">
              <Loader size={14} className="animate-spin" /> Loading assignments…
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)] py-8 text-center">No published assignments with due dates found.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)] max-h-64 overflow-y-auto">
              {assignments.map(a => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-bg-hover)] cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(a.id)}
                    onChange={() => toggleAssignment(a.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-body)] truncate">{a.name}</p>
                    <p className="text-xs text-[var(--color-text-disabled)]">
                      Due {new Date(a.dueAt).toLocaleDateString()} · {a.pointsPossible} pts
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          {selected.size > 0 && (
            <div className="px-4 py-3 border-t border-[var(--color-border-subtle)] flex justify-end">
              <Button onClick={handleCalculate} disabled={calculating}>
                <span className="flex items-center gap-1.5">
                  {calculating ? <Loader size={15} className="animate-spin" /> : <Calculator size={15} />}
                  {calculating ? 'Calculating…' : `Calculate Penalties (${selected.size})`}
                </span>
              </Button>
            </div>
          )}
        </Card>
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
