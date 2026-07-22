import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Loader, ExternalLink } from 'lucide-react'
import { Checkbox } from '../../components/FormControls.jsx'
import { useToast } from '../../components/Toast.jsx'
import { getCourses } from '../../api/courses.js'
import { saveTemplate } from '../../storage/templates.js'
import { getPreferences } from '../../storage/preferences.js'
import { deployTemplateToCourse } from './templateHelpers.js'
import { addAssignmentToModule } from '../../api/moduleItems.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import FieldLabel from '../../components/FieldLabel.jsx'
import Button from '../../components/Button.jsx'
import TextField from '../../components/TextField.jsx'

const EMPTY_DATES = { dueAt: '', unlockAt: '', lockAt: '' }

const PUBLISH_OPTIONS = [
  { value: 'unpublished', label: 'Unpublished' },
  { value: 'published',   label: 'Published' },
  { value: 'auto',        label: 'Auto (if due date set)' },
]

export default function DeployTemplate({ template, initialCourseId, moduleId, onDone, onBack }) {
  const toast = useToast()
  const { requirePin } = usePinGate()
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dates, setDates] = useState(EMPTY_DATES)
  const [individualDates, setIndividualDates] = useState(false)
  const [perCourseDates, setPerCourseDates] = useState({})
  const [perCourseGroups, setPerCourseGroups] = useState({})
  const [publishState, setPublishState] = useState('unpublished')
  const [deploying, setDeploying] = useState(false)
  const [results, setResults] = useState(null)

  const defaultGroup = template.fields?.assignmentGroup ?? ''

  function initCourseState(id) {
    setPerCourseGroups(prev => ({ ...prev, [id]: prev[id] ?? defaultGroup }))
    setPerCourseDates(prev => ({ ...prev, [id]: prev[id] ?? EMPTY_DATES }))
  }

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        if (initialCourseId) {
          const idStr = String(initialCourseId)
          if (list.find(c => c.id === idStr)) {
            setSelectedIds(new Set([idStr]))
            initCourseState(idStr)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false))
    getPreferences().then(p => setPublishState(p.templateDefaultPublishOnDeploy ?? 'unpublished'))
  }, [initialCourseId])

  function toggleCourse(id) {
    const isAdding = !selectedIds.has(id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    if (isAdding) initCourseState(id)
  }

  function toggleAll(checked) {
    if (checked) {
      const ids = courses.map(c => c.id)
      setSelectedIds(new Set(ids))
      ids.forEach(initCourseState)
    } else {
      setSelectedIds(new Set())
    }
  }

  function setSharedDate(key, value) {
    setDates(prev => ({ ...prev, [key]: value }))
  }

  function setCourseDate(courseId, key, value) {
    setPerCourseDates(prev => ({
      ...prev,
      [courseId]: { ...(prev[courseId] ?? EMPTY_DATES), [key]: value },
    }))
  }

  async function deploy() {
    const selected = courses.filter(c => selectedIds.has(c.id))
    const names = selected.map(c => c.name).join(', ')
    await requirePin(
      {
        action: 'template_deploy',
        summary: `Deployed template "${template.name}" to ${selected.length} course${selected.length !== 1 ? 's' : ''}: ${names}`,
        courseId: selected[0]?.id ?? null,
        courseName: names,
      },
      runDeploy,
    )
  }

  async function runDeploy() {
    const selected = courses.filter(c => selectedIds.has(c.id))
    setDeploying(true)

    const deployResults = await Promise.all(
      selected.map(course => {
        const courseDates = individualDates ? (perCourseDates[course.id] ?? EMPTY_DATES) : dates
        const groupOverride = perCourseGroups[course.id] ?? defaultGroup
        const courseTemplate = groupOverride !== defaultGroup
          ? { ...template, fields: { ...template.fields, assignmentGroup: groupOverride } }
          : template
        return deployTemplateToCourse(courseTemplate, course, courseDates, publishState)
      })
    )

    const moduleAddResults = {}
    if (moduleId) {
      const prefs = await getPreferences()
      if (prefs.autoAddToModule) {
        for (const r of deployResults) {
          if (r.success && r.courseId === String(initialCourseId)) {
            try {
              await addAssignmentToModule(r.courseId, moduleId, r.assignment.id)
              moduleAddResults[r.courseId] = 'added'
            } catch {
              moduleAddResults[r.courseId] = 'failed'
            }
          }
        }
      }
    }

    await saveTemplate({ ...template, lastUsed: new Date().toISOString() })
    setDeploying(false)
    setResults({ deployResults, moduleAddResults })
  }

  function openBulkEditor() {
    const path = initialCourseId
      ? `src/pages/bulk-editor/index.html?courseId=${initialCourseId}`
      : 'src/pages/bulk-editor/index.html'
    chrome.runtime.sendMessage({ type: 'OPEN_PAGE', path })
  }

  const allSelected = courses.length > 0 && courses.every(c => selectedIds.has(c.id))
  const selectedCourses = courses.filter(c => selectedIds.has(c.id))
  const resolvedPublished = publishState === 'published' ? true
    : publishState === 'unpublished' ? false
    : !!dates.dueAt

  // ── Results screen ─────────────────────────────────────────────────────────
  if (results) {
    const { deployResults, moduleAddResults } = results
    const succeeded = deployResults.filter(r => r.success)
    const failed = deployResults.filter(r => !r.success)

    return (
      <div>
        <PageHeader title="Assignments Created" back={{ label: 'Back to Library', to: onDone }} />

        <div className="card p-6 space-y-4">
          {succeeded.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-[var(--color-success)] font-medium mb-3">
                <CheckCircle size={16} aria-hidden="true" />
                Successfully created: {succeeded.length} assignment{succeeded.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-1.5">
                {succeeded.map(r => (
                  <div key={r.courseId} className="pl-6 text-sm text-[var(--color-text-body)]">
                    <span className="font-medium">{r.courseName}</span>
                    {r.warning && (
                      <p className="flex items-center gap-1 text-[var(--color-warning)] text-xs mt-0.5">
                        <AlertCircle size={12} aria-hidden="true" /> {r.warning}
                      </p>
                    )}
                    {moduleAddResults[r.courseId] === 'added' && (
                      <p className="flex items-center gap-1 text-[var(--color-success)] text-xs mt-0.5">
                        <CheckCircle size={12} aria-hidden="true" /> Added to module
                      </p>
                    )}
                    {moduleAddResults[r.courseId] === 'failed' && (
                      <p className="flex items-center gap-1 text-[var(--color-warning)] text-xs mt-0.5">
                        <AlertCircle size={12} aria-hidden="true" /> Assignment created but could not add to module — add it manually.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-[var(--color-danger)] font-medium mb-3">
                <AlertCircle size={16} aria-hidden="true" />
                Failed: {failed.length} course{failed.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-1.5">
                {failed.map(r => (
                  <div key={r.courseId} className="pl-6 text-sm">
                    <span className="font-medium text-[var(--color-text-body)]">{r.courseName}</span>
                    <span className="ml-2 text-[var(--color-danger)]">{r.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="ghost" onClick={openBulkEditor}>
            <ExternalLink size={14} aria-hidden="true" /> View in Bulk Editor
          </Button>
          <Button variant="primary" onClick={() => {
            const n = results.deployResults.filter(r => r.success).length
            if (n > 0) toast(`Deployed to ${n} course${n !== 1 ? 's' : ''}`, 'success')
            onDone()
          }}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  // ── Deploy form ────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title={`Deploy — ${template.fields?.name ?? template.name}`}
        back={{ label: 'Back to Library', to: onBack }}
        actions={
          <Button
            variant="primary"
            disabled={selectedIds.size === 0 || deploying}
            onClick={deploy}
          >
            {deploying
              ? <><Loader size={14} className="animate-spin" aria-hidden="true" /> Creating…</>
              : `Create Assignment${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        }
      >
        {template.fields?.points != null ? `${template.fields.points} pts` : 'Ungraded'}
        {defaultGroup ? ` · ${defaultGroup}` : ''}
      </PageHeader>

      {moduleId && (
        <p className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--cpt-color)' }}>
          <CheckCircle size={12} aria-hidden="true" /> Will be added to this module automatically after creation.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">

        {/* Left: course selection + group mapping */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-label">Courses</h3>
              <Button variant="ghost" size="sm" onClick={() => toggleAll(!allSelected)}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </Button>
            </div>

            {loadingCourses && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm py-2">
                <Loader size={14} className="animate-spin" aria-hidden="true" /> Loading courses…
              </div>
            )}

            <div className="space-y-1">
              {courses.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 cursor-pointer px-2 py-2 rounded hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
                  onClick={() => toggleCourse(c.id)}
                >
                  <Checkbox checked={selectedIds.has(c.id)} onChange={() => toggleCourse(c.id)} />
                  <span className="text-sm text-[var(--color-text-body)] min-w-0 truncate">
                    {c.name}
                    {c.term && <span className="text-[var(--color-text-muted)] ml-1.5 text-xs">{c.term}</span>}
                    {moduleId && Number(c.id) === Number(initialCourseId) && (
                      <span className="ml-2 text-xs font-medium" style={{ color: 'var(--cpt-color)' }}>→ module</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {selectedCourses.length > 0 && (
            <div className="card p-5 space-y-3">
              <div>
                <h3 className="section-label">Assignment Group</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Matched by name; created if missing.</p>
              </div>
              <div className="space-y-2">
                {selectedCourses.map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-sm text-[var(--color-text-secondary)] min-w-0 flex-1 truncate">{c.name}</span>
                    <div className="w-40 shrink-0">
                      <TextField
                        value={perCourseGroups[c.id] ?? defaultGroup}
                        onChange={v => setPerCourseGroups(prev => ({ ...prev, [c.id]: v }))}
                        placeholder="Group name"
                        aria-label={`Assignment group for ${c.name}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: dates + publish + preview */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-label">
                Dates <span className="normal-case font-normal text-[var(--color-text-muted)]">(optional)</span>
              </h3>
              <div
                className="flex items-center gap-2 text-sm text-[var(--color-text-body)] cursor-pointer"
                onClick={() => setIndividualDates(v => !v)}
              >
                <Checkbox checked={individualDates} onChange={() => setIndividualDates(v => !v)} />
                Per course
              </div>
            </div>

            {!individualDates ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <FieldLabel htmlFor="deploy-due">Due Date</FieldLabel>
                  <input id="deploy-due" type="date" value={dates.dueAt} onChange={e => setSharedDate('dueAt', e.target.value)} className="input text-sm" />
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="deploy-from">Available From</FieldLabel>
                  <input id="deploy-from" type="date" value={dates.unlockAt} onChange={e => setSharedDate('unlockAt', e.target.value)} className="input text-sm" />
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="deploy-until">Available Until</FieldLabel>
                  <input id="deploy-until" type="date" value={dates.lockAt} onChange={e => setSharedDate('lockAt', e.target.value)} className="input text-sm" />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {selectedCourses.length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)]">Select courses to set dates per course.</p>
                )}
                {selectedCourses.map(c => {
                  const cd = perCourseDates[c.id] ?? EMPTY_DATES
                  return (
                    <div key={c.id}>
                      <p className="text-sm font-medium text-[var(--color-text-body)] mb-2 truncate">{c.name}</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <FieldLabel>Due</FieldLabel>
                          <input type="date" value={cd.dueAt} onChange={e => setCourseDate(c.id, 'dueAt', e.target.value)} className="input text-sm" />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel>From</FieldLabel>
                          <input type="date" value={cd.unlockAt} onChange={e => setCourseDate(c.id, 'unlockAt', e.target.value)} className="input text-sm" />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel>Until</FieldLabel>
                          <input type="date" value={cd.lockAt} onChange={e => setCourseDate(c.id, 'lockAt', e.target.value)} className="input text-sm" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <FieldLabel>Publish</FieldLabel>
            <div className="flex items-center gap-1.5">
              {PUBLISH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPublishState(opt.value)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-75 ${
                    publishState === opt.value
                      ? 'text-white'
                      : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                  }`}
                  style={publishState === opt.value ? { backgroundColor: 'var(--cpt-color)' } : undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div
              className="rounded-md p-4 text-sm"
              style={{
                backgroundColor: 'rgba(var(--cpt-color-rgb), 0.07)',
                border: '1px solid rgba(var(--cpt-color-rgb), 0.18)',
              }}
            >
              <p className="font-medium text-[var(--color-text-body)] mb-1">
                Creating "{template.fields?.name}" in {selectedIds.size} course{selectedIds.size !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {template.fields?.points != null ? `${template.fields.points} pts` : 'Ungraded'}
                {' · '}Status: {resolvedPublished ? 'Published' : 'Unpublished'}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
