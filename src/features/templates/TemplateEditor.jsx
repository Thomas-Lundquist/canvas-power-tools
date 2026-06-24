import { useState, useEffect } from 'react'
import { ChevronDown, Plus, AlertCircle } from 'lucide-react'
import { Checkbox } from '../../components/FormControls.jsx'
import { getAssignmentGroups } from '../../api/assignmentGroups.js'
import { getPreferences } from '../../storage/preferences.js'
import { saveTemplate } from '../../storage/templates.js'
import { validateTemplate, buildTemplateObject, templateToFormFields } from './templateHelpers.js'

const GRADING_TYPES = [
  { value: 'points', label: 'Points' },
  { value: 'percent', label: 'Percentage' },
  { value: 'letter_grade', label: 'Letter Grade' },
  { value: 'gpa_scale', label: 'GPA Scale' },
  { value: 'pass_fail', label: 'Complete / Incomplete' },
  { value: 'not_graded', label: 'Not Graded' },
]

const SUBMISSION_TYPES = [
  { value: 'online', label: 'Online' },
  { value: 'on_paper', label: 'On Paper' },
  { value: 'no_submission', label: 'No Submission' },
  { value: 'external_tool', label: 'External Tool' },
]

const ONLINE_FORMATS = [
  { value: 'online_text_entry', label: 'Text Entry' },
  { value: 'online_upload', label: 'File Upload' },
  { value: 'online_url', label: 'URL' },
  { value: 'media_recording', label: 'Media Recording' },
]

const EMPTY_FORM = {
  templateName: '',
  folderId: null,
  name: '',
  description: '',
  points: '',
  submissionType: 'online',
  allowedFormats: ['online_upload'],
  assignmentGroup: '',
  gradingType: 'points',
  peerReview: false,
}

export default function TemplateEditor({ template, folders, initialFolderId, initialFormOverride, sourceAssignmentId, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (template) return templateToFormFields(template)
    if (initialFormOverride) return { ...initialFormOverride, folderId: initialFolderId ?? null }
    return { ...EMPTY_FORM, folderId: initialFolderId ?? null }
  })
  const [errors, setErrors] = useState({})
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadGroups() {
      try {
        const prefs = await getPreferences()
        if (prefs.lastUsedCourseId) {
          const g = await getAssignmentGroups(prefs.lastUsedCourseId)
          setGroups(g)
        }
      } catch {
        // Groups are optional — the user can type a name manually
      }
    }
    loadGroups()
  }, [])

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  function toggleFormat(value) {
    set('allowedFormats', form.allowedFormats.includes(value)
      ? form.allowedFormats.filter(f => f !== value)
      : [...form.allowedFormats, value]
    )
  }

  async function handleSave() {
    const errs = validateTemplate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    const obj = buildTemplateObject({
      templateName: form.templateName,
      folderId: form.folderId,
      fields: form,
      sourceAssignmentId: template?.sourceAssignmentId ?? sourceAssignmentId ?? null,
      existingId: template?.id ?? null,
    })
    if (template) {
      obj.createdAt = template.createdAt
      obj.lastUsed = template.lastUsed
    }
    await saveTemplate(obj)
    setSaving(false)
    onSave(obj)
  }

  const isEditing = !!template

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{isEditing ? `Edit Template — ${template.name}` : 'New Template'}</h2>
      </div>

      <div className="card p-6 space-y-6">
        {/* Template metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Template Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.templateName}
              onChange={e => set('templateName', e.target.value)}
              placeholder="e.g. Weekly Quiz"
              className={`input ${errors.templateName ? 'border-red-400 focus:ring-red-500' : ''}`}
              autoFocus
            />
            {errors.templateName && <FieldError msg={errors.templateName} />}
          </div>

          <div>
            <label className="label">Folder</label>
            <div className="relative">
              <select
                value={form.folderId ?? ''}
                onChange={e => set('folderId', e.target.value || null)}
                className="input appearance-none pr-8"
              >
                <option value="">Unfiled</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Assignment fields */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Assignment Fields</h3>

          <div>
            <label className="label">Assignment Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Weekly Quiz — Week ___"
              className={`input ${errors.name ? 'border-red-400' : ''}`}
            />
            <p className="mt-1 text-xs text-gray-400">This becomes the assignment name when deployed. Edit per use.</p>
            {errors.name && <FieldError msg={errors.name} />}
          </div>

          <div>
            <label className="label">Instructions</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Assignment instructions..."
              rows={4}
              className="input resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Points</label>
              <input
                type="number"
                min="0"
                value={form.points}
                onChange={e => set('points', e.target.value)}
                placeholder="e.g. 20"
                className={`input ${errors.points ? 'border-red-400' : ''}`}
              />
              {errors.points && <FieldError msg={errors.points} />}
            </div>

            <div>
              <label className="label">Assignment Group</label>
              {groups.length > 0 ? (
                <div className="relative">
                  <select
                    value={form.assignmentGroup}
                    onChange={e => set('assignmentGroup', e.target.value)}
                    className="input appearance-none pr-8"
                  >
                    <option value="">— None —</option>
                    {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              ) : (
                <input
                  type="text"
                  value={form.assignmentGroup}
                  onChange={e => set('assignmentGroup', e.target.value)}
                  placeholder="e.g. Quizzes"
                  className="input"
                />
              )}
              <p className="mt-1 text-xs text-gray-400">Matched by name at deploy time.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Grading Type</label>
              <div className="relative">
                <select value={form.gradingType} onChange={e => set('gradingType', e.target.value)} className="input appearance-none pr-8">
                  {GRADING_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label">Submission Type</label>
              <div className="relative">
                <select value={form.submissionType} onChange={e => set('submissionType', e.target.value)} className="input appearance-none pr-8">
                  {SUBMISSION_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {form.submissionType === 'online' && (
            <div>
              <label className="label">Allowed Formats</label>
              <div className="flex flex-wrap gap-3">
                {ONLINE_FORMATS.map(f => (
                  <div
                    key={f.value}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    onClick={() => toggleFormat(f.value)}
                  >
                    <Checkbox
                      checked={form.allowedFormats.includes(f.value)}
                      onChange={() => toggleFormat(f.value)}
                    />
                    {f.label}
                  </div>
                ))}
              </div>
              {errors.allowedFormats && <FieldError msg={errors.allowedFormats} />}
            </div>
          )}

          <div
            className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            onClick={() => set('peerReview', !form.peerReview)}
          >
            <Checkbox checked={form.peerReview} onChange={v => set('peerReview', v)} />
            Enable peer review for this assignment
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600">Fields saved in this template:</p>
          <p>Name, Instructions, Points, Submission Type, Allowed Formats, Assignment Group, Grading Type, Peer Review</p>
          <p className="text-gray-400">Not saved: Due Date, Available From, Available Until (set these at deploy time)</p>
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}

function FieldError({ msg }) {
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle size={12} /> {msg}
    </p>
  )
}
