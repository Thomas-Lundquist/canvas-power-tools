import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Loader, ExternalLink } from 'lucide-react'
import { Checkbox } from '../../components/FormControls.jsx'
import { useToast } from '../../components/Toast.jsx'
import { getCourses } from '../../api/courses.js'
import { saveTemplate } from '../../storage/templates.js'
import { getPreferences } from '../../storage/preferences.js'
import { deployTemplateToCourse } from './templateHelpers.js'
import { addAssignmentToModule } from '../../api/moduleItems.js'

export default function DeployTemplate({ template, initialCourseId, moduleId, onDone, onBack }) {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dates, setDates] = useState({ dueAt: '', unlockAt: '', lockAt: '' })
  const [publishState, setPublishState] = useState('unpublished')
  const [deploying, setDeploying] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        // Pre-select the course that launched this deploy flow (e.g. from a module button)
        if (initialCourseId) {
          const idStr = String(initialCourseId)
          if (list.find(c => c.id === idStr)) {
            setSelectedIds(new Set([idStr]))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false))
    getPreferences().then(p => setPublishState(p.templateDefaultPublishOnDeploy ?? 'unpublished'))
  }, [initialCourseId])

  function toggleCourse(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(checked) {
    setSelectedIds(checked ? new Set(courses.map(c => c.id)) : new Set())
  }

  function setDate(key, value) {
    setDates(prev => ({ ...prev, [key]: value }))
  }

  async function deploy() {
    setDeploying(true)
    const selected = courses.filter(c => selectedIds.has(c.id))
    const deployResults = await Promise.all(
      selected.map(course => deployTemplateToCourse(template, course, dates, publishState))
    )

    // Auto-add to module if launched from a module button and pref is enabled
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
  const resolvedPublished = publishState === 'published' ? true : publishState === 'unpublished' ? false : !!dates.dueAt

  if (results) {
    const { deployResults, moduleAddResults } = results
    const succeeded = deployResults.filter(r => r.success)
    const failed = deployResults.filter(r => !r.success)

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Assignments Created</h2>

        <div className="card p-6 space-y-4">
          {succeeded.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-green-700 font-medium mb-3">
                <CheckCircle size={16} />
                Successfully created: {succeeded.length} assignment{succeeded.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-1.5">
                {succeeded.map(r => (
                  <div key={r.courseId} className="pl-6 text-sm text-gray-700">
                    <span className="font-medium">{r.courseName}</span>
                    {r.warning && (
                      <div className="flex items-center gap-1 text-yellow-600 text-xs mt-0.5">
                        <AlertCircle size={12} /> {r.warning}
                      </div>
                    )}
                    {moduleAddResults[r.courseId] === 'added' && (
                      <div className="flex items-center gap-1 text-green-600 text-xs mt-0.5">
                        <CheckCircle size={12} /> Added to module
                      </div>
                    )}
                    {moduleAddResults[r.courseId] === 'failed' && (
                      <div className="flex items-center gap-1 text-yellow-600 text-xs mt-0.5">
                        <AlertCircle size={12} /> Assignment created but could not add to module — add it manually.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-red-700 font-medium mb-3">
                <AlertCircle size={16} />
                Failed: {failed.length} course{failed.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-1.5">
                {failed.map(r => (
                  <div key={r.courseId} className="pl-6 text-sm text-gray-700">
                    <span className="font-medium">{r.courseName}</span>
                    <span className="ml-2 text-red-600">{r.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button className="btn-secondary flex items-center gap-1.5" onClick={openBulkEditor}>
            <ExternalLink size={14} /> View in Bulk Editor
          </button>
          <button className="btn-primary" onClick={() => {
            const succeeded = results.deployResults.filter(r => r.success).length
            if (succeeded > 0) toast(`Deployed to ${succeeded} course${succeeded !== 1 ? 's' : ''}`, 'success')
            onDone()
          }}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Deploy Template</h2>
        <p className="text-sm text-gray-500 mt-1">
          Creating <span className="font-medium text-gray-700">"{template.fields.name}"</span>
          {' '}— {template.fields.points != null ? `${template.fields.points} pts` : 'ungraded'}
          {template.fields.assignmentGroup ? ` · ${template.fields.assignmentGroup}` : ''}
        </p>
        {moduleId && (
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--cpt-color)' }}>
            <CheckCircle size={12} /> Will be added to this module automatically after creation.
          </p>
        )}
      </div>

      {/* Course selection */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Select courses</h3>
          <button className="text-xs font-medium" style={{ color: 'var(--cpt-color)' }} onClick={() => toggleAll(!allSelected)}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        {loadingCourses && (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
            <Loader size={14} className="animate-spin" /> Loading courses...
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {courses.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50"
              onClick={() => toggleCourse(c.id)}
            >
              <Checkbox checked={selectedIds.has(c.id)} onChange={() => toggleCourse(c.id)} />
              <span className="text-sm text-gray-800">
                {c.name}
                {c.term && <span className="text-gray-400 ml-1.5 text-xs">{c.term}</span>}
                {moduleId && Number(c.id) === Number(initialCourseId) && (
                  <span className="ml-2 text-xs font-medium" style={{ color: 'var(--cpt-color)' }}>→ module</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Set Dates <span className="font-normal text-gray-400">(optional)</span></h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Due Date</label>
            <input type="date" value={dates.dueAt} onChange={e => setDate('dueAt', e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="label">Available From</label>
            <input type="date" value={dates.unlockAt} onChange={e => setDate('unlockAt', e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="label">Available Until</label>
            <input type="date" value={dates.lockAt} onChange={e => setDate('lockAt', e.target.value)} className="input text-sm" />
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <label className="label mb-1.5">Publish state</label>
          <div className="flex items-center gap-1.5">
            {[
              { value: 'unpublished', label: 'Unpublished' },
              { value: 'published',   label: 'Published' },
              { value: 'auto',        label: 'Auto (if due date set)' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPublishState(opt.value)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  publishState === opt.value ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={publishState === opt.value ? { backgroundColor: 'var(--cpt-color)' } : undefined}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      {selectedIds.size > 0 && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{
            backgroundColor: 'rgba(var(--cpt-color-rgb), 0.07)',
            border: '1px solid rgba(var(--cpt-color-rgb), 0.18)',
            color: '#374151',
          }}
        >
          <p className="font-medium mb-1">
            Creating "{template.fields.name}" in {selectedIds.size} course{selectedIds.size !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-500">
            {template.fields.points != null ? `${template.fields.points} pts` : 'Ungraded'}
            {template.fields.assignmentGroup ? ` · Group: ${template.fields.assignmentGroup}` : ''}
            {' · '}Status: {resolvedPublished ? 'Published' : 'Unpublished'}
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <button
          className="btn-primary"
          disabled={selectedIds.size === 0 || deploying}
          onClick={deploy}
        >
          {deploying
            ? <><Loader size={14} className="animate-spin" /> Creating...</>
            : `Create Assignment${selectedIds.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
