import { useState, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'
import { addScheduledCheck, updateScheduledCheck } from '../../storage/scheduledChecks.js'
import { resolveTokens, resolveOverallTokens } from './tokenHelpers.js'

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 6 // 6 AM to 8 PM
  const label = h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`
  return { value: h, label }
})

const TOOL_LABELS = {
  'grade-outreach-assignment': 'Grade Outreach — Assignment Score',
  'grade-outreach-overall':    'Grade Outreach — Overall Grade',
  'submission-reminder-specific': 'Submission Reminder — Specific Assignment',
  'submission-reminder-upcoming': 'Submission Reminder — Upcoming Assignments',
}

const TOOL_TOKENS = {
  'grade-outreach-assignment': ['{first_name}', '{last_name}', '{score}', '{assignment_name}', '{due_date}', '{teacher_name}', '{course_name}'],
  'grade-outreach-overall':    ['{first_name}', '{last_name}', '{overall_score}', '{overall_grade}', '{teacher_name}', '{course_name}'],
  'submission-reminder-specific': ['{first_name}', '{last_name}', '{assignment_name}', '{due_date}', '{teacher_name}', '{course_name}'],
  'submission-reminder-upcoming': ['{first_name}', '{last_name}', '{assignment_name}', '{due_date}', '{teacher_name}', '{course_name}'],
}

const PREVIEW_STUDENT = {
  userName: 'Jane Smith', score: 45,
  currentScore: 62, finalScore: 58, currentGrade: 'D', finalGrade: 'F',
}

function defaultSubject(toolType, assignmentName, courseName) {
  switch (toolType) {
    case 'grade-outreach-assignment': return `Regarding your grade${assignmentName ? ` on ${assignmentName}` : ''}`
    case 'grade-outreach-overall':    return `Regarding your overall grade${courseName ? ` in ${courseName}` : ''}`
    case 'submission-reminder-specific': return `Reminder: ${assignmentName ?? 'Missing Assignment'}`
    case 'submission-reminder-upcoming': return 'Reminder: Missing Assignment'
    default: return 'A message from your teacher'
  }
}

function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
              i + 1 === step ? 'text-white' : i + 1 < step ? 'text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            }`}
            style={i + 1 <= step ? { backgroundColor: 'var(--cpt-color)' } : {}}
          >
            {i + 1}
          </span>
          {i < total - 1 && <ChevronRight size={10} className="text-[var(--color-border)]" aria-hidden="true" />}
        </span>
      ))}
    </div>
  )
}

export default function ScheduleForm({
  toolType,
  existingSchedule,
  initialCourseId,
  initialCourseName,
  initialAssignmentId,
  initialAssignmentName,
  initialAssignmentPointsPossible,
  initialAssignmentDueAt,
  initialDirection,
  initialThresholdPct,
  initialScoreType,
  initialMessage,
  initialTeacherName,
  onClose,
  onSaved,
}) {
  const { requirePin } = usePinGate()
  const isEdit = !!existingSchedule

  const isGradeType = toolType === 'grade-outreach-assignment' || toolType === 'grade-outreach-overall'
  const isUpcoming = toolType === 'submission-reminder-upcoming'

  // Step 1: Filter state
  const [direction, setDirection] = useState(existingSchedule?.direction ?? initialDirection ?? 'below')
  const [thresholdPct, setThresholdPct] = useState(String(existingSchedule?.thresholdPct ?? initialThresholdPct ?? 70))
  const [scoreType, setScoreType] = useState(existingSchedule?.scoreType ?? initialScoreType ?? 'current')
  const [daysAhead, setDaysAhead] = useState(existingSchedule?.daysAhead ?? 7)

  // Step 2: Message state
  const [subject, setSubject] = useState(
    existingSchedule?.subject ?? defaultSubject(toolType, initialAssignmentName, initialCourseName)
  )
  const [messageBody, setMessageBody] = useState(existingSchedule?.messageBody ?? initialMessage ?? '')

  // Step 3: Schedule state
  const [cadence, setCadence] = useState(existingSchedule?.cadence ?? 'weekly')
  const [runDayOfWeek, setRunDayOfWeek] = useState(existingSchedule?.runDayOfWeek ?? 1)
  const [runHour, setRunHour] = useState(existingSchedule?.runHour ?? 8)

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const previewAssignment = useMemo(() => ({
    name: initialAssignmentName ?? existingSchedule?.assignmentName ?? 'Assignment',
    dueAt: initialAssignmentDueAt ?? existingSchedule?.assignmentDueAt ?? new Date(Date.now() + 86400000 * 7).toISOString(),
    pointsPossible: initialAssignmentPointsPossible ?? existingSchedule?.assignmentPointsPossible ?? 100,
  }), [initialAssignmentName, initialAssignmentDueAt, initialAssignmentPointsPossible, existingSchedule])

  const previewBody = useMemo(() => {
    if (!messageBody) return ''
    const course = { name: initialCourseName ?? existingSchedule?.courseName ?? '' }
    const teacherName = initialTeacherName ?? existingSchedule?.teacherName ?? ''
    if (toolType === 'grade-outreach-overall') {
      return resolveOverallTokens(messageBody, { student: PREVIEW_STUDENT, course, teacherName, scoreType })
    }
    return resolveTokens(messageBody, { student: PREVIEW_STUDENT, assignment: previewAssignment, course, teacherName })
  }, [messageBody, toolType, scoreType, previewAssignment, initialCourseName, initialTeacherName, existingSchedule])

  function summaryText() {
    const cadenceLabel = cadence === 'daily'
      ? `daily at ${HOUR_OPTIONS.find(o => o.value === runHour)?.label ?? `${runHour}:00`}`
      : `every ${DAY_OPTIONS.find(o => o.value === runDayOfWeek)?.label ?? 'Monday'} at ${HOUR_OPTIONS.find(o => o.value === runHour)?.label ?? `${runHour}:00`}`

    let filterLabel = ''
    if (toolType === 'grade-outreach-assignment') {
      filterLabel = `, send messages to students scoring ${direction} ${thresholdPct}%`
      if (initialAssignmentName ?? existingSchedule?.assignmentName) {
        filterLabel += ` on "${initialAssignmentName ?? existingSchedule?.assignmentName}"`
      }
    } else if (toolType === 'grade-outreach-overall') {
      filterLabel = `, send messages to students with a ${scoreType} overall grade ${direction} ${thresholdPct}%`
    } else if (toolType === 'submission-reminder-specific') {
      filterLabel = `, send reminders to students who have not submitted`
      if (initialAssignmentName ?? existingSchedule?.assignmentName) {
        filterLabel += ` "${initialAssignmentName ?? existingSchedule?.assignmentName}"`
      }
    } else if (toolType === 'submission-reminder-upcoming') {
      filterLabel = `, send reminders to students missing assignments due within ${daysAhead} day${daysAhead !== 1 ? 's' : ''}`
    }

    const course = initialCourseName ?? existingSchedule?.courseName
    return `Running ${cadenceLabel} in ${course ?? 'this course'}${filterLabel}.`
  }

  async function handleAuthorize() {
    if (saving) return
    setSaving(true)
    const isCreating = !isEdit
    await requirePin(
      {
        action: isCreating ? 'schedule_created' : 'schedule_updated',
        summary: `${isCreating ? 'Created' : 'Updated'} recurring ${toolType} check for ${initialCourseName ?? existingSchedule?.courseName}`,
        courseId: initialCourseId ?? existingSchedule?.courseId,
        courseName: initialCourseName ?? existingSchedule?.courseName ?? '',
      },
      async () => {
        const patch = {
          direction:    isGradeType ? direction : null,
          thresholdPct: isGradeType ? Number(thresholdPct) : null,
          scoreType:    toolType === 'grade-outreach-overall' ? scoreType : null,
          daysAhead:    isUpcoming ? Number(daysAhead) : null,
          subject,
          messageBody,
          teacherName: initialTeacherName ?? existingSchedule?.teacherName ?? '',
          cadence,
          runDayOfWeek: cadence === 'weekly' ? Number(runDayOfWeek) : null,
          runHour:      Number(runHour),
        }

        if (isEdit) {
          await updateScheduledCheck(existingSchedule.id, patch)
        } else {
          await addScheduledCheck({
            toolType,
            courseId:                    initialCourseId,
            courseName:                  initialCourseName ?? '',
            assignmentId:                initialAssignmentId ?? null,
            assignmentName:              initialAssignmentName ?? null,
            assignmentPointsPossible:    initialAssignmentPointsPossible ?? null,
            assignmentDueAt:             initialAssignmentDueAt ?? null,
            ...patch,
            enabled: true,
          })
        }

        onSaved?.()
      }
    )
    setSaving(false)
  }

  const canProceedStep1 = !isGradeType || (thresholdPct !== '' && Number(thresholdPct) >= 0 && Number(thresholdPct) <= 100)
  const canProceedStep2 = subject.trim() && messageBody.trim()

  return (
    <Modal
      title={isEdit ? 'Edit Recurring Rule' : 'New Recurring Rule'}
      subtitle={TOOL_LABELS[toolType]}
      onClose={onClose}
      size="md"
      footer={
        <>
          {step > 1 && (
            <button className="btn-secondary mr-auto" onClick={() => setStep(s => s - 1)} disabled={saving}>
              Back
            </button>
          )}
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          {step < 3 ? (
            <button
              className="btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Next
            </button>
          ) : (
            <button
              className="btn-primary flex items-center gap-1.5"
              onClick={handleAuthorize}
              disabled={saving}
            >
              {saving ? 'Saving…' : isEdit ? 'Update Rule' : 'Authorize & Save'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StepIndicator step={step} total={3} />
          <span className="text-xs text-[var(--color-text-muted)]">Step {step} of 3</span>
        </div>

        {/* ── Step 1: Filter ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-raised)] space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-[var(--color-text-muted)] w-24 shrink-0">Tool</span>
                <span className="text-[var(--color-text-body)] font-medium">{TOOL_LABELS[toolType]}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[var(--color-text-muted)] w-24 shrink-0">Course</span>
                <span className="text-[var(--color-text-body)]">{initialCourseName ?? existingSchedule?.courseName ?? '—'}</span>
              </div>
              {(toolType === 'grade-outreach-assignment' || toolType === 'submission-reminder-specific') && (
                <div className="flex gap-2">
                  <span className="text-[var(--color-text-muted)] w-24 shrink-0">Assignment</span>
                  <span className="text-[var(--color-text-body)]">{initialAssignmentName ?? existingSchedule?.assignmentName ?? '—'}</span>
                </div>
              )}
            </div>

            {isGradeType && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-body)]">Send messages to students who score:</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-4">
                    {['below', 'above'].map(d => (
                      <label key={d} className="flex items-center gap-2 text-sm cursor-pointer capitalize text-[var(--color-text-body)]">
                        <input type="radio" name="sched-direction" value={d} checked={direction === d}
                          onChange={() => setDirection(d)} className="accent-[var(--cpt-color)]" />
                        {d}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input w-20 text-sm"
                      value={thresholdPct}
                      onChange={e => setThresholdPct(e.target.value)}
                      min="0" max="100"
                    />
                    <span className="text-sm text-[var(--color-text-muted)]">%</span>
                  </div>
                </div>
                {toolType === 'grade-outreach-overall' && (
                  <div className="flex gap-4">
                    {[
                      { value: 'current', label: 'Current score' },
                      { value: 'final',   label: 'Final score (missing = 0)' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer text-[var(--color-text-body)]">
                        <input type="radio" name="sched-score-type" value={opt.value} checked={scoreType === opt.value}
                          onChange={() => setScoreType(opt.value)} className="accent-[var(--cpt-color)]" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isUpcoming && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-[var(--color-text-body)]">Send reminders for assignments due within</label>
                <input
                  type="number"
                  className="input w-16 text-sm"
                  value={daysAhead}
                  onChange={e => setDaysAhead(Math.max(1, Math.min(30, Number(e.target.value))))}
                  min="1" max="30"
                />
                <span className="text-sm text-[var(--color-text-muted)]">days</span>
              </div>
            )}

            {toolType === 'submission-reminder-specific' && (
              <p className="text-sm text-[var(--color-text-muted)]">
                This rule will send reminders to all students who have not yet submitted the assignment above.
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Message ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-body)] mb-1.5">Subject</label>
              <input
                type="text"
                className="input w-full text-sm"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Message subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-body)] mb-1.5">Message</label>
              <textarea
                className="input w-full text-sm font-mono resize-y"
                rows={7}
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                placeholder="Write your message here…"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Available tokens: {(TOOL_TOKENS[toolType] ?? []).join('  ')}
              </p>
            </div>
            {previewBody && (
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Preview (Jane Smith)</p>
                <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm text-[var(--color-text-body)] whitespace-pre-wrap bg-[var(--color-surface-raised)]">
                  {previewBody}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Schedule & Authorize ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--color-text-body)]">Run this check:</p>
              <div className="flex gap-4">
                {['daily', 'weekly'].map(c => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer capitalize text-[var(--color-text-body)]">
                    <input type="radio" name="sched-cadence" value={c} checked={cadence === c}
                      onChange={() => setCadence(c)} className="accent-[var(--cpt-color)]" />
                    {c}
                  </label>
                ))}
              </div>

              {cadence === 'weekly' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-text-muted)]">on</span>
                  <select
                    className="input text-sm"
                    value={runDayOfWeek}
                    onChange={e => setRunDayOfWeek(Number(e.target.value))}
                  >
                    {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-text-muted)]">at</span>
                <select
                  className="input text-sm"
                  value={runHour}
                  onChange={e => setRunHour(Number(e.target.value))}
                >
                  {HOUR_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-raised)] text-sm text-[var(--color-text-body)]">
              <p className="font-medium mb-1">Summary</p>
              <p className="text-[var(--color-text-muted)]">{summaryText()}</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {isEdit
                ? 'Saving will verify your identity and update this recurring rule. The rule will continue to run automatically on the new schedule.'
                : 'Clicking "Authorize & Save" will verify your identity once and authorize all future automated sends for this rule.'
              }
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
