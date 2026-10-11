import { useState } from 'react'
import { CheckCircle, AlertCircle, Loader, Circle, ChevronRight, ChevronDown } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import Callout from '../../components/Callout.jsx'
import { buildChanges, buildSectionOverrideDates } from './bulkEditorHelpers.js'
import { updateAssignment } from '../../api/assignments.js'
import { createSectionOverride, updateSectionOverride } from '../../api/overrides.js'
import { buildChangeLogEntry, addChangeLogEntry } from '../../storage/changeLogs.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { AuthError, NotFoundError, RateLimitError } from '../../api/errors.js'

const FIELD_LABELS = {
  dueAt: 'Due Date',
  unlockAt: 'Avail. From',
  lockAt: 'Avail. Until',
  pointsPossible: 'Points',
  published: 'Status',
  assignmentGroupId: 'Assignment Group',
}

function formatValue(field, value, groupNameById) {
  if (value === null || value === undefined) return '—'
  if (field === 'published') return value ? 'Published' : 'Unpublished'
  if (field === 'pointsPossible') return `${value} pts`
  if (field === 'assignmentGroupId') return groupNameById?.get(value) ?? value
  return formatDate(value) ?? String(value)
}

function getErrorStatus(err) {
  if (err instanceof AuthError) return 401
  if (err instanceof NotFoundError) return 404
  if (err instanceof RateLimitError) return 429
  return err?.statusCode ?? null
}

function translateError(err) {
  if (err instanceof AuthError) return "You don't have permission to edit this assignment, or your Canvas token needs reconnecting."
  if (err instanceof NotFoundError) return 'This assignment no longer exists in Canvas (it may have been deleted).'
  if (err instanceof RateLimitError) return 'Canvas is temporarily throttling requests. Try again in a moment.'
  if (err?.statusCode === 422) return 'Canvas flagged a validation error with one or more fields.'
  return 'Canvas had a temporary problem. This usually works on retry.'
}

function actionsToSpec(actions) {
  function dateSpec(f) {
    if (f.mode === 'none') return null
    if (f.mode === 'clear') return { mode: 'clear' }
    if (f.mode === 'set') return { mode: 'set', value: f.setValue }
    if (f.mode === 'shift' && f.shiftDays) {
      const days = f.shiftDir === '-' ? -parseInt(f.shiftDays, 10) : parseInt(f.shiftDays, 10)
      return { mode: 'shift', days }
    }
    return null
  }
  return {
    dueAt: dateSpec(actions.dueAt),
    unlockAt: dateSpec(actions.unlockAt),
    lockAt: dateSpec(actions.lockAt),
    points: actions.points !== '' ? { value: actions.points } : null,
    published: actions.status !== null ? { value: actions.status === 'publish' } : null,
    assignmentGroupId: actions.assignmentGroupId !== '' ? { value: actions.assignmentGroupId } : null,
  }
}

function groupChangesByAssignment(changes) {
  const map = new Map()
  for (const change of changes) {
    if (!map.has(change.assignmentId)) {
      map.set(change.assignmentId, { id: change.assignmentId, name: change.assignmentName, fields: [] })
    }
    map.get(change.assignmentId).fields.push(change)
  }
  return Array.from(map.values())
}

const DATE_FIELDS = ['dueAt', 'unlockAt', 'lockAt']

export default function PreviewDiff({
  selectedAssignments, actions, changes: prebuiltChanges, courseId, courseName, groups = [], sections = [], onCancel, onDone, onViewReport,
}) {
  const groupNameById = new Map(groups.map(g => [g.id, g.name]))
  const [phase, setPhase] = useState('preview')
  const [assignmentStatus, setAssignmentStatus] = useState({})
  const [succeededAssignments, setSucceededAssignments] = useState([])
  const [failures, setFailures] = useState([])
  const [showSucceeded, setShowSucceeded] = useState(false)
  const { requirePin } = usePinGate()

  // Two entry points share this component. The bulk bar passes `actions` and we
  // build the diff here. The inline table editor passes a prebuilt `changes`
  // array (already in the same shape), so there is no bulk-bar date target.
  const dateTarget = actions?.dateTarget ?? 'everyone'
  const targetSection = dateTarget !== 'everyone' ? sections.find(s => s.id === dateTarget) ?? null : null

  const changes = prebuiltChanges ?? buildChanges(selectedAssignments, actionsToSpec(actions), dateTarget, sections)
  const grouped = groupChangesByAssignment(changes)
  const totalFields = changes.length
  const totalAssignments = grouped.length
  const succeededFieldCount = succeededAssignments.reduce((sum, a) => sum + a.fields.length, 0)

  // Look up an assignment's existing overrides at apply time, to preserve the
  // section dates the teacher is not changing and to decide create vs update.
  const assignmentById = new Map(selectedAssignments.map(a => [a.id, a]))

  // Warn when a course-wide date change is silently hidden: if an assignment
  // already has a section override, those students keep their own date and will
  // not see the "Everyone" change. Only relevant while targeting Everyone.
  const shadowedAssignments = dateTarget !== 'everyone' ? [] : grouped.filter(g => {
    const full = assignmentById.get(g.id)
    const hasSectionOverride = full?.overrides?.some(o => o.courseSectionId)
    // Only a course-wide (assignment-scope) date change is shadowed — a change
    // written straight to a section's own override is not.
    const changesABaseDate = g.fields.some(f => DATE_FIELDS.includes(f.field) && f.scope !== 'section')
    return hasSectionOverride && changesABaseDate
  })

  const MODAL_TITLES = { preview: 'Preview Changes', applying: 'Applying Changes…', result: 'Changes Applied' }
  const modalClose = phase === 'preview' ? onCancel : phase === 'result' ? onDone : undefined

  async function handleConfirm() {
    const targetNote = targetSection ? ` · dates target section "${targetSection.name}"` : ''
    await requirePin(
      {
        action: 'bulk-edit',
        summary: `${totalFields} field change${totalFields !== 1 ? 's' : ''} across ${totalAssignments} assignment${totalAssignments !== 1 ? 's' : ''} in ${courseName}${targetNote}`,
        courseId,
        courseName,
      },
      () => runApply(grouped),
    )
  }

  async function runApply(assignmentsToApply) {
    setPhase('applying')

    const batchSuccesses = []
    const batchSuccessFields = []
    const batchFailures = []

    for (const assignment of assignmentsToApply) {
      setAssignmentStatus(prev => ({ ...prev, [assignment.id]: 'applying' }))

      // Course-wide fields go to the assignment itself and stay revertable.
      // Section-scoped date fields go to that section's override — pin-gated,
      // but never written to the revert log (a base-date revert would clobber
      // the section's date, so section overrides are intentionally not logged).
      const assignmentFields = assignment.fields.filter(f => f.scope !== 'section')
      const sectionFields = assignment.fields.filter(f => f.scope === 'section')
      const changesBySection = new Map()
      for (const f of sectionFields) {
        if (!changesBySection.has(f.sectionId)) changesBySection.set(f.sectionId, [])
        changesBySection.get(f.sectionId).push(f)
      }
      const full = assignmentById.get(assignment.id)

      try {
        if (assignmentFields.length > 0) {
          const payload = {}
          for (const change of assignmentFields) payload[change.field] = change.newValue
          await updateAssignment(courseId, assignment.id, payload)
        }
        for (const [sectionId, sectionChanges] of changesBySection) {
          const existing = full?.overrides?.find(o => o.courseSectionId === sectionId) ?? null
          // Seed a brand-new override from the base dates, so untouched fields
          // keep the dates the section was inheriting instead of going null.
          const dates = buildSectionOverrideDates(existing, sectionChanges, full)
          if (existing?.id) {
            await updateSectionOverride(courseId, assignment.id, existing.id, dates)
          } else {
            await createSectionOverride(courseId, assignment.id, sectionId, dates)
          }
        }
        batchSuccesses.push(assignment)
        batchSuccessFields.push(...assignmentFields)
        setAssignmentStatus(prev => ({ ...prev, [assignment.id]: 'done' }))
      } catch (err) {
        batchFailures.push({
          assignmentId: assignment.id,
          assignmentName: assignment.name,
          status: getErrorStatus(err),
          reason: translateError(err),
        })
        setAssignmentStatus(prev => ({ ...prev, [assignment.id]: 'failed' }))
      }
    }

    if (batchSuccessFields.length > 0) {
      const entry = await buildChangeLogEntry({ courseId, courseName, changes: batchSuccessFields })
      if (batchFailures.length > 0) {
        entry.failures = batchFailures.map(f => ({ assignmentName: f.assignmentName, status: f.status, reason: f.reason }))
      }
      await addChangeLogEntry(entry)
    }

    setSucceededAssignments(prev => [...prev, ...batchSuccesses])
    setFailures(batchFailures)
    setPhase('result')
  }

  async function handleRetry() {
    const failedIds = new Set(failures.map(f => f.assignmentId))
    const assignmentsToRetry = grouped.filter(a => failedIds.has(a.id))
    setFailures([])
    setShowSucceeded(false)
    await runApply(assignmentsToRetry)
  }

  if (phase === 'preview') {
    return (
      <Modal title={MODAL_TITLES.preview} onClose={modalClose} size="lg">
        {shadowedAssignments.length > 0 && (
          <Callout tone="warning" title="Some sections keep their own dates" className="mb-4">
            {shadowedAssignments.length} of these assignment{shadowedAssignments.length !== 1 ? 's' : ''} already
            {shadowedAssignments.length !== 1 ? ' have' : ' has'} section-specific due dates. Students in those
            sections keep their existing dates and will not see this course-wide change. To change a section
            directly, pick it in the “Apply to” menu.
          </Callout>
        )}
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-[var(--color-border)]">
          {grouped.map(assignment => (
            <AssignmentBlock key={assignment.id} assignment={assignment} groupNameById={groupNameById} />
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {totalFields} field{totalFields !== 1 ? 's' : ''} to change across {totalAssignments} assignment{totalAssignments !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirm}>Confirm &amp; Apply</Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (phase === 'applying') {
    return (
      <Modal title={MODAL_TITLES.applying} size="lg">
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-[var(--color-border)]">
          {grouped.map(assignment => (
            <AssignmentBlock
              key={assignment.id}
              assignment={assignment}
              groupNameById={groupNameById}
              status={assignmentStatus[assignment.id]}
              showStatus
            />
          ))}
        </div>
      </Modal>
    )
  }

  const allSucceeded = failures.length === 0

  return (
    <Modal title={MODAL_TITLES.result} onClose={modalClose} size="lg">
      <div className="space-y-4">
        {allSucceeded ? (
          <div className="flex items-center gap-2 text-[var(--color-success)]">
            <CheckCircle size={20} aria-hidden="true" />
            <span className="text-base font-medium">
              {succeededFieldCount} field{succeededFieldCount !== 1 ? 's' : ''} updated across {succeededAssignments.length} assignment{succeededAssignments.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertCircle size={20} aria-hidden="true" />
              <span className="text-base font-medium">
                {succeededAssignments.length} updated · {failures.length} failed
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--color-error)]">Failed</p>
              {failures.map(f => (
                <div
                  key={f.assignmentId}
                  className="rounded-[var(--radius-card)] border border-[var(--color-error)] px-4 py-3"
                  style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}
                >
                  <p className="text-sm font-medium text-[var(--color-text-body)]">
                    {f.assignmentName}
                    {f.status && (
                      <span className="ml-2 text-xs text-[var(--color-text-muted)] font-normal">({f.status})</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.reason}</p>
                </div>
              ))}
            </div>

            {succeededAssignments.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] transition-colors duration-75"
                  onClick={() => setShowSucceeded(s => !s)}
                >
                  {showSucceeded
                    ? <ChevronDown size={14} aria-hidden="true" />
                    : <ChevronRight size={14} aria-hidden="true" />}
                  {succeededAssignments.length} succeeded
                </button>
                {showSucceeded && (
                  <ul className="mt-2 space-y-1 pl-5 list-disc">
                    {succeededAssignments.map(a => (
                      <li key={a.id} className="text-sm text-[var(--color-text-secondary)]">{a.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-[var(--color-border)]">
        <Button variant="ghost" onClick={onViewReport}>View Report</Button>
        {!allSucceeded && (
          <Button variant="secondary" onClick={handleRetry}>Retry all failed</Button>
        )}
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    </Modal>
  )
}

function AssignmentBlock({ assignment, groupNameById, status, showStatus = false }) {
  return (
    <div className="py-3 flex items-start gap-3">
      {showStatus && (
        <div className="mt-0.5 shrink-0 w-4">
          {status === 'applying' && (
            <Loader size={16} className="animate-spin text-[var(--cpt-color)]" aria-label="Applying" />
          )}
          {status === 'done' && (
            <CheckCircle size={16} className="text-[var(--color-success)]" aria-label="Done" />
          )}
          {status === 'failed' && (
            <AlertCircle size={16} className="text-[var(--color-error)]" aria-label="Failed" />
          )}
          {!status && (
            <Circle size={16} className="text-[var(--color-text-disabled)]" aria-label="Pending" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-body)] mb-1.5">{assignment.name}</p>
        <div className="space-y-1">
          {assignment.fields.map((change, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="w-28 shrink-0 text-xs text-[var(--color-text-secondary)]">
                {FIELD_LABELS[change.field] ?? change.field}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatValue(change.field, change.previousValue, groupNameById)}
              </span>
              <span className="text-xs font-medium text-[var(--cpt-color)]" aria-hidden="true">→</span>
              <span className="text-xs font-medium text-[var(--color-text-body)]">
                {formatValue(change.field, change.newValue, groupNameById)}
              </span>
              {change.scope === 'section' && (
                <span className="ml-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--cpt-color)]">
                  {change.sectionName}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
