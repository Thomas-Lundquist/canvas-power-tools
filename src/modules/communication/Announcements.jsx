import { useState, useEffect, useRef } from 'react'
import { Loader, AlertTriangle, Send, BookTemplate, Save, FileText, Trash2, Clock, Info, Bold, Italic, Link as LinkIcon, List, Eye } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import Button from '../../components/Button.jsx'
import IconButton from '../../components/IconButton.jsx'
import NotchBadge from '../../components/NotchBadge.jsx'
import { getCourses } from '../../api/courses.js'
import { createAnnouncement } from '../../api/discussions.js'
import { getDrafts, saveDraft, deleteDraft, getAnnouncementTemplates, saveAnnouncementTemplate, deleteAnnouncementTemplate } from '../../storage/announcements.js'
import { addSentLogEntry, getSentLog } from '../../storage/sentLog.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'
import SentLogPanel from './SentLogPanel.jsx'

// Basic formatting toolbar. Wraps the textarea selection in HTML tags, which is
// what Canvas's announcement message field renders — so every button does real
// work and carries an accessible name.
function FormatToolbar({ textareaRef, value, onChange }) {
  function wrap(before, after) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = start + before.length
      el.selectionEnd = end + before.length
    })
  }

  const tools = [
    { icon: Bold, label: 'Bold', run: () => wrap('<strong>', '</strong>') },
    { icon: Italic, label: 'Italic', run: () => wrap('<em>', '</em>') },
    { icon: LinkIcon, label: 'Insert link', run: () => wrap('<a href="">', '</a>') },
    { icon: List, label: 'Bulleted list', run: () => wrap('<ul>\n  <li>', '</li>\n</ul>') },
  ]

  return (
    <div className="flex items-center gap-1 rounded-t-[var(--radius-card)] border border-b-0 border-[var(--color-border)] bg-[var(--color-bg-hover)] px-2 py-1.5">
      {tools.map(t => (
        <button
          key={t.label}
          type="button"
          onClick={t.run}
          aria-label={t.label}
          className="rounded-[var(--radius-sm)] border border-transparent p-1 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-body)]"
        >
          <t.icon size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

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
      className="btn-primary flex min-w-[10rem] items-center justify-center gap-2"
      disabled={!ready}
      onClick={onConfirm}
    >
      {sending ? (
        <><Loader size={14} className="animate-spin" aria-hidden="true" />{progress || 'Sending…'}</>
      ) : seconds > 0 ? (
        <><Clock size={14} aria-hidden="true" />Send in {seconds}…</>
      ) : (
        <><Send size={14} aria-hidden="true" />Confirm and Send</>
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
        <Button variant="secondary" onClick={onCancel} disabled={sending}>Cancel</Button>
        <CountdownButton onConfirm={onConfirm} sending={sending} progress={progress} />
      </>}
    >
      <div className="space-y-4">
        <div>
          <p className="section-label !mb-1">Subject</p>
          <p className="text-sm font-medium text-[var(--color-text-body)]">{subject}</p>
        </div>
        <div>
          <p className="section-label !mb-1">Message</p>
          <p className="whitespace-pre-wrap rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-3 text-sm text-[var(--color-text-body)]">{body}</p>
        </div>
        <div>
          <p className="section-label !mb-1">Sending to</p>
          <ul className="space-y-0.5 text-sm text-[var(--color-text-secondary)]">
            {selectedCourses.map(c => <li key={c.id}>{c.name}</li>)}
          </ul>
        </div>
        <div>
          <p className="section-label !mb-1">Schedule</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {schedule ? `Scheduled for ${new Date(schedule).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Send immediately'}
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-warning)_32%,var(--color-bg-surface))] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-bg-surface))] p-3 text-xs text-[var(--color-warning)]" role="alert">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
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
          <p className="py-10 text-center text-sm text-[var(--color-text-disabled)]">No saved drafts.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {drafts.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text-body)]">{d.subject || '(no subject)'}</p>
                  <p className="text-xs text-[var(--color-text-disabled)]">Saved {new Date(d.savedAt).toLocaleDateString()}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onLoad(d)}>Load</Button>
                <IconButton icon={Trash2} label="Delete draft" variant="danger" size="sm" onClick={() => onDelete(d.id)} />
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
          <p className="py-10 text-center text-sm text-[var(--color-text-disabled)]">No saved templates.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text-body)]">{t.name}</p>
                  <p className="truncate text-xs text-[var(--color-text-disabled)]">{t.subject || '(no subject)'}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onLoad(t)}>Use</Button>
                <IconButton icon={Trash2} label="Delete template" variant="danger" size="sm" onClick={() => onDelete(t.id)} />
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

  const bodyRef = useRef(null)

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
  const allSelected = courses.length > 0 && selectedCourseIds.size === courses.length

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-body)]">Announcements</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Write once, send to multiple courses. Supports scheduling and drafts.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { getDrafts().then(setDrafts); setShowDrafts(true) }}>
            Drafts{drafts.length > 0 && ` (${drafts.length})`}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowSentLog(true)}>Sent Log</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: recipient selection + notice */}
        <div className="space-y-4 lg:col-span-4">
          <div className="card relative p-4 pt-5">
            <NotchBadge>Recipients</NotchBadge>
            <div className="mb-3 flex items-center justify-between">
              <p className="section-label !mb-0">Send to</p>
              {courses.length > 0 && (
                <button
                  className="text-xs text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
                  onClick={toggleAll}
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            {loadingCourses ? (
              <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-text-disabled)]">
                <Loader size={14} className="animate-spin" aria-hidden="true" /> Loading courses…
              </div>
            ) : (
              <div className="-mx-1 max-h-64 divide-y divide-[var(--color-border-subtle)] overflow-y-auto">
                {courses.map(c => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-1 py-2.5 hover:bg-[var(--color-bg-hover)]">
                    <Checkbox checked={selectedCourseIds.has(c.id)} onChange={() => toggleCourse(c.id)} />
                    <span className="text-sm text-[var(--color-text-body)]">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div
            className="flex items-start gap-3 rounded-[var(--radius-card)] border p-4"
            style={{
              borderColor: 'var(--color-domain-communication)',
              backgroundColor: 'color-mix(in srgb, var(--color-domain-communication) 8%, var(--color-bg-surface))',
            }}
          >
            <Info size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-domain-communication)' }} aria-hidden="true" />
            <div>
              <h2 className="text-xs font-bold" style={{ color: 'var(--color-domain-communication)' }}>Before you send</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                Announcements email every enrolled student immediately unless you schedule them. They cannot be recalled once sent.
              </p>
            </div>
          </div>
        </div>

        {/* Right column: compose */}
        <div className="card relative space-y-5 p-5 pt-6 lg:col-span-8">
          <NotchBadge>Compose</NotchBadge>

          <div>
            <label className="section-label" htmlFor="ann-subject">Subject line</label>
            <input
              id="ann-subject"
              type="text"
              className="input w-full text-sm"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Midterm review session rescheduled"
            />
          </div>

          <div>
            <label className="section-label" htmlFor="ann-body">Message body</label>
            <FormatToolbar textareaRef={bodyRef} value={body} onChange={setBody} />
            <textarea
              id="ann-body"
              ref={bodyRef}
              className="input w-full resize-y rounded-t-none text-sm"
              rows={8}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your announcement here…"
            />
          </div>

          {/* Delivery schedule sub-panel */}
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4">
            <p className="section-label">Delivery schedule</p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input type="radio" name="scheduleMode" value="now" checked={scheduleMode === 'now'}
                  onChange={() => setScheduleMode('now')} className="accent-[var(--cpt-color)]" />
                Send immediately
              </label>
              <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input type="radio" name="scheduleMode" value="scheduled" checked={scheduleMode === 'scheduled'}
                  onChange={() => setScheduleMode('scheduled')} className="accent-[var(--cpt-color)]" />
                Schedule for
                <input
                  type="date"
                  className="input px-2 py-1 text-sm"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  disabled={scheduleMode !== 'scheduled'}
                  aria-label="Schedule date"
                />
                <input
                  type="time"
                  className="input px-2 py-1 text-sm"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  disabled={scheduleMode !== 'scheduled'}
                  aria-label="Schedule time"
                />
              </label>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" icon={BookTemplate}
                onClick={() => { getAnnouncementTemplates().then(setTemplates); setShowTemplates(true) }}>
                Load Template
              </Button>
              <Button variant="secondary" size="sm" icon={Save}
                disabled={!subject.trim() && !body.trim()}
                onClick={() => setShowSaveTemplate(true)}>
                Save as Template
              </Button>
              <Button variant="secondary" size="sm" icon={FileText}
                disabled={!subject.trim() && !body.trim()}
                onClick={handleSaveDraft}>
                Save Draft
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-disabled)]">
                {selectedCourses.length} course{selectedCourses.length !== 1 ? 's' : ''}
              </span>
              <Button variant="primary" icon={Eye} disabled={!canSend} onClick={() => setShowPreview(true)}>
                Preview &amp; Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showSaveTemplate && (
        <Modal
          title="Save as Template"
          onClose={() => setShowSaveTemplate(false)}
          size="sm"
          footer={<>
            <Button variant="secondary" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button variant="primary" disabled={!saveTemplateName.trim()} onClick={handleSaveTemplate}>Save</Button>
          </>}
        >
          <input
            type="text"
            className="input w-full text-sm"
            value={saveTemplateName}
            onChange={e => setSaveTemplateName(e.target.value)}
            placeholder="Template name…"
            aria-label="Template name"
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
