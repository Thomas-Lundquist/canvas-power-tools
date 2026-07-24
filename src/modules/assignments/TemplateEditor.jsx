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
import SegmentedToggle from '../../components/SegmentedToggle.jsx'
import Callout from '../../components/Callout.jsx'

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

const TYPE_OPTIONS = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'page', label: 'Page' },
]

const PUBLISH_DEFAULT_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'published', label: 'Published' },
  { value: 'unpublished', label: 'Unpublished' },
]

const EMPTY_FORM = {
  type: 'assignment',
  templateName: '',
  folderId: null,
  publishDefault: 'auto',
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

// A bordered, tinted grouping box — the recurring "settings bar" treatment
// the mockup uses for the type/name/folder row and the submission/peer-review
// row. Kept local since it's only ever this field-grouping shape.
function SettingsBar({ className = '', children }) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-[var(--color-border)] p-4 ${className}`}
      style={{ backgroundColor: 'var(--color-bg-page)' }}
    >
      {children}
    </div>
  )
}

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
      publishDefault: form.publishDefault,
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
  const isPage = form.type === 'page'
  const folderOptions = [FOLDER_PLACEHOLDER, ...folders.map(f => ({ value: f.id, label: f.name }))]
  const groupSuggestions = [...new Set(groups.map(g => g.name))]

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

      <div className="card domain-accent overflow-hidden" style={{ '--domain-color': 'var(--color-domain-assignments)' }}>
        <div className="p-6 space-y-6">

          {/* Type / Name / Folder */}
          <SettingsBar className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <FieldLabel>Type</FieldLabel>
              <SegmentedToggle ariaLabel="Template type" options={TYPE_OPTIONS} value={form.type} onChange={v => set('type', v)} />
            </div>

            <div className="space-y-1">
              <FieldLabel htmlFor="tpl-name" required>Library Template Name</FieldLabel>
              <TextField
                id="tpl-name"
                value={form.templateName}
                onChange={v => set('templateName', v)}
                placeholder="e.g. Weekly Quiz Template"
                className={errors.templateName ? 'border-[var(--color-danger)]' : ''}
                autoFocus
              />
              {errors.templateName && <FieldError msg={errors.templateName} />}
            </div>

            <div className="space-y-1">
              <FieldLabel htmlFor="tpl-folder">Folder</FieldLabel>
              <Select id="tpl-folder" value={form.folderId ?? ''} onChange={v => set('folderId', v || null)} options={folderOptions} />
            </div>
          </SettingsBar>

          <div className="space-y-1">
            <FieldLabel>Publish Default</FieldLabel>
            <SegmentedToggle ariaLabel="Publish default" options={PUBLISH_DEFAULT_OPTIONS} value={form.publishDefault} onChange={v => set('publishDefault', v)} />
            <p className="text-xs text-[var(--color-text-muted)]">
              Auto publishes if a due date is set at deploy time, otherwise stays a draft.
            </p>
          </div>

          {/* Deployed item title */}
          <div className="space-y-1">
            <FieldLabel htmlFor="tpl-asgn-name" required>{isPage ? 'Page Title' : 'Assignment Name'}</FieldLabel>
            <TextField
              id="tpl-asgn-name"
              value={form.name}
              onChange={v => set('name', v)}
              placeholder={isPage ? 'e.g. Week 1 Overview' : 'e.g. Weekly Quiz — Week ___'}
              className={errors.name ? 'border-[var(--color-danger)]' : ''}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              {isPage ? 'Becomes the page title when deployed.' : 'Becomes the assignment name when deployed.'} Edit per use.
            </p>
            {errors.name && <FieldError msg={errors.name} />}
          </div>

          {/* Instructions */}
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: 'var(--color-bg-page)' }}>
              <span className="section-label !mb-0">Instructions {!isPage && '(Canvas HTML)'}</span>
              <button
                type="button"
                onClick={() => setEditingHtml(v => !v)}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] transition-colors duration-75"
              >
                {editingHtml ? 'Show preview' : 'Edit HTML source'}
              </button>
            </div>

            {editingHtml ? (
              <textarea
                id="tpl-instructions"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={8}
                className="input resize-y font-mono text-xs w-full rounded-none border-0"
              />
            ) : (
              <div
                id="tpl-instructions"
                className="p-4 min-h-[8rem] prose prose-sm max-w-none overflow-auto text-[var(--color-text-body)]"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.description || '') }}
                aria-label="Instructions preview (read-only)"
              />
            )}
            {!form.description && !editingHtml && (
              <p className="px-4 pb-3 text-xs text-[var(--color-text-muted)]">No instructions yet.</p>
            )}
          </div>

          {/* Assignment-only fields */}
          {!isPage && (
            <div className="space-y-4 pt-2 border-t border-[var(--color-border)]">
              <SettingsBar>
                <h3 className="section-label !mb-0">Assignment Fields</h3>
              </SettingsBar>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <TextField
                    id="tpl-group"
                    list="tpl-group-suggestions"
                    value={form.assignmentGroup}
                    onChange={v => set('assignmentGroup', v)}
                    placeholder="e.g. Quizzes"
                  />
                  <datalist id="tpl-group-suggestions">
                    {groupSuggestions.map(name => <option key={name} value={name} />)}
                  </datalist>
                  <p className="text-xs text-[var(--color-text-muted)]">Matched by name at deploy time; created if it doesn't exist.</p>
                </div>

                <div className="space-y-1">
                  <FieldLabel htmlFor="tpl-grading">Grading Type</FieldLabel>
                  <Select id="tpl-grading" value={form.gradingType} onChange={v => set('gradingType', v)} options={GRADING_TYPES} />
                </div>
              </div>

              <SettingsBar className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <FieldLabel htmlFor="tpl-submission">Submission Type</FieldLabel>
                    <Select id="tpl-submission" value={form.submissionType} onChange={v => set('submissionType', v)} options={SUBMISSION_TYPES} />
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
                            <Checkbox checked={form.allowedFormats.includes(f.value)} onChange={() => toggleFormat(f.value)} />
                            {f.label}
                          </div>
                        ))}
                      </div>
                      {errors.allowedFormats && <FieldError msg={errors.allowedFormats} />}
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center justify-between gap-4 cursor-pointer"
                  onClick={() => set('peerReview', !form.peerReview)}
                >
                  <div>
                    <span className="block text-sm font-medium text-[var(--color-text-body)]">Peer Review</span>
                    <span className="text-xs text-[var(--color-text-muted)]">Require students to review each other's work.</span>
                  </div>
                  <Checkbox checked={form.peerReview} onChange={v => set('peerReview', v)} />
                </div>
              </SettingsBar>
            </div>
          )}

          <Callout tone="info" title="No dates stored in templates">
            Due Date, Available From, and Available Until are set exclusively at deploy time.
          </Callout>
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
