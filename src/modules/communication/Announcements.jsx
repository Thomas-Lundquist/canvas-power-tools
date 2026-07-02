import { useState, useEffect } from 'react'
import { Loader, AlertTriangle, Send, BookTemplate, Save, FileText, Trash2, Clock } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import { getCourses } from '../../api/courses.js'
import { createAnnouncement } from '../../api/discussions.js'
import { getDrafts, saveDraft, deleteDraft, getAnnouncementTemplates, saveAnnouncementTemplate, deleteAnnouncementTemplate } from '../../storage/announcements.js'
import { addSentLogEntry, getSentLog } from '../../storage/sentLog.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'
import SentLogPanel from './SentLogPanel.jsx'

function CountdownButton({ onConfirm, sending, progress }) {
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
      onClick={onConfirm}
    >
      {sending ? (
        <><Loader size={14} className="animate-spin" />{progress || 'Sending…'}</>
      ) : seconds > 0 ? (
        <><Clock size={14} />Send in {seconds}…</>
      ) : (
        <><Send size={14} />Confirm and Send</>
      )}
    </button>
  )
}

function PreviewModal({ subject, body, selectedCourses, schedule, onConfirm, onCancel, sending, progress }) {
  return (
    <Modal
      title="Preview — Announcement"
      onClose={onCancel}
      size="sm"
      footer={<>
        <button className="btn-secondary" onClick={onCancel} disabled={sending}>Cancel</button>
        <CountdownButton onConfirm={onConfirm} sending={sending} progress={progress} />
      </>}
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Subject</p>
          <p className="text-sm font-medium text-gray-900">{subject}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Message</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">{body}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sending to</p>
          <ul className="text-sm text-gray-700 space-y-0.5">
            {selectedCourses.map(c => <li key={c.id}>{c.name}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Schedule</p>
          <p className="text-sm text-gray-700">
            {schedule ? `Scheduled for ${new Date(schedule).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Send immediately'}
          </p>
        </div>
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Announcements cannot be recalled once sent.</span>
        </div>
      </div>
    </Modal>
  )
}

function DraftsPanel({ drafts, onLoad, onDelete, onClose }) {
  return (
    <Modal title="Saved Drafts" onClose={onClose} size="sm">
      <div className="-mx-6 -my-4">
        {drafts.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">No saved drafts.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {drafts.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.subject || '(no subject)'}</p>
                  <p className="text-xs text-gray-400">Saved {new Date(d.savedAt).toLocaleDateString()}</p>
                </div>
                <button className="btn-secondary text-xs shrink-0" onClick={() => onLoad(d)}>Load</button>
                <button className="btn-ghost p-1.5 text-red-400 hover:text-red-600" onClick={() => onDelete(d.id)} aria-label="Delete draft">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function TemplatesPanel({ templates, onLoad, onDelete, onClose }) {
  return (
    <Modal title="Announcement Templates" onClose={onClose} size="sm">
      <div className="-mx-6 -my-4">
        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">No saved templates.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 truncate">{t.subject || '(no subject)'}</p>
                </div>
                <button className="btn-secondary text-xs shrink-0" onClick={() => onLoad(t)}>Use</button>
                <button className="btn-ghost p-1.5 text-red-400 hover:text-red-600" onClick={() => onDelete(t.id)} aria-label="Delete template">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function Announcements() {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]             = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [selectedCourseIds, setSelectedCourseIds] = useState(new Set())
  const [subject, setSubject]             = useState('')
  const [body, setBody]                   = useState('')
  const [scheduleMode, setScheduleMode]   = useState('now')  // 'now' | 'scheduled'
  const [scheduleDate, setScheduleDate]   = useState('')
  const [scheduleTime, setScheduleTime]   = useState('')
  const [showPreview, setShowPreview]     = useState(false)
  const [sending, setSending]             = useState(false)
  const [progress, setProgress]           = useState('')
  const [drafts, setDrafts]               = useState([])
  const [templates, setTemplates]         = useState([])
  const [showDrafts, setShowDrafts]       = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSentLog, setShowSentLog]     = useState(false)
  const [sentLog, setSentLog]             = useState([])
  const [activeDraftId, setActiveDraftId] = useState(null)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        setSelectedCourseIds(new Set(list.map(c => c.id)))
      })
      .finally(() => setLoadingCourses(false))
    getDrafts().then(setDrafts)
    getAnnouncementTemplates().then(setTemplates)
    getSentLog().then(setSentLog)
  }, [])

  function toggleCourse(id) {
    setSelectedCourseIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleAll() {
    setSelectedCourseIds(prev =>
      prev.size === courses.length ? new Set() : new Set(courses.map(c => c.id))
    )
  }

  const selectedCourses = courses.filter(c => selectedCourseIds.has(c.id))

  const scheduleIso = scheduleMode === 'scheduled' && scheduleDate && scheduleTime
    ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
    : null

  async function handleSend() {
    if (selectedCourses.length === 0 || !subject.trim() || !body.trim()) return

    const summary = `Sent announcement "${subject}" to ${selectedCourses.length} course${selectedCourses.length !== 1 ? 's' : ''}`
    await requirePin({ action: 'announcement', summary, courseId: null, courseName: null }, async () => {
      setSending(true)
      let done = 0
      for (const course of selectedCourses) {
        await createAnnouncement(course.id, { title: subject, message: body, delayed_post_at: scheduleIso })
        done++
        setProgress(`${done} of ${selectedCourses.length} sent…`)
      }

      await addSentLogEntry({
        type:           'announcement',
        assignmentName: null,
        courseId:       null,
        courseName:     selectedCourses.map(c => c.name).join(', '),
        recipientCount: selectedCourses.length,
        recipients:     selectedCourses.map(c => ({ id: c.id, name: c.name })),
        messageBody:    `Subject: ${subject}\n\n${body}`,
        meta:           { scheduleIso },
      })

      setSending(false)
      setProgress('')
      setShowPreview(false)
      setSubject('')
      setBody('')
      setActiveDraftId(null)
      toast(`Announcement sent to ${selectedCourses.length} course${selectedCourses.length !== 1 ? 's' : ''}`, 'success')
      getSentLog().then(setSentLog)
    })
  }

  async function handleSaveDraft() {
    const draft = { id: activeDraftId, subject, body, courseIds: [...selectedCourseIds], schedule: scheduleIso }
    await saveDraft(draft)
    const updated = await getDrafts()
    setDrafts(updated)
    if (!activeDraftId && updated.length > 0) setActiveDraftId(updated[0].id)
    toast('Draft saved', 'success')
  }

  function loadDraft(d) {
    setSubject(d.subject ?? '')
    setBody(d.body ?? '')
    if (d.courseIds) setSelectedCourseIds(new Set(d.courseIds))
    setActiveDraftId(d.id)
    setShowDrafts(false)
    toast('Draft loaded', 'success')
  }

  async function handleDeleteDraft(id) {
    await deleteDraft(id)
    const updated = await getDrafts()
    setDrafts(updated)
    if (activeDraftId === id) setActiveDraftId(null)
  }

  function loadTemplate(t) {
    setSubject(t.subject ?? '')
    setBody(t.body ?? '')
    setShowTemplates(false)
    toast('Template loaded', 'success')
  }

  async function handleSaveTemplate() {
    if (!saveTemplateName.trim()) return
    await saveAnnouncementTemplate({ name: saveTemplateName.trim(), subject, body })
    setTemplates(await getAnnouncementTemplates())
    setSaveTemplateName('')
    setShowSaveTemplate(false)
    toast('Template saved', 'success')
  }

  async function handleDeleteTemplate(id) {
    await deleteAnnouncementTemplate(id)
    setTemplates(await getAnnouncementTemplates())
  }

  const canSend = selectedCourses.length > 0 && subject.trim() && body.trim()

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">Write once, send to multiple courses. Supports scheduling and drafts.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="btn-secondary text-sm relative" onClick={() => { getDrafts().then(setDrafts); setShowDrafts(true) }}>
            Drafts {drafts.length > 0 && <span className="ml-1 text-xs text-gray-400">({drafts.length})</span>}
          </button>
          <button className="btn-secondary text-sm" onClick={() => setShowSentLog(true)}>
            Sent Log
          </button>
        </div>
      </div>

      {/* Course selection */}
      <div className="card overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Send to</p>
          {courses.length > 0 && (
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={toggleAll}>
              {selectedCourseIds.size === courses.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        {loadingCourses ? (
          <div className="flex items-center gap-2 py-6 px-4 text-gray-400 text-sm">
            <Loader size={14} className="animate-spin" /> Loading courses…
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {courses.map(c => (
              <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                <Checkbox checked={selectedCourseIds.has(c.id)} onChange={() => toggleCourse(c.id)} />
                <span className="text-sm text-gray-800">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="card p-5 mb-5 space-y-4">
        <div>
          <label className="label">Subject</label>
          <input
            type="text"
            className="input w-full text-sm mt-1"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Announcement subject…"
          />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea
            className="input w-full text-sm mt-1 resize-y"
            rows={8}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement here…"
          />
        </div>

        {/* Schedule */}
        <div>
          <p className="label mb-2">Schedule</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="scheduleMode" value="now" checked={scheduleMode === 'now'}
                onChange={() => setScheduleMode('now')} className="accent-[var(--cpt-color)]" />
              Send immediately
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="scheduleMode" value="scheduled" checked={scheduleMode === 'scheduled'}
                onChange={() => setScheduleMode('scheduled')} className="accent-[var(--cpt-color)]" />
              Schedule for
              <input
                type="date"
                className="input text-sm py-1 px-2"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                disabled={scheduleMode !== 'scheduled'}
              />
              <input
                type="time"
                className="input text-sm py-1 px-2"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                disabled={scheduleMode !== 'scheduled'}
              />
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm flex items-center gap-1.5"
              onClick={() => { getAnnouncementTemplates().then(setTemplates); setShowTemplates(true) }}
            >
              <BookTemplate size={14} /> Load Template
            </button>
            <button
              className="btn-secondary text-sm flex items-center gap-1.5"
              disabled={!subject.trim() && !body.trim()}
              onClick={() => setShowSaveTemplate(true)}
            >
              <Save size={14} /> Save as Template
            </button>
            <button
              className="btn-secondary text-sm flex items-center gap-1.5"
              disabled={!subject.trim() && !body.trim()}
              onClick={handleSaveDraft}
            >
              <FileText size={14} /> Save Draft
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              Sending to: {selectedCourses.length} course{selectedCourses.length !== 1 ? 's' : ''}
            </span>
            <button
              className="btn-primary flex items-center gap-1.5"
              disabled={!canSend}
              onClick={() => setShowPreview(true)}
            >
              <Send size={14} /> Preview & Send
            </button>
          </div>
        </div>
      </div>

      {showSaveTemplate && (
        <Modal
          title="Save as Template"
          onClose={() => setShowSaveTemplate(false)}
          size="sm"
          footer={<>
            <button className="btn-secondary" onClick={() => setShowSaveTemplate(false)}>Cancel</button>
            <button className="btn-primary" disabled={!saveTemplateName.trim()} onClick={handleSaveTemplate}>Save</button>
          </>}
        >
          <input
            type="text"
            className="input w-full text-sm"
            value={saveTemplateName}
            onChange={e => setSaveTemplateName(e.target.value)}
            placeholder="Template name…"
            onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
          />
        </Modal>
      )}

      {showPreview && (
        <PreviewModal
          subject={subject}
          body={body}
          selectedCourses={selectedCourses}
          schedule={scheduleIso}
          sending={sending}
          progress={progress}
          onConfirm={handleSend}
          onCancel={() => !sending && setShowPreview(false)}
        />
      )}

      {showDrafts && (
        <DraftsPanel
          drafts={drafts}
          onLoad={loadDraft}
          onDelete={handleDeleteDraft}
          onClose={() => setShowDrafts(false)}
        />
      )}

      {showTemplates && (
        <TemplatesPanel
          templates={templates}
          onLoad={loadTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showSentLog && (
        <SentLogPanel entries={sentLog} onClose={() => setShowSentLog(false)} />
      )}
    </div>
  )
}
