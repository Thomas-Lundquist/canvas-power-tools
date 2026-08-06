import { useState, useEffect } from 'react'
import { Check, AlertCircle, CheckCircle, Loader, Search, X } from 'lucide-react'
import Modal from './Modal.jsx'
import { Checkbox } from './FormControls.jsx'
import { getCourses } from '../api/courses.js'
import { getAssignmentGroups } from '../api/assignmentGroups.js'
import { createAssignment } from '../api/assignments.js'
import { usePinGate } from '../security/usePinGate.jsx'
import { useToast } from './Toast.jsx'

function shiftDate(dateStr, days) {
  if (!dateStr) return dateStr
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function applyDateHandling(assignment, dateMode, shiftSign, shiftDays) {
  if (dateMode === 'keep') {
    return { dueAt: assignment.dueAt, unlockAt: assignment.unlockAt, lockAt: assignment.lockAt }
  }
  if (dateMode === 'clear') {
    return { dueAt: null, unlockAt: null, lockAt: null }
  }
  if (dateMode === 'shift') {
    const days = parseInt(shiftSign + (shiftDays || '0'), 10) || 0
    return {
      dueAt:     shiftDate(assignment.dueAt,     days),
      unlockAt:  shiftDate(assignment.unlockAt,  days),
      lockAt:    shiftDate(assignment.lockAt,    days),
    }
  }
  return { dueAt: null, unlockAt: null, lockAt: null }
}

function ModePill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-medium transition-colors duration-75 ${
        active
          ? 'text-white'
          : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-body)]'
      }`}
      style={active ? { backgroundColor: 'var(--cpt-color)' } : undefined}
    >
      {label}
    </button>
  )
}

export default function CopyToCoursesModal({ assignments, sourceCourseId, onClose }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]           = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [search, setSearch]             = useState('')
  const [targetIds, setTargetIds]       = useState(new Set())

  const [dateMode, setDateMode]         = useState('keep')
  const [shiftSign, setShiftSign]       = useState('+')
  const [shiftDays, setShiftDays]       = useState('7')
  const [publishMode, setPublishMode]   = useState('keep')

  const [copying, setCopying]           = useState(false)
  const [copyProgress, setCopyProgress] = useState('')
  const [results, setResults]           = useState(null)

  useEffect(() => {
    getCourses()
      .then(list => setCourses(list.filter(c => String(c.id) !== String(sourceCourseId))))
      .finally(() => setLoadingCourses(false))
  }, [sourceCourseId])

  const filtered = courses.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const allSelected = filtered.length > 0 && filtered.every(c => targetIds.has(c.id))
  const someSelected = targetIds.size > 0 && !allSelected

  function toggleCourse(id) {
    setTargetIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setTargetIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        filtered.forEach(c => next.delete(c.id))
      } else {
        filtered.forEach(c => next.add(c.id))
      }
      return next
    })
  }

  async function executeCopy() {
    const action = async () => {
      setCopying(true)
      const targetCourses = courses.filter(c => targetIds.has(c.id))
      const courseResults = []

      for (const course of targetCourses) {
        setCopyProgress(`Copying to ${course.name}…`)
        const assignmentResults = []

        let targetGroups = []
        try { targetGroups = await getAssignmentGroups(course.id) } catch {}

        for (const assignment of assignments) {
          try {
            const dates = applyDateHandling(assignment, dateMode, shiftSign, shiftDays)
            const targetGroup = targetGroups.find(g => g.name === assignment.assignmentGroupName)
            const groupMismatch = assignment.assignmentGroupName && !targetGroup

            await createAssignment(course.id, {
              name:             assignment.name,
              description:      assignment.description,
              pointsPossible:   assignment.pointsPossible,
              submissionTypes:  assignment.submissionTypes,
              allowedExtensions: assignment.allowedExtensions,
              gradingType:      assignment.gradingType,
              peerReviews:      assignment.peerReviews,
              published:        publishMode === 'unpublished' ? false : assignment.published,
              assignmentGroupId: targetGroup?.id ?? null,
              ...dates,
            })

            assignmentResults.push({
              name: assignment.name,
              success: true,
              warning: groupMismatch
                ? `Group "${assignment.assignmentGroupName}" not found — placed in default group`
                : null,
            })
          } catch (err) {
            assignmentResults.push({
              name: assignment.name,
              success: false,
              error: err.message ?? 'Unknown error',
            })
          }
        }

        courseResults.push({
          courseId:   course.id,
          courseName: course.name,
          assignments: assignmentResults,
          succeeded:  assignmentResults.filter(r => r.success).length,
        })
      }

      const totalSucceeded = courseResults.reduce((n, r) => n + r.succeeded, 0)
      const totalFailed    = courseResults.reduce((n, r) => n + (r.assignments.length - r.succeeded), 0)
      setResults(courseResults)
      setCopying(false)
      setCopyProgress('')

      if (totalFailed === 0) {
        toast(`${totalSucceeded} assignment${totalSucceeded !== 1 ? 's' : ''} copied`, 'success')
      } else {
        toast(`${totalSucceeded} copied, ${totalFailed} failed`, 'warning')
      }
    }

    await requirePin(
      {
        action:     'copy_assignments',
        summary:    `Copy ${assignments.length} assignment${assignments.length !== 1 ? 's' : ''} to ${targetIds.size} course${targetIds.size !== 1 ? 's' : ''}`,
        courseId:   sourceCourseId,
      },
      action,
    )
  }

  // ── RESULTS VIEW ─────────────────────────────────────────────────────────────

  if (results) {
    const totalSucceeded = results.reduce((n, r) => n + r.succeeded, 0)
    const totalFailed    = results.reduce((n, r) => n + (r.assignments.length - r.succeeded), 0)

    return (
      <Modal
        title="Copy Complete"
        subtitle={`${totalSucceeded} copied${totalFailed > 0 ? `, ${totalFailed} failed` : ' — all successful'}`}
        onClose={onClose}
        size="md"
        footer={<button className="btn-primary" onClick={onClose}>Done</button>}
      >
        <div className="space-y-3">
          {results.map(r => (
            <div key={r.courseId} className="card p-4">
              <div className="flex items-center gap-2">
                {r.succeeded === r.assignments.length
                  ? <CheckCircle size={15} className="text-[var(--color-success)] shrink-0" aria-hidden="true" />
                  : <AlertCircle size={15} className="text-[var(--color-domain-alert)] shrink-0" aria-hidden="true" />
                }
                <span className="text-sm font-medium text-[var(--color-text-body)] flex-1 truncate">{r.courseName}</span>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">{r.succeeded}/{r.assignments.length}</span>
              </div>
              {r.assignments.some(a => !a.success || a.warning) && (
                <ul className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-2">
                  {r.assignments.filter(a => !a.success || a.warning).map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      {a.success
                        ? <AlertCircle size={12} className="text-[var(--color-warning)] mt-0.5 shrink-0" aria-hidden="true" />
                        : <X size={12} className="text-[var(--color-domain-alert)] mt-0.5 shrink-0" aria-hidden="true" />
                      }
                      <span className="text-[var(--color-text-secondary)]">
                        <span className="font-medium text-[var(--color-text-body)]">{a.name}</span>
                        {' — '}{a.warning ?? a.error}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Modal>
    )
  }

  // ── COPY FORM ─────────────────────────────────────────────────────────────────

  const nAssignments = assignments.length
  const nTargets     = targetIds.size
  const canCopy      = nTargets > 0 && !copying

  return (
    <Modal
      title={`Copy ${nAssignments} Assignment${nAssignments !== 1 ? 's' : ''}`}
      subtitle="Choose destination courses and date options"
      onClose={!copying ? onClose : undefined}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={copying}>Cancel</button>
          <button
            className="btn-primary disabled:opacity-50"
            disabled={!canCopy}
            onClick={executeCopy}
          >
            {copying
              ? (
                <span className="flex items-center gap-2">
                  <Loader size={14} className="animate-spin" aria-hidden="true" />
                  {copyProgress || 'Copying…'}
                </span>
              )
              : `Copy to ${nTargets > 0 ? nTargets : ''} course${nTargets !== 1 ? 's' : ''} →`
            }
          </button>
        </>
      }
    >
      <div className="space-y-5">

        {/* Destination courses */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Destination Courses
          </p>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)]" aria-hidden="true" />
            <input
              type="search"
              placeholder="Filter courses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-7 py-1.5 text-sm w-full"
              aria-label="Filter courses"
            />
          </div>
          <div className="border border-[var(--color-border)] rounded-[var(--radius-control)] overflow-hidden">
            <label className="flex items-center gap-2.5 px-3 py-2 bg-[var(--color-bg-hover)] border-b border-[var(--color-border)] cursor-pointer select-none">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
                ariaLabel="Select all visible courses"
              />
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                {allSelected ? 'Deselect all' : 'Select all'}
                {filtered.length !== courses.length && ` (${filtered.length} visible)`}
              </span>
            </label>
            <div className="max-h-44 overflow-y-auto" role="listbox" aria-multiselectable="true" aria-label="Destination courses">
              {loadingCourses
                ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--color-text-muted)]">
                    <Loader size={14} className="animate-spin" aria-hidden="true" />
                    Loading courses…
                  </div>
                )
                : filtered.length === 0
                  ? <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">No courses match</p>
                  : filtered.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-hover)] select-none border-t border-[var(--color-border-subtle)] first:border-t-0"
                    >
                      <Checkbox
                        checked={targetIds.has(c.id)}
                        onChange={() => toggleCourse(c.id)}
                        ariaLabel={c.name}
                      />
                      <span className="text-sm text-[var(--color-text-body)] truncate">{c.name}</span>
                    </label>
                  ))
              }
            </div>
          </div>
        </div>

        {/* Date handling */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">Dates</p>
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-1.5" role="group" aria-label="Date handling mode">
              <ModePill label="Keep"  active={dateMode === 'keep'}  onClick={() => setDateMode('keep')}  />
              <ModePill label="Clear" active={dateMode === 'clear'} onClick={() => setDateMode('clear')} />
              <ModePill label="Shift" active={dateMode === 'shift'} onClick={() => setDateMode('shift')} />
            </div>
            {dateMode === 'keep'  && <p className="text-xs text-[var(--color-text-muted)]">Due and availability dates are copied exactly from the source.</p>}
            {dateMode === 'clear' && <p className="text-xs text-[var(--color-text-muted)]">All dates cleared — set them later with Bulk Editor.</p>}
            {dateMode === 'shift' && (
              <div className="flex items-center gap-2">
                <select
                  value={shiftSign}
                  onChange={e => setShiftSign(e.target.value)}
                  className="input w-14 text-sm py-1"
                  aria-label="Shift direction"
                >
                  <option value="+">+</option>
                  <option value="-">−</option>
                </select>
                <input
                  type="number"
                  min="1"
                  value={shiftDays}
                  onChange={e => setShiftDays(e.target.value)}
                  placeholder="days"
                  className="input w-24 text-sm py-1"
                  aria-label="Number of days to shift"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">days from original dates</span>
              </div>
            )}
          </div>
        </div>

        {/* Publish status */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">Publish Status</p>
          <div className="card p-4 space-y-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="Publish status mode">
              <ModePill label="Keep original"      active={publishMode === 'keep'}        onClick={() => setPublishMode('keep')}        />
              <ModePill label="Force unpublished"  active={publishMode === 'unpublished'} onClick={() => setPublishMode('unpublished')} />
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {publishMode === 'keep'
                ? 'Published assignments remain published in the destination course.'
                : 'All copied assignments will be created as unpublished.'}
            </p>
          </div>
        </div>

      </div>
    </Modal>
  )
}
