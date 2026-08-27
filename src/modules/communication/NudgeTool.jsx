import { useState, useEffect, useMemo } from 'react'
import { Loader, Send, Clock } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import Callout from '../../components/Callout.jsx'
import { Tabs, TabPanel } from '../../components/Tabs.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignmentsWithGradingData, getAssignmentSubmissions } from '../../api/submissions.js'
import { sendConversation } from '../../api/conversations.js'
import { getAccount } from '../../storage/account.js'
import { addSentLogEntry, getSentLog } from '../../storage/sentLog.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'
import { resolveTokens } from './tokenHelpers.js'
import SentLogPanel from './SentLogPanel.jsx'
import ScheduleManager from './ScheduleManager.jsx'
import ScheduleForm from './ScheduleForm.jsx'

const DEFAULT_MESSAGE = `Hi {first_name},

This is a reminder that {assignment_name} was due on {due_date}. Please submit as soon as possible or reach out if you need assistance.

{teacher_name}`

const TOKENS = ['{first_name}', '{last_name}', '{assignment_name}', '{due_date}', '{teacher_name}', '{course_name}']

function CountdownButton({ onSend, sending, progress }) {
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const ready = seconds <= 0 && !sending

  return (
    <button
      className="btn-primary flex items-center gap-2 min-w-[10rem] justify-center"
      disabled={!ready}
      onClick={onSend}
    >
      {sending ? (
        <><Loader size={14} className="animate-spin" />{progress || 'Sending…'}</>
      ) : seconds > 0 ? (
        <><Clock size={14} />Send in {seconds}…</>
      ) : (
        <><Send size={14} />Send Nudges</>
      )}
    </button>
  )
}

function PreviewModal({ recipients, message, assignment, course, teacherName, onSend, onCancel, sending, progress }) {
  const example = recipients[0]
    ? resolveTokens(message, { student: recipients[0], assignment, course, teacherName })
    : ''

  return (
    <Modal
      title="Preview — Nudge Messages"
      subtitle={`${recipients.length} message${recipients.length !== 1 ? 's' : ''} will be sent. Each is personalized per student.`}
      onClose={onCancel}
      size="sm"
      footer={<>
        <button className="btn-secondary" onClick={onCancel} disabled={sending}>Cancel</button>
        <CountdownButton onSend={onSend} sending={sending} progress={progress} />
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
        <Callout tone="warning">
          This will send {recipients.length} message{recipients.length !== 1 ? 's' : ''} via Canvas Inbox. Messages cannot be unsent.
        </Callout>
      </div>
    </Modal>
  )
}

export default function NudgeTool({ initialCourseId, initialAssignmentId, initialStudentIds } = {}) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]             = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]           = useState(null)
  const [course, setCourse]               = useState(null)
  const [assignments, setAssignments]     = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assignmentId, setAssignmentId]   = useState('')
  const [submissions, setSubmissions]     = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [selected, setSelected]           = useState(new Set())
  const [message, setMessage]             = useState(DEFAULT_MESSAGE)
  const [teacherName, setTeacherName]     = useState('')
  const [showPreview, setShowPreview]     = useState(false)
  const [sending, setSending]             = useState(false)
  const [progress, setProgress]           = useState('')
  const [showSentLog, setShowSentLog]     = useState(false)
  const [sentLog, setSentLog]             = useState([])
  const [activeTab, setActiveTab]         = useState('send-now')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [editingSchedule, setEditingSchedule]   = useState(null)
  const [scheduleFormType, setScheduleFormType] = useState('submission-reminder-specific')

  useEffect(() => {
    getAccount().then(a => setTeacherName(a?.userName ?? ''))
    getCourses()
      .then(list => {
        setCourses(list)
        const start = initialCourseId && list.find(c => c.id === String(initialCourseId))
          ? list.find(c => c.id === String(initialCourseId))
          : list[0]
        if (start) loadAssignments(start.id, start, initialAssignmentId, initialStudentIds)
      })
      .finally(() => setLoadingCourses(false))
    getSentLog().then(setSentLog)
  }, [])

  async function loadAssignments(cId, cObj, preferredAssignmentId, preferredStudentIds) {
    setCourseId(cId)
    setCourse(cObj ?? courses.find(c => c.id === cId) ?? null)
    setAssignments([])
    setSubmissions([])
    setAssignmentId('')
    setSelected(new Set())
    setLoadingAssignments(true)
    try {
      const data = await getAssignmentsWithGradingData(cId)
      const withMissing = data.filter(a => (a.submissionSummary?.notSubmitted ?? 0) > 0)
      setAssignments(withMissing)
      const start = preferredAssignmentId && withMissing.find(a => a.id === String(preferredAssignmentId))
        ? String(preferredAssignmentId)
        : withMissing[0]?.id
      if (start) await loadSubmissions(cId, start, preferredStudentIds)
    } finally {
      setLoadingAssignments(false)
    }
  }

  async function loadSubmissions(cId, aId, preferredStudentIds) {
    setAssignmentId(aId)
    setSubmissions([])
    setSelected(new Set())
    setLoadingSubmissions(true)
    try {
      const subs = await getAssignmentSubmissions(cId, aId)
      const missing = subs.filter(s => s.missing || s.workflowState === 'unsubmitted')
      setSubmissions(missing)
      const eligible = missing.filter(s => !s.excused).map(s => s.userId)
      const preferred = preferredStudentIds
        ? eligible.filter(id => preferredStudentIds.includes(id))
        : []
      // Auto-select all except excused, unless a specific preferred subset (e.g. from a
      // Missing Work "Nudge" deep link) actually matches — then narrow to just that.
      setSelected(new Set(preferred.length > 0 ? preferred : eligible))
    } finally {
      setLoadingSubmissions(false)
    }
  }

  const selectedAssignment = useMemo(
    () => assignments.find(a => a.id === assignmentId) ?? null,
    [assignments, assignmentId],
  )

  const recipients = useMemo(
    () => submissions.filter(s => selected.has(s.userId)),
    [submissions, selected],
  )

  function toggleStudent(userId) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(userId) ? s.delete(userId) : s.add(userId)
      return s
    })
  }

  async function handleSend() {
    if (!selectedAssignment || recipients.length === 0) return

    const summary = `Nudged ${recipients.length} student${recipients.length !== 1 ? 's' : ''} for "${selectedAssignment.name}"`
    await requirePin({ action: 'nudge', summary, courseId, courseName: course?.name ?? '' }, async () => {
      setSending(true)
      let done = 0
      const subject = `Reminder: ${selectedAssignment.name}`
      for (const student of recipients) {
        const body = resolveTokens(message, { student, assignment: selectedAssignment, course, teacherName })
        await sendConversation(student.userId, subject, body, courseId)
        done++
        setProgress(`${done} of ${recipients.length} sent…`)
      }

      await addSentLogEntry({
        type:           'nudge',
        assignmentId:   selectedAssignment.id,
        assignmentName: selectedAssignment.name,
        courseId,
        courseName:     course?.name ?? '',
        recipientCount: recipients.length,
        recipients:     recipients.map(r => ({ id: r.userId, name: r.userName })),
        messageBody:    message,
      })

      setSending(false)
      setProgress('')
      setShowPreview(false)
      toast(`Sent ${recipients.length} nudge${recipients.length !== 1 ? 's' : ''}`, 'success')
      getSentLog().then(setSentLog)
      // Reload submissions to reflect sent state
      if (courseId && assignmentId) loadSubmissions(courseId, assignmentId)
    })
  }

  const TABS = [
    { id: 'send-now', label: 'Send Now' },
    { id: 'rules',    label: 'Rules' },
  ]

  return (
    <div>
      <PageHeader
        title="Submission Reminders"
        actions={
          <button className="btn-secondary text-sm" onClick={() => setShowSentLog(true)}>
            Sent Log {sentLog.length > 0 && <span className="ml-1 text-xs text-[var(--color-text-disabled)]">({sentLog.length})</span>}
          </button>
        }
      >
        Message students who have not submitted an assignment.
      </PageHeader>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel tabId="send-now" activeTab={activeTab}>

      {/* Course + Assignment */}
      <div className="card p-4 mt-5 mb-5 space-y-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0 w-24">Course</span>
          <CourseSelector courses={courses} selectedId={courseId} onChange={cId => {
            const c = courses.find(x => x.id === cId)
            loadAssignments(cId, c)
          }} loading={loadingCourses} />
        </div>
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
                ? <option>No assignments with missing submissions</option>
                : assignments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.submissionSummary ? ` (${a.submissionSummary.notSubmitted} missing)` : ''}
                  </option>
                ))
              }
            </select>
          )}
        </div>
      </div>

      {/* Student list */}
      {assignmentId && (
        <div className="card overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
            <p className="text-sm font-semibold text-[var(--color-text-body)]">
              {loadingSubmissions
                ? 'Loading students…'
                : submissions.length === 0
                  ? 'No missing submissions'
                  : `Students who have not submitted (${submissions.length})`}
            </p>
          </div>
          {loadingSubmissions ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-text-disabled)] text-sm">
              <Loader size={14} className="animate-spin" /> Loading submissions…
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)] py-6 text-center">All students have submitted this assignment.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)] max-h-64 overflow-y-auto">
              {submissions.map(s => (
                <label
                  key={s.userId}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--color-bg-hover)] ${s.excused ? 'opacity-50' : ''}`}
                >
                  <Checkbox
                    checked={selected.has(s.userId)}
                    onChange={() => !s.excused && toggleStudent(s.userId)}
                    disabled={s.excused}
                  />
                  <span className="flex-1 text-sm text-[var(--color-text-body)]">{s.userName ?? 'Unknown Student'}</span>
                  {s.excused
                    ? <span className="text-xs text-[var(--color-text-disabled)]">Excused — skip</span>
                    : selectedAssignment?.dueAt
                      ? <span className="text-xs text-[var(--color-text-disabled)]">Missing since {new Date(selectedAssignment.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      : null}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {assignmentId && submissions.length > 0 && (
        <div className="card p-5 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[var(--color-text-body)]">Message</label>
            <span className="text-xs text-[var(--color-text-disabled)]">Sending to: {recipients.length} student{recipients.length !== 1 ? 's' : ''}</span>
          </div>
          <textarea
            className="input w-full text-sm font-mono resize-y"
            rows={8}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-xs text-[var(--color-text-disabled)]">
            Available tokens: {TOKENS.join('  ')}
          </p>
          <div className="flex justify-end">
            <button
              className="btn-primary flex items-center gap-1.5"
              disabled={recipients.length === 0 || !message.trim()}
              onClick={() => setShowPreview(true)}
            >
              <Send size={14} /> Preview & Send
            </button>
          </div>
        </div>
      )}

      {showPreview && selectedAssignment && (
        <PreviewModal
          recipients={recipients}
          message={message}
          assignment={selectedAssignment}
          course={course}
          teacherName={teacherName}
          sending={sending}
          progress={progress}
          onSend={handleSend}
          onCancel={() => !sending && setShowPreview(false)}
        />
      )}

      </TabPanel>

      <TabPanel tabId="rules" activeTab={activeTab}>
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mt-5 mb-2 px-0.5">Specific Assignment Rules</p>
            <ScheduleManager
              toolType="submission-reminder-specific"
              courseId={courseId}
              onCreateSchedule={() => { setScheduleFormType('submission-reminder-specific'); setShowScheduleForm(true) }}
              onEditSchedule={s => { setEditingSchedule(s); setShowScheduleForm(true) }}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2 px-0.5">Upcoming Assignment Rules</p>
            <ScheduleManager
              toolType="submission-reminder-upcoming"
              courseId={courseId}
              onCreateSchedule={() => { setScheduleFormType('submission-reminder-upcoming'); setShowScheduleForm(true) }}
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
          initialAssignmentId={scheduleFormType === 'submission-reminder-specific' ? assignmentId : null}
          initialAssignmentName={scheduleFormType === 'submission-reminder-specific' ? selectedAssignment?.name : null}
          initialAssignmentPointsPossible={scheduleFormType === 'submission-reminder-specific' ? selectedAssignment?.pointsPossible : null}
          initialAssignmentDueAt={scheduleFormType === 'submission-reminder-specific' ? selectedAssignment?.dueAt : null}
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
