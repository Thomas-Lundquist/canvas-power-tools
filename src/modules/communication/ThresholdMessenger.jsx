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

I noticed you scored {score}% on {assignment_name}. I would like to connect with you to discuss how we can support your success. Please see me during office hours or reply to this message.

{teacher_name}`

const TOKENS = ['{first_name}', '{last_name}', '{score}', '{grade}', '{points_possible}', '{assignment_name}', '{teacher_name}', '{course_name}']

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

function PreviewModal({ recipients, message, assignment, course, teacherName, direction, thresholdPct, onSend, onCancel, sending, progress }) {
  const example = recipients[0]
    ? resolveTokens(message, { student: recipients[0], assignment, course, teacherName })
    : ''

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900">Preview — Threshold Messages</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {recipients.length} message{recipients.length !== 1 ? 's' : ''} for students {direction} {thresholdPct}%
          </p>
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
          <CountdownButton onSend={onSend} sending={sending} progress={progress} label="Send Messages" />
        </div>
      </div>
    </div>
  )
}

export default function ThresholdMessenger() {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(null)
  const [course, setCourse]                 = useState(null)
  const [assignments, setAssignments]       = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assignmentId, setAssignmentId]     = useState('')
  const [submissions, setSubmissions]       = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
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
    if (!selectedAssignment || submissions.length === 0) return []
    const max = selectedAssignment.pointsPossible
    if (max <= 0) return []
    const cutoff = Number(thresholdPct) / 100
    return submissions.filter(s => {
      const pct = s.score / max
      return direction === 'below' ? pct < cutoff : pct > cutoff
    })
  }, [submissions, selectedAssignment, direction, thresholdPct])

  useEffect(() => {
    setSelected(new Set(matching.map(s => s.userId)))
  }, [matching])

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

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Threshold Messenger</h1>
          <p className="text-sm text-gray-500 mt-1">Message students who scored above or below a grade threshold.</p>
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
                ? <option>No gradable assignments</option>
                : assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
              }
            </select>
          )}
        </div>
      </div>

      {/* Threshold controls */}
      {assignmentId && (
        <div className="card p-5 mb-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Send to students who scored:</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-4">
              {['below', 'above'].map(d => (
                <label key={d} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer capitalize">
                  <input type="radio" name="direction" value={d} checked={direction === d}
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
                placeholder="70"
              />
              <span className="text-sm text-gray-500">%</span>
              {thresholdPts !== '' && selectedAssignment && (
                <span className="text-xs text-gray-400">({thresholdPts} / {selectedAssignment.pointsPossible} pts)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student list */}
      {assignmentId && (
        <div className="card overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">
              {loadingSubmissions
                ? 'Loading students…'
                : `Students matching (${matching.length} of ${submissions.length})`}
            </p>
          </div>
          {loadingSubmissions ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
              <Loader size={14} className="animate-spin" /> Loading submissions…
            </div>
          ) : matching.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No students match this threshold.</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {matching.map(s => {
                const max = selectedAssignment?.pointsPossible ?? 0
                const pct = max > 0 ? Math.round((s.score / max) * 100) : null
                return (
                  <label key={s.userId} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                    <Checkbox checked={selected.has(s.userId)} onChange={() => toggleStudent(s.userId)} />
                    <span className="flex-1 text-sm text-gray-800">{s.userName ?? 'Unknown'}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {pct !== null ? `${pct}%` : '—'}
                      {max > 0 && <span className="text-gray-400">  {s.score} / {max}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {assignmentId && matching.length > 0 && (
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
          <p className="text-xs text-gray-400">Available tokens: {TOKENS.join('  ')}</p>
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
          direction={direction}
          thresholdPct={thresholdPct}
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
