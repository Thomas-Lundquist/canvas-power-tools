import { useState, useEffect, useMemo } from 'react'
import { Search, X, ArrowRight, ArrowLeft, Check, AlertCircle, CheckCircle } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import AssignmentTable from '../assignments/AssignmentTable.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { sortAssignments } from '../assignments/bulkEditorHelpers.js'
import { getCourses } from '../../api/courses.js'
import { getAssignments, createAssignment } from '../../api/assignments.js'
import { getAssignmentGroups } from '../../api/assignmentGroups.js'
import { getPreferences } from '../../storage/preferences.js'
import { usePinGate } from '../../security/usePinGate.jsx'

function ModePill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-75 ${
        active ? 'text-white' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-body)]'
      }`}
      style={active ? { backgroundColor: 'var(--cpt-color)' } : undefined}
    >
      {label}
    </button>
  )
}

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
      dueAt: shiftDate(assignment.dueAt, days),
      unlockAt: shiftDate(assignment.unlockAt, days),
      lockAt: shiftDate(assignment.lockAt, days),
    }
  }
  return { dueAt: null, unlockAt: null, lockAt: null }
}

export default function CopyFlow({ initialCourseId }) {
  const toast = useToast()
  const { requirePin } = usePinGate()
  const [step, setStep] = useState('source')

  // Source step
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [sourceCourseId, setSourceCourseId] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('position')
  const [sortDir, setSortDir] = useState('asc')

  // Target step
  const [targetIds, setTargetIds] = useState(new Set())
  const [dateMode, setDateMode] = useState('keep')
  const [shiftSign, setShiftSign] = useState('+')
  const [shiftDays, setShiftDays] = useState('7')
  const [publishMode, setPublishMode] = useState('keep')

  // Copy state
  const [copyProgress, setCopyProgress] = useState('')
  const [copying, setCopying] = useState(false)
  const [results, setResults] = useState([])

  useEffect(() => {
    Promise.all([getCourses(), getPreferences()])
      .then(([list, prefs]) => {
        setCourses(list)
        setDateMode(prefs.copyDefaultDateMode ?? 'keep')
        setShiftDays(prefs.copyDefaultShiftDays > 0 ? String(prefs.copyDefaultShiftDays) : '7')
        setPublishMode(prefs.copyDefaultPublishMode ?? 'keep')
        const startId = initialCourseId && list.find(c => c.id === String(initialCourseId))
          ? String(initialCourseId)
          : list[0]?.id ?? null
        if (startId) loadAssignmentsForCourse(startId)
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  async function loadAssignmentsForCourse(courseId) {
    setSourceCourseId(courseId)
    setSelectedIds(new Set())
    setSearch('')
    setLoadingAssignments(true)
    try {
      const list = await getAssignments(courseId)
      setAssignments(sortAssignments(list, 'position', 'asc'))
      setSortKey('position')
      setSortDir('asc')
    } finally {
      setLoadingAssignments(false)
    }
  }

  const filteredAssignments = useMemo(() => {
    if (!search.trim()) return assignments
    const q = search.toLowerCase()
    return assignments.filter(a => a.name.toLowerCase().includes(q))
  }, [assignments, search])

  const sortedFiltered = useMemo(
    () => sortAssignments(filteredAssignments, sortKey, sortDir),
    [filteredAssignments, sortKey, sortDir]
  )

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleAssignment(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllAssignments(checked) {
    setSelectedIds(checked ? new Set(sortedFiltered.map(a => a.id)) : new Set())
  }

  const targetableCourses = courses.filter(c => c.id !== sourceCourseId)
  const allTargetsSelected = targetableCourses.length > 0 && targetableCourses.every(c => targetIds.has(c.id))

  function toggleTarget(id) {
    setTargetIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllTargets(checked) {
    setTargetIds(checked ? new Set(targetableCourses.map(c => c.id)) : new Set())
  }

  async function executeCopy() {
    const sourceCourse = courses.find(c => c.id === sourceCourseId)
    const targetNames = [...targetIds].map(id => courses.find(c => c.id === id)?.name ?? id).join(', ')
    await requirePin(
      {
        action: 'copy_assignments',
        summary: `Copied ${selectedIds.size} assignment${selectedIds.size !== 1 ? 's' : ''} from ${sourceCourse?.name ?? sourceCourseId} to ${targetNames}`,
        courseId: sourceCourseId,
        courseName: sourceCourse?.name ?? sourceCourseId,
      },
      runCopy,
    )
  }

  async function runCopy() {
    setCopying(true)
    setStep('results')
    setResults([])

    const sourceAssignments = assignments.filter(a => selectedIds.has(a.id))
    const targetList = [...targetIds]

    // Fetch assignment groups for all target courses (for name-based matching)
    const groupMap = {}
    for (const cId of targetList) {
      const course = courses.find(c => c.id === cId)
      setCopyProgress(`Preparing ${course?.name ?? cId}...`)
      try {
        groupMap[cId] = await getAssignmentGroups(cId)
      } catch {
        groupMap[cId] = []
      }
    }

    const courseResults = []
    for (let i = 0; i < targetList.length; i++) {
      const cId = targetList[i]
      const course = courses.find(c => c.id === cId)
      setCopyProgress(`Copying to ${course?.name ?? cId} (${i + 1} of ${targetList.length})...`)

      const assignmentResults = []
      for (const assignment of sourceAssignments) {
        try {
          const targetGroup = groupMap[cId].find(
            g => g.name.toLowerCase() === (assignment.assignmentGroupName ?? '').toLowerCase()
          )
          const dates = applyDateHandling(assignment, dateMode, shiftSign, shiftDays)

          const groupMismatch = !targetGroup && !!assignment.assignmentGroupName

          await createAssignment(cId, {
            name: assignment.name,
            description: assignment.description,
            pointsPossible: assignment.pointsPossible,
            submissionTypes: assignment.submissionTypes,
            allowedExtensions: assignment.allowedExtensions,
            gradingType: assignment.gradingType,
            peerReviews: assignment.peerReviews,
            published: publishMode === 'unpublished' ? false : assignment.published,
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
          assignmentResults.push({ name: assignment.name, success: false, error: err.message ?? 'Unknown error' })
        }
      }

      courseResults.push({
        courseId: cId,
        courseName: course?.name ?? cId,
        assignments: assignmentResults,
        succeeded: assignmentResults.filter(r => r.success).length,
      })
    }

    const totalSucceeded = courseResults.reduce((n, r) => n + r.succeeded, 0)
    const totalFailed = courseResults.reduce((n, r) => n + (r.assignments.length - r.succeeded), 0)
    setResults(courseResults)
    setCopying(false)
    setCopyProgress('')
    if (totalFailed === 0) {
      toast(`${totalSucceeded} assignment${totalSucceeded !== 1 ? 's' : ''} copied`, 'success')
    } else {
      toast(`${totalSucceeded} copied, ${totalFailed} failed`, 'warning')
    }
  }

  function resetToSource() {
    setStep('source')
    setTargetIds(new Set())
    setResults([])
    setDateMode('clear')
    setShiftSign('+')
    setShiftDays('')
    setPublishMode('keep')
  }

  // â"€â"€ SOURCE STEP â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  if (step === 'source') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Copy Assignments</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Select assignments from a source course, then choose one or more destination courses.
          </p>
        </div>

        <div className="card p-4 mb-4 flex items-center gap-4">
          <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0">Source Course</span>
          <CourseSelector
            courses={courses}
            selectedId={sourceCourseId}
            onChange={loadAssignmentsForCourse}
            loading={loadingCourses}
          />
        </div>

        <div className="mb-3">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search assignments..."
              className="input pl-9"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors duration-75"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="card overflow-hidden flex-1 flex flex-col min-h-0 mb-4">
          {!sourceCourseId ? (
            <div className="text-sm text-[var(--color-text-muted)] p-6">Select a source course to load assignments.</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-page)]">
                {!loadingAssignments && sortedFiltered.length > 0 ? (
                  <button
                    className="text-xs font-medium"
                    style={{ color: 'var(--cpt-color)' }}
                    onClick={() => toggleAllAssignments(selectedIds.size < sortedFiltered.length)}
                  >
                    {selectedIds.size === sortedFiltered.length && sortedFiltered.length > 0 ? 'Deselect all' : 'Select all'}
                  </button>
                ) : <span />}
                {loadingAssignments ? (
                  <span className="text-xs text-[var(--color-text-muted)]">Loading assignments...</span>
                ) : (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {sortedFiltered.length === assignments.length
                      ? `${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`
                      : `${sortedFiltered.length} of ${assignments.length}`}
                    {selectedIds.size > 0 && <span className="ml-2 font-medium" style={{ color: 'var(--cpt-color)' }}>{selectedIds.size} selected</span>}
                  </span>
                )}
              </div>
              {(loadingAssignments || sortedFiltered.length > 0) ? (
                <AssignmentTable
                  assignments={sortedFiltered}
                  selectedIds={selectedIds}
                  onToggle={toggleAssignment}
                  onToggleAll={toggleAllAssignments}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  loading={loadingAssignments}
                  fillHeight
                />
              ) : (
                <div className="text-sm text-[var(--color-text-muted)] p-6">
                  {search ? 'No assignments match your search.' : 'No assignments found in this course.'}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {selectedIds.size === 0
              ? 'Select assignments to copy'
              : `${selectedIds.size} assignment${selectedIds.size !== 1 ? 's' : ''} selected`}
          </span>
          <button
            className="btn-primary flex items-center gap-2"
            disabled={selectedIds.size === 0}
            onClick={() => setStep('targets')}
          >
            Next: Choose Destinations
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  // â"€â"€ TARGET STEP â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  if (step === 'targets') {
    const sourceCourse = courses.find(c => c.id === sourceCourseId)

    return (
      <div className="flex-1 overflow-auto">
        <div className="mb-6">
          <button
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] transition-colors duration-75 mb-4"
            onClick={() => setStep('source')}
          >
            <ArrowLeft size={14} /> Back to source
          </button>
          <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Choose Destinations</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Copying <span className="font-medium text-[var(--color-text-body)]">{selectedIds.size} assignment{selectedIds.size !== 1 ? 's' : ''}</span>
            {' '}from <span className="font-medium text-[var(--color-text-body)]">{sourceCourse?.name ?? sourceCourseId}</span>
          </p>
        </div>

        {/* Target course list */}
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-body)]">Destination Courses</h2>
            <button
              className="text-xs font-medium"
              style={{ color: 'var(--cpt-color)' }}
              onClick={() => toggleAllTargets(!allTargetsSelected)}
            >
              {allTargetsSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          {targetableCourses.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No other courses available.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {targetableCourses.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 cursor-pointer px-2 py-2 rounded hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
                  onClick={() => toggleTarget(c.id)}
                >
                  <Checkbox checked={targetIds.has(c.id)} onChange={() => toggleTarget(c.id)} />
                  <span className="text-sm text-[var(--color-text-body)]">
                    {c.name}
                    {c.term && <span className="text-[var(--color-text-muted)] ml-1.5 text-xs">{c.term}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date handling */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-body)] mb-3">Date Handling</h2>
          <div className="flex items-center gap-1.5 mb-3">
            <ModePill label="Keep original" active={dateMode === 'keep'} onClick={() => setDateMode('keep')} />
            <ModePill label="Clear all" active={dateMode === 'clear'} onClick={() => setDateMode('clear')} />
            <ModePill label="Shift" active={dateMode === 'shift'} onClick={() => setDateMode('shift')} />
          </div>
          {dateMode === 'keep' && (
            <p className="text-xs text-[var(--color-text-muted)]">Due dates, availability dates, and lock dates will be copied exactly from the source.</p>
          )}
          {dateMode === 'clear' && (
            <p className="text-xs text-[var(--color-text-muted)]">Assignments will be created without any dates. You can set them later with the Bulk Assignment Editor.</p>
          )}
          {dateMode === 'shift' && (
            <div className="flex items-center gap-2">
              <select
                value={shiftSign}
                onChange={e => setShiftSign(e.target.value)}
                className="input w-14 text-sm py-1.5"
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
                className="input w-24 text-sm py-1.5"
              />
              <span className="text-sm text-[var(--color-text-secondary)]">days from original dates</span>
            </div>
          )}
        </div>

        {/* Published status */}
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-body)] mb-3">Published Status</h2>
          <div className="flex items-center gap-1.5">
            <ModePill label="Keep original" active={publishMode === 'keep'} onClick={() => setPublishMode('keep')} />
            <ModePill label="Force unpublished" active={publishMode === 'unpublished'} onClick={() => setPublishMode('unpublished')} />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {publishMode === 'keep'
              ? 'Published assignments will remain published in the destination course.'
              : 'All copied assignments will be created as unpublished regardless of their source status.'}
          </p>
        </div>

        {/* Summary card */}
        {targetIds.size > 0 && (
          <div
            className="rounded-lg p-4 text-sm mb-6"
            style={{
              backgroundColor: 'rgba(var(--cpt-color-rgb), 0.07)',
              border: '1px solid rgba(var(--cpt-color-rgb), 0.18)',
              color: 'var(--color-text-body)',
            }}
          >
            <p className="font-medium">
              Copying {selectedIds.size} assignment{selectedIds.size !== 1 ? 's' : ''} to {targetIds.size} course{targetIds.size !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Dates: {dateMode === 'keep' ? 'Kept from source' : dateMode === 'clear' ? 'Cleared' : `Shifted ${shiftSign}${shiftDays || 0} days`}
              {' Â· '}Status: {publishMode === 'keep' ? 'Keep original' : 'Force unpublished'}
            </p>
          </div>
        )}

        <div className="flex justify-between">
          <button className="btn-secondary" onClick={() => setStep('source')}>
            Back
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            disabled={targetIds.size === 0}
            onClick={executeCopy}
          >
            Copy to Canvas
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  // â"€â"€ RESULTS STEP â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  if (copying) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <Loader size={32} className="animate-spin" style={{ color: 'var(--cpt-color)' }} />
        <p className="text-sm text-[var(--color-text-secondary)]">{copyProgress}</p>
      </div>
    )
  }

  const totalSucceeded = results.reduce((n, r) => n + r.succeeded, 0)
  const totalFailed = results.reduce((n, r) => n + (r.assignments.length - r.succeeded), 0)

  return (
    <div className="flex-1 overflow-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle size={22} className="text-green-600" />
          <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Copy Complete</h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {totalSucceeded} assignment{totalSucceeded !== 1 ? 's' : ''} created
          {totalFailed > 0 && <>, <span className="text-red-600">{totalFailed} failed</span></>}
          {' '}across {results.length} course{results.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {results.map(r => (
          <div key={r.courseId} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-[var(--color-text-body)]">{r.courseName}</span>
              <span className={`text-sm font-medium ${r.succeeded === r.assignments.length ? 'text-green-600' : 'text-yellow-600'}`}>
                {r.succeeded} of {r.assignments.length} created
              </span>
            </div>
            <div className="space-y-1.5">
              {r.assignments.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm ${a.success ? 'text-[var(--color-text-body)]' : 'text-red-600'}`}>
                  {a.success
                    ? <Check size={14} className="text-green-600 shrink-0 mt-0.5" />
                    : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                  <span>
                    {a.name}
                    {a.error && <span className="ml-2 text-xs text-red-500">— {a.error}</span>}
                    {a.warning && (
                      <div className="flex items-center gap-1 text-yellow-600 text-xs mt-0.5">
                        <AlertCircle size={12} className="shrink-0" /> {a.warning}
                      </div>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={resetToSource}>
          Copy More
        </button>
        <button className="btn-primary" onClick={() => window.close()}>
          Done
        </button>
      </div>
    </div>
  )
}


