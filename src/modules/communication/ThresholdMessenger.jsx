import { useState, useEffect, useMemo } from 'react'
import { Loader, AlertTriangle, Send, Clock } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import { Tabs, TabPanel } from '../../components/Tabs.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignmentsWithGradingData, getAssignmentSubmissions } from '../../api/submissions.js'
import { getEnrollmentsWithGrades } from '../../api/enrollments.js'
import { sendConversation } from '../../api/conversations.js'
import { getAccount } from '../../storage/account.js'
import { addSentLogEntry, getSentLog } from '../../storage/sentLog.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'
import { resolveTokens, resolveOverallTokens } from './tokenHelpers.js'
import SentLogPanel from './SentLogPanel.jsx'
import ScheduleManager from './ScheduleManager.jsx'
import ScheduleForm from './ScheduleForm.jsx'

const DEFAULT_MESSAGE = `Hi {first_name},

I noticed you scored {score}% on {assignment_name}. I would like to connect with you to discuss how we can support your success. Please see me during office hours or reply to this message.

{teacher_name}`

const DEFAULT_OVERALL_MESSAGE = `Hi {first_name},

I'm reaching out because your current overall grade in {course_name} is {overall_score}% ({overall_grade}). I would like to connect with you to discuss how we can support your success in this course. Please see me during office hours or reply to this message.

{teacher_name}`

const TOKENS = ['{first_name}', '{last_name}', '{score}', '{grade}', '{points_possible}', '{assignment_name}', '{teacher_name}', '{course_name}']
const OVERALL_TOKENS = ['{first_name}', '{last_name}', '{overall_score}', '{overall_grade}', '{teacher_name}', '{course_name}']

function CountdownButton({ onSend, sending, progress, label }) {
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const ready = seconds <= 0 && !sending

  return (
    <button
      className="btn-primary flex items-center gap-2 min-w-[11rem] justify-center"
      disabled={!ready}
      onClick={onSend}
    >
      {sending ? (
        <><Loader size={14} className="animate-spin" />{progress || 'Sending…'}</>
      ) : seconds > 0 ? (
        <><Clock size={14} />Send in {seconds}…</>
      ) : (
        <><Send size={14} />{label}</>
      )}
    </button>
  )
}

function PreviewModal({ recipients, message, resolveExample, subtitle, onSend, onCancel, sending, progress }) {
  const example = recipients[0] ? resolveExample(recipients[0]) : ''

  return (
    <Modal
      title="Preview — Threshold Messages"
      subtitle={subtitle}
      onClose={onCancel}
      size="sm"
      footer={<>
        <button className="btn-secondary" onClick={onCancel} disabled={sending}>Cancel</button>
        <CountdownButton onSend={onSend} sending={sending} progress={progress} label="Send Messages" />
      </>}
    >
      <div className="space-y-4">
        {recipients[0] && (
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Example ({recipients[0].userName ?? 'Student'})</p>
            <div className="bg-[var(--color-bg-hover)] rounded-lg p-4 text-sm text-[var(--color-text-body)] whitespace-pre-wrap border border-[var(--color-border)]">
              {example}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Recipients</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{recipients.map(r => r.userName ?? 'Unknown').join(', ')}</p>
        </div>
        <div className="flex items-start gap-2 bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-bg-surface))] border border-[color-mix(in_srgb,var(--color-warning)_32%,var(--color-bg-surface))] rounded-lg p-3 text-xs text-[var(--color-warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>This will send {recipients.length} message{recipients.length !== 1 ? 's' : ''} via Canvas Inbox. Messages cannot be unsent.</span>
        </div>
      </div>
    </Modal>
  )
}

export default function ThresholdMessenger() {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(null)
  const [course, setCourse]                 = useState(null)
  const [mode, setMode]                     = useState('assignment')
  const [pendingMode, setPendingMode]       = useState(null)
  const [scoreType, setScoreType]           = useState('current')
  const [assignments, setAssignments]       = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assignmentId, setAssignmentId]     = useState('')
  const [submissions, setSubmissions]       = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [enrollments, setEnrollments]       = useState([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)
  const [direction, setDirection]           = useState('below')
  const [thresholdPct, setThresholdPct]     = useState('70')
  const [selected, setSelected]             = useState(new Set())
  const [message, setMessage]               = useState(DEFAULT_MESSAGE)
  const [teacherName, setTeacherName]       = useState('')
  const [showPreview, setShowPreview]       = useState(false)
  const [sending, setSending]               = useState(false)
  const [progress, setProgress]             = useState('')
  const [showSentLog, setShowSentLog]       = useState(false)
  const [sentLog, setSentLog]               = useState([])
  const [activeTab, setActiveTab]           = useState('send-now')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [editingSchedule, setEditingSchedule]   = useState(null)
  const [scheduleFormType, setScheduleFormType] = useState('grade-outreach-assignment')

  useEffect(() => {
    getAccount().then(a => setTeacherName(a?.userName ?? ''))
    getCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) loadAssignments(list[0].id, list[0])
      })
      .finally(() => setLoadingCourses(false))
    getSentLog().then(setSentLog)
  }, [])

  async function loadAssignments(cId, cObj) {
    setCourseId(cId)
    setCourse(cObj ?? courses.find(c => c.id === cId) ?? null)
    setAssignments([])
    setSubmissions([])
    setAssignmentId('')
    setSelected(new Set())
    setLoadingAssignments(true)
    try {
      const data = await getAssignmentsWithGradingData(cId)
      const gradable = data.filter(a => a.gradingType !== 'not_graded' && a.published)
      setAssignments(gradable)
      if (gradable.length > 0) await loadSubmissions(cId, gradable[0].id)
    } finally {
      setLoadingAssignments(false)
    }
  }

  async function loadSubmissions(cId, aId) {
    setAssignmentId(aId)
    setSubmissions([])
    setSelected(new Set())
    setLoadingSubmissions(true)
    try {
      const subs = await getAssignmentSubmissions(cId, aId)
      setSubmissions(subs.filter(s => s.score !== null))
    } finally {
      setLoadingSubmissions(false)
    }
  }

  async function loadEnrollments(cId) {
    setEnrollments([])
    setSelected(new Set())
    setLoadingEnrollments(true)
    try {
      const data = await getEnrollmentsWithGrades(cId)
      setEnrollments(data)
    } finally {
      setLoadingEnrollments(false)
    }
  }

  function applyMode(nextMode) {
    setMode(nextMode)
    setMessage(nextMode === 'overall' ? DEFAULT_OVERALL_MESSAGE : DEFAULT_MESSAGE)
    setSelected(new Set())
    setEnrollments([])
    setSubmissions([])
    setAssignmentId('')
    setPendingMode(null)
    if (courseId) {
      if (nextMode === 'overall') loadEnrollments(courseId)
      else loadAssignments(courseId, course)
    }
  }

  function handleModeChange(nextMode) {
    if (nextMode === mode) return
    const defaultMsg = mode === 'overall' ? DEFAULT_OVERALL_MESSAGE : DEFAULT_MESSAGE
    if (message !== defaultMsg) {
      setPendingMode(nextMode)
    } else {
      applyMode(nextMode)
    }
  }

  const selectedAssignment = useMemo(
    () => assignments.find(a => a.id === assignmentId) ?? null,
    [assignments, assignmentId],
  )

  // Points value that mirrors the percentage threshold
  const thresholdPts = useMemo(() => {
    const max = selectedAssignment?.pointsPossible ?? 0
    if (max <= 0 || thresholdPct === '') return ''
    return String(Math.round((Number(thresholdPct) / 100) * max * 10) / 10)
  }, [thresholdPct, selectedAssignment])

  const matching = useMemo(() => {
    if (mode !== 'assignment' || !selectedAssignment || submissions.length === 0) return []
    const max = selectedAssignment.pointsPossible
    if (max <= 0) return []
    const cutoff = Number(thresholdPct) / 100
    return submissions.filter(s => {
      const pct = s.score / max
      return direction === 'below' ? pct < cutoff : pct > cutoff
    })
  }, [mode, submissions, selectedAssignment, direction, thresholdPct])

  useEffect(() => {
    if (mode === 'assignment') setSelected(new Set(matching.map(s => s.userId)))
  }, [matching, mode])

  const overallMatching = useMemo(() => {
    if (mode !== 'overall' || enrollments.length === 0 || thresholdPct === '') return []
    const cutoff = Number(thresholdPct)
    return enrollments.filter(e => {
      const score = scoreType === 'final' ? e.finalScore : e.currentScore
      if (score === null || score === undefined) return false
      return direction === 'below' ? score < cutoff : score > cutoff
    })
  }, [mode, enrollments, scoreType, direction, thresholdPct])

  useEffect(() => {
    if (mode === 'overall') setSelected(new Set(overallMatching.map(e => e.userId)))
  }, [overallMatching, mode])

  function toggleStudent(userId) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(userId) ? s.delete(userId) : s.add(userId)
      return s
    })
  }

  const recipients = useMemo(
    () => matching.filter(s => selected.has(s.userId)),
    [matching, selected],
  )

  const overallRecipients = useMemo(
    () => overallMatching.filter(e => selected.has(e.userId)),
    [overallMatching, selected],
  )

  const nullGradeCount = useMemo(() => {
    if (mode !== 'overall') return 0
    return enrollments.filter(e => {
      const score = scoreType === 'final' ? e.finalScore : e.currentScore
      return score === null || score === undefined
    }).length
  }, [mode, enrollments, scoreType])

  async function handleSend() {
    if (!selectedAssignment || recipients.length === 0) return

    const label = direction === 'below' ? `below ${thresholdPct}%` : `above ${thresholdPct}%`
    const summary = `Messaged ${recipients.length} student${recipients.length !== 1 ? 's' : ''} ${label} on "${selectedAssignment.name}"`
    await requirePin({ action: 'threshold_message', summary, courseId, courseName: course?.name ?? '' }, async () => {
      setSending(true)
      let done = 0
      const subject = `Regarding your grade on ${selectedAssignment.name}`
      for (const student of recipients) {
        const body = resolveTokens(message, { student, assignment: selectedAssignment, course, teacherName })
        await sendConversation(student.userId, subject, body, courseId)
        done++
        setProgress(`${done} of ${recipients.length} sent…`)
      }

      await addSentLogEntry({
        type:           'threshold',
        assignmentId:   selectedAssignment.id,
        assignmentName: selectedAssignment.name,
        courseId,
        courseName:     course?.name ?? '',
        recipientCount: recipients.length,
        recipients:     recipients.map(r => ({ id: r.userId, name: r.userName })),
        messageBody:    message,
        meta:           { direction, thresholdPct },
      })

      setSending(false)
      setProgress('')
      setShowPreview(false)
      toast(`Sent ${recipients.length} message${recipients.length !== 1 ? 's' : ''}`, 'success')
      getSentLog().then(setSentLog)
    })
  }

  async function handleOverallSend() {
    if (overallRecipients.length === 0) return
    const label = direction === 'below' ? `below ${thresholdPct}%` : `above ${thresholdPct}%`
    const summary = `Messaged ${overallRecipients.length} student${overallRecipients.length !== 1 ? 's' : ''} with overall grade ${label} in ${course?.name ?? 'course'}`
    await requirePin({ action: 'overall_grade_message', summary, courseId, courseName: course?.name ?? '' }, async () => {
      setSending(true)
      let done = 0
      const subject = `Regarding your overall grade in ${course?.name ?? 'your course'}`
      for (const student of overallRecipients) {
        const body = resolveOverallTokens(message, { student, course, teacherName, scoreType })
        await sendConversation(student.userId, subject, body, courseId)
        done++
        setProgress(`${done} of ${overallRecipients.length} sent…`)
      }
      await addSentLogEntry({
        type:           'overall-grade',
        assignmentId:   null,
        assignmentName: null,
        courseId,
        courseName:     course?.name ?? '',
        recipientCount: overallRecipients.length,
        recipients:     overallRecipients.map(r => ({ id: r.userId, name: r.userName })),
        messageBody:    message,
        meta:           { direction, thresholdPct, scoreType },
      })
      setSending(false)
      setProgress('')
      setShowPreview(false)
      toast(`Sent ${overallRecipients.length} message${overallRecipients.length !== 1 ? 's' : ''}`, 'success')
      getSentLog().then(setSentLog)
    })
  }

  const TABS = [
    { id: 'send-now', label: 'Send Now' },
    { id: 'rules',    label: 'Rules' },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Grade Outreach</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Message students who scored above or below a grade threshold.</p>
        </div>
        <button className="btn-secondary text-sm" onClick={() => setShowSentLog(true)}>
          Sent Log {sentLog.length > 0 && <span className="ml-1 text-xs text-[var(--color-text-disabled)]">({sentLog.length})</span>}
        </button>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel tabId="send-now" activeTab={activeTab}>

      {/* Mode toggle */}
      <div className="card p-4 mt-5 mb-5">
        <p className="section-label mb-3">Filter students by</p>
        <div className="segmented-control" role="group" aria-label="Filter mode">
          {[
            { value: 'assignment', label: 'Score on an assignment' },
            { value: 'overall',    label: 'Overall course grade'   },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={mode === opt.value}
              onClick={() => handleModeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {pendingMode && (
          <div className="mt-3 flex items-center gap-3 bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-bg-surface))] border border-[color-mix(in_srgb,var(--color-warning)_32%,var(--color-bg-surface))] rounded-lg px-3 py-2 text-xs text-[var(--color-warning)]">
            <AlertTriangle size={13} className="shrink-0" />
            <span>Switching modes will reset your message.</span>
            <button className="btn-secondary text-xs py-0.5 px-2" onClick={() => applyMode(pendingMode)}>Continue</button>
            <button className="btn-ghost text-xs py-0.5 px-2" onClick={() => setPendingMode(null)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Course + Assignment */}
      <div className="card p-4 mb-5 space-y-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0 w-24">Course</span>
          <CourseSelector courses={courses} selectedId={courseId} onChange={cId => {
            const c = courses.find(x => x.id === cId)
            if (mode === 'assignment') {
              loadAssignments(cId, c)
            } else {
              setCourseId(cId)
              setCourse(c ?? null)
              loadEnrollments(cId)
            }
          }} loading={loadingCourses} />
        </div>
        {mode === 'assignment' && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0 w-24">Assignment</span>
            {loadingAssignments ? (
              <span className="text-sm text-[var(--color-text-disabled)] flex items-center gap-1.5"><Loader size={13} className="animate-spin" /> Loading…</span>
            ) : (
              <select
                className="input text-sm flex-1"
                value={assignmentId}
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
        )}
        {mode === 'overall' && courseId && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0 w-24">Score type</span>
            <div className="segmented-control" role="group" aria-label="Score type">
              {[
                { value: 'current', label: 'Current' },
                { value: 'final',   label: 'Final (missing = 0)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={scoreType === opt.value}
                  onClick={() => setScoreType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Threshold controls */}
      {(mode === 'assignment' ? !!assignmentId : !!courseId) && (
        <div className="card p-5 mb-5">
          <p className="text-sm font-semibold text-[var(--color-text-body)] mb-3">
            {mode === 'assignment' ? 'Send to students who scored:' : 'Send to students whose overall grade is:'}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="segmented-control" role="group" aria-label="Direction">
              {['below', 'above'].map(d => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={direction === d}
                  onClick={() => setDirection(d)}
                  className="capitalize"
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input w-20 text-sm"
                value={thresholdPct}
                onChange={e => setThresholdPct(e.target.value)}
                min="0" max="100"
                placeholder="70"
              />
              <span className="text-sm text-[var(--color-text-muted)]">%</span>
              {mode === 'assignment' && thresholdPts !== '' && selectedAssignment && (
                <span className="text-xs text-[var(--color-text-disabled)]">({thresholdPts} / {selectedAssignment.pointsPossible} pts)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student list */}
      {(mode === 'assignment' ? !!assignmentId : !!courseId) && (
        <div className="card overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
            <p className="text-sm font-semibold text-[var(--color-text-body)]">
              {mode === 'assignment'
                ? (loadingSubmissions ? 'Loading students…' : `Students matching (${matching.length} of ${submissions.length})`)
                : (loadingEnrollments ? 'Loading students…' : `Students matching (${overallMatching.length} of ${enrollments.length} enrolled)`)}
            </p>
          </div>
          {(mode === 'assignment' ? loadingSubmissions : loadingEnrollments) ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-text-disabled)] text-sm">
              <Loader size={14} className="animate-spin" />
              {mode === 'assignment' ? 'Loading submissions…' : 'Loading grades…'}
            </div>
          ) : (mode === 'assignment' ? matching : overallMatching).length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)] py-6 text-center">No students match this threshold.</p>
          ) : mode === 'assignment' ? (
            <div className="divide-y divide-[var(--color-border-subtle)] max-h-64 overflow-y-auto">
              {matching.map(s => {
                const max = selectedAssignment?.pointsPossible ?? 0
                const pct = max > 0 ? Math.round((s.score / max) * 100) : null
                return (
                  <label key={s.userId} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--color-bg-hover)]">
                    <Checkbox checked={selected.has(s.userId)} onChange={() => toggleStudent(s.userId)} />
                    <span className="flex-1 text-sm text-[var(--color-text-body)]">{s.userName ?? 'Unknown'}</span>
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                      {pct !== null ? `${pct}%` : '—'}
                      {max > 0 && <span className="text-[var(--color-text-disabled)]">  {s.score} / {max}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)] max-h-64 overflow-y-auto">
              {overallMatching.map(e => {
                const rawScore = scoreType === 'final' ? e.finalScore : e.currentScore
                const rawGrade = scoreType === 'final' ? e.finalGrade : e.currentGrade
                return (
                  <label key={e.userId} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--color-bg-hover)]">
                    <Checkbox checked={selected.has(e.userId)} onChange={() => toggleStudent(e.userId)} />
                    <span className="flex-1 text-sm text-[var(--color-text-body)]">{e.userName ?? 'Unknown'}</span>
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                      {rawScore !== null ? `${Math.round(rawScore)}%` : '—'}
                      {rawGrade && <span className="ml-1 text-[var(--color-text-disabled)]">({rawGrade})</span>}
                    </span>
                  </label>
                )
              })}
              {nullGradeCount > 0 && (
                <p className="text-xs text-[var(--color-text-disabled)] px-4 py-2">
                  {nullGradeCount} student{nullGradeCount !== 1 ? 's' : ''} have no grade data and are excluded.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {(mode === 'assignment' ? (!!assignmentId && matching.length > 0) : (!!courseId && overallMatching.length > 0)) && (
        <div className="card p-5 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[var(--color-text-body)]">Message</label>
            <span className="text-xs text-[var(--color-text-disabled)]">
              Sending to: {mode === 'assignment' ? recipients.length : overallRecipients.length} student{(mode === 'assignment' ? recipients : overallRecipients).length !== 1 ? 's' : ''}
            </span>
          </div>
          <textarea
            className="input w-full text-sm font-mono resize-y"
            rows={8}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-xs text-[var(--color-text-disabled)]">
            Available tokens: {(mode === 'overall' ? OVERALL_TOKENS : TOKENS).join('  ')}
          </p>
          <div className="flex justify-end">
            <button
              className="btn-primary flex items-center gap-1.5"
              disabled={(mode === 'assignment' ? recipients : overallRecipients).length === 0 || !message.trim()}
              onClick={() => setShowPreview(true)}
            >
              <Send size={14} /> Preview & Send
            </button>
          </div>
        </div>
      )}

      {showPreview && mode === 'assignment' && selectedAssignment && (
        <PreviewModal
          recipients={recipients}
          message={message}
          resolveExample={s => resolveTokens(message, { student: s, assignment: selectedAssignment, course, teacherName })}
          subtitle={`${recipients.length} message${recipients.length !== 1 ? 's' : ''} for students ${direction} ${thresholdPct}%`}
          sending={sending}
          progress={progress}
          onSend={handleSend}
          onCancel={() => !sending && setShowPreview(false)}
        />
      )}
      {showPreview && mode === 'overall' && courseId && (
        <PreviewModal
          recipients={overallRecipients}
          message={message}
          resolveExample={s => resolveOverallTokens(message, { student: s, course, teacherName, scoreType })}
          subtitle={`${overallRecipients.length} message${overallRecipients.length !== 1 ? 's' : ''} · overall grade ${direction} ${thresholdPct}%`}
          sending={sending}
          progress={progress}
          onSend={handleOverallSend}
          onCancel={() => !sending && setShowPreview(false)}
        />
      )}

      </TabPanel>

      <TabPanel tabId="rules" activeTab={activeTab}>
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mt-5 mb-2 px-0.5">Assignment Score Rules</p>
            <ScheduleManager
              toolType="grade-outreach-assignment"
              courseId={courseId}
              onCreateSchedule={() => { setScheduleFormType('grade-outreach-assignment'); setShowScheduleForm(true) }}
              onEditSchedule={s => { setEditingSchedule(s); setShowScheduleForm(true) }}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2 px-0.5">Overall Grade Rules</p>
            <ScheduleManager
              toolType="grade-outreach-overall"
              courseId={courseId}
              onCreateSchedule={() => { setScheduleFormType('grade-outreach-overall'); setShowScheduleForm(true) }}
              onEditSchedule={s => { setEditingSchedule(s); setShowScheduleForm(true) }}
            />
          </div>
        </div>
      </TabPanel>

      {showScheduleForm && (
        <ScheduleForm
          toolType={editingSchedule?.toolType ?? scheduleFormType}
          existingSchedule={editingSchedule ?? undefined}
          initialCourseId={courseId}
          initialCourseName={course?.name}
          initialAssignmentId={scheduleFormType === 'grade-outreach-assignment' ? assignmentId : null}
          initialAssignmentName={scheduleFormType === 'grade-outreach-assignment' ? selectedAssignment?.name : null}
          initialAssignmentPointsPossible={scheduleFormType === 'grade-outreach-assignment' ? selectedAssignment?.pointsPossible : null}
          initialAssignmentDueAt={scheduleFormType === 'grade-outreach-assignment' ? selectedAssignment?.dueAt : null}
          initialDirection={direction}
          initialThresholdPct={thresholdPct}
          initialScoreType={scoreType}
          initialMessage={message}
          initialTeacherName={teacherName}
          onClose={() => { setShowScheduleForm(false); setEditingSchedule(null) }}
          onSaved={() => { setShowScheduleForm(false); setEditingSchedule(null) }}
        />
      )}

      {showSentLog && (
        <SentLogPanel entries={sentLog} onClose={() => setShowSentLog(false)} />
      )}
    </div>
  )
}
