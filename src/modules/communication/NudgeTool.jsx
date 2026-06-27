import { useState, useEffect, useMemo } from 'react'
import { Loader, AlertTriangle, Send, Clock } from 'lucide-react'
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900">Preview — Nudge Messages</h3>
          <p className="text-xs text-gray-500 mt-0.5">{recipients.length} message{recipients.length !== 1 ? 's' : ''} will be sent. Each is personalized per student.</p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {recipients[0] && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Example ({recipients[0].userName ?? 'Student'})</p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap border border-gray-200">
                {example}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Recipients</p>
            <p className="text-sm text-gray-700">{recipients.map(r => r.userName ?? 'Unknown').join(', ')}</p>
          </div>

          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>This will send {recipients.length} message{recipients.length !== 1 ? 's' : ''} via Canvas Inbox. Messages cannot be unsent.</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button className="btn-secondary" onClick={onCancel} disabled={sending}>Cancel</button>
          <CountdownButton onSend={onSend} sending={sending} progress={progress} />
        </div>
      </div>
    </div>
  )
}

export default function NudgeTool() {
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
      const withMissing = data.filter(a => (a.submissionSummary?.notSubmitted ?? 0) > 0)
      setAssignments(withMissing)
      if (withMissing.length > 0) await loadSubmissions(cId, withMissing[0].id)
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
      const missing = subs.filter(s => s.missing || s.workflowState === 'unsubmitted')
      setSubmissions(missing)
      // Auto-select all except excused
      setSelected(new Set(missing.filter(s => !s.excused).map(s => s.userId)))
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

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nudge Tool</h1>
          <p className="text-sm text-gray-500 mt-1">Message students who have not submitted an assignment.</p>
        </div>
        <button className="btn-secondary text-sm" onClick={() => setShowSentLog(true)}>
          Sent Log {sentLog.length > 0 && <span className="ml-1 text-xs text-gray-400">({sentLog.length})</span>}
        </button>
      </div>

      {/* Course + Assignment */}
      <div className="card p-4 mb-5 space-y-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 shrink-0 w-24">Course</span>
          <CourseSelector courses={courses} selectedId={courseId} onChange={cId => {
            const c = courses.find(x => x.id === cId)
            loadAssignments(cId, c)
          }} loading={loadingCourses} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 shrink-0 w-24">Assignment</span>
          {loadingAssignments ? (
            <span className="text-sm text-gray-400 flex items-center gap-1.5"><Loader size={13} className="animate-spin" /> Loading…</span>
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
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">
              {loadingSubmissions
                ? 'Loading students…'
                : submissions.length === 0
                  ? 'No missing submissions'
                  : `Students who have not submitted (${submissions.length})`}
            </p>
          </div>
          {loadingSubmissions ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
              <Loader size={14} className="animate-spin" /> Loading submissions…
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">All students have submitted this assignment.</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {submissions.map(s => (
                <label
                  key={s.userId}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${s.excused ? 'opacity-50' : ''}`}
                >
                  <Checkbox
                    checked={selected.has(s.userId)}
                    onChange={() => !s.excused && toggleStudent(s.userId)}
                    disabled={s.excused}
                  />
                  <span className="flex-1 text-sm text-gray-800">{s.userName ?? 'Unknown Student'}</span>
                  {s.excused && <span className="text-xs text-gray-400">Excused — skip</span>}
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
            <label className="text-sm font-semibold text-gray-800">Message</label>
            <span className="text-xs text-gray-400">Sending to: {recipients.length} student{recipients.length !== 1 ? 's' : ''}</span>
          </div>
          <textarea
            className="input w-full text-sm font-mono resize-y"
            rows={8}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-xs text-gray-400">
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

      {showSentLog && (
        <SentLogPanel entries={sentLog} onClose={() => setShowSentLog(false)} />
      )}
    </div>
  )
}
