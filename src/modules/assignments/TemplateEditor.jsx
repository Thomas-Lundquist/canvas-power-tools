import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { AlertCircle } from 'lucide-react'
import { Checkbox } from '../../components/FormControls.jsx'
import { getAssignmentGroups } from '../../api/assignmentGroups.js'
import { getPreferences } from '../../storage/preferences.js'
import { saveTemplate } from '../../storage/templates.js'
import { validateTemplate, buildTemplateObject, templateToFormFields } from './templateHelpers.js'
import PageHeader from '../../components/PageHeader.jsx'
import FieldLabel from '../../components/FieldLabel.jsx'
import TextField from '../../components/TextField.jsx'
import Select from '../../components/Select.jsx'
import NumberField from '../../components/NumberField.jsx'
import Button from '../../components/Button.jsx'

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

const FOLDER_PLACEHOLDER = { value: '', label: 'Unfiled' }
const GROUP_NONE = { value: '', label: '— None —' }

export default function TemplateEditor({
  template, folders, initialFolderId, initialFormOverride,
  sourceAssignmentId, onSave, onCancel,
}) {
  const [form, setForm] = useState(() => {
    if (template) return templateToFormFields(template)
    if (initialFormOverride) return { ...initialFormOverride, folderId: initialFolderId ?? null }
    return { ...EMPTY_FORM, folderId: initialFolderId ?? null }
  })
  const [errors, setErrors] = useState({})
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingHtml, setEditingHtml] = useState(false)

  useEffect(() => {
    async function loadGroups() {
      try {
        const prefs = await getPreferences()
        if (prefs.lastUsedCourseId) {
          const g = await getAssignmentGroups(prefs.lastUsedCourseId)
          setGroups(g)
        }
      } catch {
        // Groups are optional — user can type a name manually
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
  const folderOptions = [FOLDER_PLACEHOLDER, ...folders.map(f => ({ value: f.id, label: f.name }))]
  const groupOptions = groups.length > 0
    ? [GROUP_NONE, ...groups.map(g => ({ value: g.name, label: g.name }))]
    : null

  return (
    <div>
      <PageHeader
        title={isEditing ? `Edit — ${template.name}` : 'New Template'}
        back={{ label: 'Back to Library', to: onCancel }}
        actions={
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Template'}
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] divide-x divide-[var(--color-border)]">

          {/* Left panel — template settings */}
          <div className="p-6 space-y-5">
            <h3 className="section-label">Template</h3>

            <div className="space-y-1">
              <FieldLabel htmlFor="tpl-name" required>Name</FieldLabel>
              <TextField
                id="tpl-name"
                value={form.templateName}
                onChange={v => set('templateName', v)}
                placeholder="e.g. Weekly Quiz"
                className={errors.templateName ? 'border-[var(--color-danger)]' : ''}
                autoFocus
              />
              {errors.templateName && <FieldError msg={errors.templateName} />}
            </div>

            <div className="space-y-1">
              <FieldLabel htmlFor="tpl-folder">Folder</FieldLabel>
              <Select
                id="tpl-folder"
                value={form.folderId ?? ''}
                onChange={v => set('folderId', v || null)}
                options={folderOptions}
              />
            </div>

            <hr className="border-[var(--color-border)]" />

            <div className="rounded p-3 text-xs text-[var(--color-text-secondary)] space-y-1" style={{ backgroundColor: 'var(--color-bg-page)' }}>
              <p className="font-medium text-[var(--color-text-body)]">Saved with this template</p>
              <p>Name · Instructions · Points · Submission type · Allowed formats · Assignment group · Grading type · Peer review</p>
              <p className="text-[var(--color-text-muted)] mt-1">Dates are set at deploy time.</p>
            </div>
          </div>

          {/* Right panel — assignment fields */}
          <div className="p-6 space-y-5">
            <h3 className="section-label">Assignment Fields</h3>

            <div className="space-y-1">
              <FieldLabel htmlFor="tpl-asgn-name" required>Assignment Name</FieldLabel>
              <TextField
                id="tpl-asgn-name"
                value={form.name}
                onChange={v => set('name', v)}
                placeholder="e.g. Weekly Quiz — Week ___"
                className={errors.name ? 'border-[var(--color-danger)]' : ''}
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                Becomes the assignment name when deployed. Edit per use.
              </p>
              {errors.name && <FieldError msg={errors.name} />}
            </div>

            <div className="space-y-1">
              <FieldLabel htmlFor="tpl-instructions">Instructions</FieldLabel>
              {editingHtml ? (
                <textarea
                  id="tpl-instructions"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  rows={8}
                  className="input resize-y font-mono text-xs w-full"
                />
              ) : (
                <div
                  id="tpl-instructions"
                  className="input min-h-[8rem] prose prose-sm max-w-none overflow-auto text-[var(--color-text-body)]"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.description || '') }}
                  aria-label="Instructions preview (read-only)"
                />
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] transition-colors duration-75"
                  onClick={() => setEditingHtml(v => !v)}
                >
                  {editingHtml ? 'Show preview' : 'Edit HTML source'}
                </button>
                {!form.description && !editingHtml && (
                  <span className="text-xs text-[var(--color-text-muted)]">No instructions yet.</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <FieldLabel htmlFor="tpl-points">Points</FieldLabel>
                <NumberField
                  id="tpl-points"
                  value={form.points}
                  onChange={v => set('points', v)}
                  min={0}
                  placeholder="e.g. 20"
                  className={errors.points ? 'border-[var(--color-danger)]' : ''}
                />
                {errors.points && <FieldError msg={errors.points} />}
              </div>

              <div className="space-y-1">
                <FieldLabel htmlFor="tpl-group">Assignment Group</FieldLabel>
                {groupOptions ? (
                  <Select
                    id="tpl-group"
                    value={form.assignmentGroup}
                    onChange={v => set('assignmentGroup', v)}
                    options={groupOptions}
                  />
                ) : (
                  <TextField
                    id="tpl-group"
                    value={form.assignmentGroup}
                    onChange={v => set('assignmentGroup', v)}
                    placeholder="e.g. Quizzes"
                  />
                )}
                <p className="text-xs text-[var(--color-text-muted)]">Matched by name at deploy time.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <FieldLabel htmlFor="tpl-grading">Grading Type</FieldLabel>
                <Select
                  id="tpl-grading"
                  value={form.gradingType}
                  onChange={v => set('gradingType', v)}
                  options={GRADING_TYPES}
                />
              </div>

              <div className="space-y-1">
                <FieldLabel htmlFor="tpl-submission">Submission Type</FieldLabel>
                <Select
                  id="tpl-submission"
                  value={form.submissionType}
                  onChange={v => set('submissionType', v)}
                  options={SUBMISSION_TYPES}
                />
              </div>
            </div>

            {form.submissionType === 'online' && (
              <div className="space-y-2">
                <FieldLabel>Allowed Formats</FieldLabel>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {ONLINE_FORMATS.map(f => (
                    <div
                      key={f.value}
                      className="flex items-center gap-2 text-sm text-[var(--color-text-body)] cursor-pointer"
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
              className="flex items-center gap-2 text-sm text-[var(--color-text-body)] cursor-pointer"
              onClick={() => set('peerReview', !form.peerReview)}
            >
              <Checkbox checked={form.peerReview} onChange={v => set('peerReview', v)} />
              Enable peer review for this assignment
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function FieldError({ msg }) {
  return (
    <p className="mt-1 text-xs text-[var(--color-danger)] flex items-center gap-1">
      <AlertCircle size={12} aria-hidden="true" /> {msg}
    </p>
  )
}
