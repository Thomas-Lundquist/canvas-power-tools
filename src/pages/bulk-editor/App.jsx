import { useState, useEffect, useMemo } from 'react'
import { History, Search, X, AlertCircle, Loader, CheckCircle } from 'lucide-react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import Modal from '../../components/Modal.jsx'
import PreviewDiff from '../../components/PreviewDiff.jsx'
import AssignmentTable from '../../modules/assignments/AssignmentTable.jsx'
import BulkActionBar from '../../modules/assignments/BulkActionBar.jsx'
import ChangeLog from '../../modules/assignments/ChangeLog.jsx'
import { buildChanges, applyFilters, sortAssignments } from '../../modules/assignments/bulkEditorHelpers.js'
import { getCourses } from '../../api/courses.js'
import { getAssignments, updateAssignment } from '../../api/assignments.js'
import { getAssignmentGroups } from '../../api/assignmentGroups.js'
import { getModules } from '../../api/modules.js'
import { getPreferences, setLastUsedCourse } from '../../storage/preferences.js'
import { applyTheme, applyDarkMode, applyTextSize } from '../../utils/color.js'
import { Checkbox } from '../../components/FormControls.jsx'
import { addChangeLogEntry, buildChangeLogEntry } from '../../storage/changeLogs.js'
import { usePinGate } from '../../security/usePinGate.jsx'

const EMPTY_SPEC = { dueAt: null, unlockAt: null, lockAt: null, points: null, published: null }
const EMPTY_DATE_RANGE = { from: '', to: '' }
const EMPTY_POINTS_RANGE = { min: '', max: '' }

function fmtFilterDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dateRangeChipLabel(label, { from, to }) {
  if (from && to) return `${label}: ${fmtFilterDate(from)}–${fmtFilterDate(to)}`
  if (from) return `${label}: after ${fmtFilterDate(from)}`
  return `${label}: before ${fmtFilterDate(to)}`
}

function pointsChipLabel({ min, max }) {
  if (min !== '' && max !== '') return `Points: ${min}–${max}`
  if (min !== '') return `Points: ≥${min}`
  return `Points: ≤${max}`
}

export default function App() {
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [selectedCourseName, setSelectedCourseName] = useState('')
  const [assignments, setAssignments] = useState([])
  const [groups, setGroups] = useState([])
  const [modules, setModules] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [filterGroups, setFilterGroups] = useState([])
  const [filterStatus, setFilterStatus] = useState([])
  const [filterDueDate, setFilterDueDate] = useState(EMPTY_DATE_RANGE)
  const [filterUnlockAt, setFilterUnlockAt] = useState(EMPTY_DATE_RANGE)
  const [filterLockAt, setFilterLockAt] = useState(EMPTY_DATE_RANGE)
  const [filterPoints, setFilterPoints] = useState(EMPTY_POINTS_RANGE)
  const [sortKey, setSortKey] = useState('position')
  const [sortDir, setSortDir] = useState('asc')
  const [buttonColor, setButtonColor] = useState('#4f46e5')
  const [bulkSpec, setBulkSpec] = useState(EMPTY_SPEC)
  const [shiftAllTogether, setShiftAllTogether] = useState(true)
  const [defaultDateShiftDays, setDefaultDateShiftDays] = useState(7)
  const [showChangeLogAfterSave, setShowChangeLogAfterSave] = useState(false)
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [loadingCount, setLoadingCount] = useState(0)
  const [error, setError] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 })
  const [applyResult, setApplyResult] = useState(null)
  const [showChangeLog, setShowChangeLog] = useState(false)
  const { requirePin } = usePinGate()

  // Load courses and preferences on mount
  useEffect(() => {
    async function load() {
      try {
        const [fetchedCourses, prefs] = await Promise.all([getCourses(), getPreferences()])
        setCourses(fetchedCourses)
        setShiftAllTogether(prefs.shiftAllDatesTogether)
        setSortKey(prefs.bulkEditorDefaultSort ?? 'position')
        setSortDir(prefs.bulkEditorDefaultSortDir ?? 'asc')
        setDefaultDateShiftDays(prefs.bulkEditorDefaultDateShiftDays ?? 7)
        setShowChangeLogAfterSave(prefs.bulkEditorShowChangeLogAfterSave ?? false)
        const color = prefs.buttonColor ?? '#4f46e5'
        setButtonColor(color)
        applyTheme(color)
        applyDarkMode(prefs.themeMode ?? 'system')
        applyTextSize(prefs.textSize ?? 'medium')

        // ?courseId=X from the content script takes priority over saved preferences
        const params = new URLSearchParams(window.location.search)
        // getCourses() returns String IDs â€" keep the param as a string for comparison
        const urlCourseId = params.get('courseId') ?? null

        const initialId = urlCourseId && fetchedCourses.find(c => c.id === urlCourseId)
          ? urlCourseId
          : prefs.defaultCourse === 'last_used' && prefs.lastUsedCourseId
            ? prefs.lastUsedCourseId
            : fetchedCourses[0]?.id ?? null
        if (initialId) selectCourse(initialId, fetchedCourses)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingCourses(false)
      }
    }
    load()
  }, [])

  async function selectCourse(courseId, courseList = courses) {
    const course = courseList.find(c => c.id === courseId)
    setSelectedCourseId(courseId)
    setSelectedCourseName(course?.name ?? '')
    setSelectedIds(new Set())
    setBulkSpec(EMPTY_SPEC)
    setSearch('')
    setFilterGroups([])
    setFilterStatus([])
    setFilterDueDate(EMPTY_DATE_RANGE)
    setFilterUnlockAt(EMPTY_DATE_RANGE)
    setFilterLockAt(EMPTY_DATE_RANGE)
    setFilterPoints(EMPTY_POINTS_RANGE)
    setLoadingAssignments(true)
    setLoadingCount(0)
    setError(null)
    try {
      const [fetched, grps, mods] = await Promise.all([
        getAssignments(courseId, setLoadingCount),
        getAssignmentGroups(courseId),
        getModules(courseId),
      ])
      setAssignments(fetched)
      setGroups(grps)
      setModules(mods)
      await setLastUsedCourse(courseId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAssignments(false)
    }
  }

  const filtered = useMemo(() => {
    const f = applyFilters(assignments, {
      search, groups: filterGroups, status: filterStatus,
      dueDate: filterDueDate, unlockAt: filterUnlockAt, lockAt: filterLockAt, points: filterPoints,
    })
    return sortAssignments(f, sortKey, sortDir)
  }, [assignments, search, filterGroups, filterStatus, filterDueDate, filterUnlockAt, filterLockAt, filterPoints, sortKey, sortDir])

  const selectedAssignments = useMemo(
    () => assignments.filter(a => selectedIds.has(a.id)),
    [assignments, selectedIds],
  )

  const pendingChanges = useMemo(
    () => buildChanges(selectedAssignments, bulkSpec),
    [selectedAssignments, bulkSpec],
  )

  function handleSort(key) {
    setSortKey(key)
    setSortDir(prev => (sortKey === key && prev === 'asc') ? 'desc' : 'asc')
  }

  function toggleId(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(checked) {
    setSelectedIds(checked ? new Set(filtered.map(a => a.id)) : new Set())
  }

  async function applyChanges() {
    const count = pendingChanges.length
    const aCount = selectedIds.size
    await requirePin(
      {
        action: 'bulk_edit',
        summary: `Changed ${count} field${count !== 1 ? 's' : ''} across ${aCount} assignment${aCount !== 1 ? 's' : ''} in ${selectedCourseName}`,
        courseId: selectedCourseId,
        courseName: selectedCourseName,
      },
      runApplyChanges,
    )
  }

  async function runApplyChanges() {
    setApplying(true)
    setShowPreview(false)
    const succeeded = []
    const failed = []

    // Group changes by assignment
    const byAssignment = {}
    for (const change of pendingChanges) {
      if (!byAssignment[change.assignmentId]) byAssignment[change.assignmentId] = {}
      byAssignment[change.assignmentId][change.field] = change.newValue
    }

    const entries = Object.entries(byAssignment)
    setApplyProgress({ done: 0, total: entries.length })

    for (const [assignmentId, fields] of entries) {
      try {
        await updateAssignment(selectedCourseId, assignmentId, fields)
        succeeded.push(assignmentId)
      } catch (err) {
        failed.push({ id: assignmentId, error: err.message })
      }
      setApplyProgress(prev => ({ ...prev, done: prev.done + 1 }))
    }

    // Update local assignment state with new values
    setAssignments(prev => prev.map(a => {
      if (!byAssignment[a.id]) return a
      return { ...a, ...byAssignment[a.id] }
    }))

    // Write change log
    if (succeeded.length > 0) {
      const successfulChanges = pendingChanges.filter(c => succeeded.includes(c.assignmentId))
      const entry = await buildChangeLogEntry({
        courseId: selectedCourseId,
        courseName: selectedCourseName,
        changes: successfulChanges,
      })
      await addChangeLogEntry(entry)
    }

    setApplying(false)
    setBulkSpec(EMPTY_SPEC)
    setSelectedIds(new Set())
    setApplyResult({ succeeded, failed, changes: pendingChanges })
    if (showChangeLogAfterSave && succeeded.length > 0) setShowChangeLog(true)
  }

  const activeFilterCount = [
    search ? 1 : 0,
    filterGroups.length,
    filterStatus.length,
    (filterDueDate.from || filterDueDate.to) ? 1 : 0,
    (filterUnlockAt.from || filterUnlockAt.to) ? 1 : 0,
    (filterLockAt.from || filterLockAt.to) ? 1 : 0,
    (filterPoints.min !== '' || filterPoints.max !== '') ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-48">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo />
            <div className="w-px h-5 bg-gray-200 hidden sm:block shrink-0" aria-hidden="true" />
            <CourseSelector
              courses={courses}
              selectedId={selectedCourseId}
              onChange={id => selectCourse(id)}
              loading={loadingCourses}
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {selectedCourseId && (
              <button className="btn-ghost text-sm flex items-center gap-1.5" onClick={() => setShowChangeLog(true)}>
                <History size={15} /> Change Log
              </button>
            )}
            <AppNav current="bulk-editor" />
            <SettingsButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>
            <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Page heading + filter bar */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Bulk Assignment Editor</h1>
          <p className="text-sm text-gray-500 mt-1 mb-4">Edit due dates, points, and publish status across all assignments at once.</p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search assignments..."
                className="input pl-9"
              />
              {search && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <GroupFilter groups={groups} selected={filterGroups} onChange={setFilterGroups} />
            <StatusFilter selected={filterStatus} onChange={setFilterStatus} />
            <DateRangeFilter label="Due Date" value={filterDueDate} onChange={setFilterDueDate} />
            <DateRangeFilter label="Avail. From" value={filterUnlockAt} onChange={setFilterUnlockAt} />
            <DateRangeFilter label="Avail. Until" value={filterLockAt} onChange={setFilterLockAt} />
            <PointsRangeFilter value={filterPoints} onChange={setFilterPoints} />
          </div>
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {search && (
                <FilterChip label={`"${search}"`} onRemove={() => setSearch('')} />
              )}
              {filterGroups.map(gId => {
                const group = groups.find(g => g.id === gId)
                return group ? (
                  <FilterChip
                    key={gId}
                    label={group.name}
                    onRemove={() => setFilterGroups(prev => prev.filter(id => id !== gId))}
                  />
                ) : null
              })}
              {filterStatus.map(s => (
                <FilterChip
                  key={s}
                  label={s === 'published' ? 'Published' : 'Unpublished'}
                  onRemove={() => setFilterStatus(prev => prev.filter(v => v !== s))}
                />
              ))}
              {(filterDueDate.from || filterDueDate.to) && (
                <FilterChip label={dateRangeChipLabel('Due Date', filterDueDate)} onRemove={() => setFilterDueDate(EMPTY_DATE_RANGE)} />
              )}
              {(filterUnlockAt.from || filterUnlockAt.to) && (
                <FilterChip label={dateRangeChipLabel('Available From', filterUnlockAt)} onRemove={() => setFilterUnlockAt(EMPTY_DATE_RANGE)} />
              )}
              {(filterLockAt.from || filterLockAt.to) && (
                <FilterChip label={dateRangeChipLabel('Available Until', filterLockAt)} onRemove={() => setFilterLockAt(EMPTY_DATE_RANGE)} />
              )}
              {(filterPoints.min !== '' || filterPoints.max !== '') && (
                <FilterChip label={pointsChipLabel(filterPoints)} onRemove={() => setFilterPoints(EMPTY_POINTS_RANGE)} />
              )}
            </div>
          )}
        </div>

        {/* Loading courses spinner */}
        {loadingCourses && (
          <div className="card p-16 flex flex-col items-center gap-3 text-gray-400">
            <Loader size={32} className="animate-spin" style={{ color: 'var(--cpt-color)' }} />
            <span className="text-sm">Loading courses...</span>
          </div>
        )}

        {/* Assignment table */}
        {!loadingCourses && selectedCourseId && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              {!loadingAssignments && filtered.length > 0 ? (
                <button
                  className="text-xs font-medium"
                  style={{ color: 'var(--cpt-color)' }}
                  onClick={() => toggleAll(selectedIds.size < filtered.length)}
                >
                  {selectedIds.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
                </button>
              ) : <span />}
              {loadingAssignments ? (
                <span className="text-xs text-gray-400">Loading assignments...</span>
              ) : (
                <span className="text-xs text-gray-500">
                  Showing {filtered.length} of {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
                  {selectedIds.size > 0 && <span className="ml-2 font-medium" style={{ color: 'var(--cpt-color)' }}>{selectedIds.size} selected</span>}
                </span>
              )}
            </div>
            {!loadingAssignments && assignments.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-sm font-medium text-gray-500">This course has no assignments yet.</p>
                <p className="text-xs text-gray-400 mt-1">Create assignments in Canvas and they'll appear here.</p>
              </div>
            ) : !loadingAssignments && filtered.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-gray-500">No assignments match your filters.</p>
                <button
                  className="mt-2 text-xs underline text-gray-400 hover:text-gray-600"
                  onClick={() => { setSearch(''); setFilterGroups([]); setFilterStatus([]); setFilterDueDate(EMPTY_DATE_RANGE); setFilterUnlockAt(EMPTY_DATE_RANGE); setFilterLockAt(EMPTY_DATE_RANGE); setFilterPoints(EMPTY_POINTS_RANGE) }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <AssignmentTable
                assignments={filtered}
                selectedIds={selectedIds}
                onToggle={toggleId}
                onToggleAll={toggleAll}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                loading={loadingAssignments}
              />
            )}
          </div>
        )}

        {/* No course selected */}
        {!loadingCourses && !selectedCourseId && (
          <div className="card p-16 text-center text-gray-400">
            <p className="text-sm">Select a course above to get started.</p>
          </div>
        )}
      </div>

      {/* Apply progress bar — replaces action bar while saving */}
      {applying && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Saving changes — {applyProgress.done} of {applyProgress.total} assignments
              </span>
              <span className="text-sm text-gray-400">
                {applyProgress.total > 0 ? Math.round((applyProgress.done / applyProgress.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${applyProgress.total > 0 ? (applyProgress.done / applyProgress.total) * 100 : 0}%`,
                  backgroundColor: 'var(--cpt-color)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {!applying && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          bulkSpec={bulkSpec}
          onChange={setBulkSpec}
          onPreview={() => setShowPreview(true)}
          shiftAllTogether={shiftAllTogether}
          onShiftAllToggle={setShiftAllTogether}
          defaultShiftDays={defaultDateShiftDays}
        />
      )}

      {/* Preview modal */}
      {showPreview && (
        <Modal
          title="Preview Changes"
          onClose={() => setShowPreview(false)}
          size="lg"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowPreview(false)}>Cancel</button>
              <button className="btn-primary" onClick={applyChanges} disabled={applying}>
                {applying ? <><Loader size={14} className="animate-spin" /> Applying...</> : 'Confirm & Apply'}
              </button>
            </>
          }
        >
          <PreviewDiff changes={pendingChanges} />
        </Modal>
      )}

      {/* Result modal */}
      {applyResult && (
        <Modal
          title="Changes Applied"
          onClose={() => setApplyResult(null)}
          footer={<button className="btn-primary" onClick={() => setApplyResult(null)}>Done</button>}
        >
          <div className="space-y-4">
            {applyResult.succeeded.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                  <CheckCircle size={16} />
                  Successfully updated: {applyResult.succeeded.length} assignment{applyResult.succeeded.length !== 1 ? 's' : ''}
                </div>
                {applyResult.succeeded.map(id => {
                  const name = assignments.find(a => a.id === id)?.name ?? id
                  return <div key={id} className="pl-6 text-sm text-gray-700">{name}</div>
                })}
              </div>
            )}
            {applyResult.failed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                  <AlertCircle size={16} />
                  Failed: {applyResult.failed.length} assignment{applyResult.failed.length !== 1 ? 's' : ''}
                </div>
                {applyResult.failed.map(f => {
                  const name = assignments.find(a => a.id === f.id)?.name ?? f.id
                  return (
                    <div key={f.id} className="pl-6 text-sm text-gray-700">
                      {name} — <span className="text-red-600">{f.error}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Change log panel */}
      {showChangeLog && selectedCourseId && (
        <ChangeLog
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          onClose={() => setShowChangeLog(false)}
          onRevertComplete={() => selectCourse(selectedCourseId)}
        />
      )}
    </div>
  )
}

function DateRangeFilter({ label, value, onChange }) {
  const [open, setOpen] = useState(false)
  const isActive = !!(value.from || value.to)
  return (
    <div className="relative">
      <button
        className="btn-secondary text-sm"
        aria-expanded={open}
        aria-haspopup="true"
        style={isActive ? { borderColor: 'var(--cpt-color)', color: 'var(--cpt-color)', backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)' } : undefined}
        onClick={() => setOpen(o => !o)}
      >
        {label}{isActive ? ' ●' : ''}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3 min-w-[14rem]">
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                className="input text-sm w-full"
                value={value.from}
                max={value.to || undefined}
                onChange={e => onChange({ ...value, from: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                className="input text-sm w-full"
                value={value.to}
                min={value.from || undefined}
                onChange={e => onChange({ ...value, to: e.target.value })}
              />
            </div>
            {isActive && (
              <button
                className="text-xs text-gray-400 hover:text-gray-600 underline"
                onClick={() => { onChange(EMPTY_DATE_RANGE); setOpen(false) }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PointsRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const isActive = value.min !== '' || value.max !== ''
  return (
    <div className="relative">
      <button
        className="btn-secondary text-sm"
        aria-expanded={open}
        aria-haspopup="true"
        style={isActive ? { borderColor: 'var(--cpt-color)', color: 'var(--cpt-color)', backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)' } : undefined}
        onClick={() => setOpen(o => !o)}
      >
        Points{isActive ? ' ●' : ''}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3 min-w-[11rem]">
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min points</label>
              <input
                type="number"
                min="0"
                className="input text-sm w-full"
                value={value.min}
                placeholder="0"
                onChange={e => onChange({ ...value, min: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max points</label>
              <input
                type="number"
                min="0"
                className="input text-sm w-full"
                value={value.max}
                placeholder="Any"
                onChange={e => onChange({ ...value, max: e.target.value })}
              />
            </div>
            {isActive && (
              <button
                className="text-xs text-gray-400 hover:text-gray-600 underline"
                onClick={() => { onChange(EMPTY_POINTS_RANGE); setOpen(false) }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GroupFilter({ groups, selected, onChange }) {
  const [open, setOpen] = useState(false)
  if (groups.length === 0) return null
  return (
    <div className="relative">
      <button
        className="btn-secondary text-sm"
        style={selected.length > 0 ? {
          borderColor: 'var(--cpt-color)',
          color: 'var(--cpt-color)',
          backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)',
        } : undefined}
        onClick={() => setOpen(!open)}
      >
        Group{selected.length > 0 ? ` (${selected.length})` : ''}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] py-1">
          {groups.map(g => (
            <div
              key={g.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
              onClick={() => onChange(selected.includes(g.id) ? selected.filter(id => id !== g.id) : [...selected, g.id])}
            >
              <Checkbox
                checked={selected.includes(g.id)}
                onChange={() => onChange(selected.includes(g.id) ? selected.filter(id => id !== g.id) : [...selected, g.id])}
              />
              {g.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: 'rgba(var(--cpt-color-rgb), 0.1)',
        color: 'var(--cpt-color)',
        border: '1px solid rgba(var(--cpt-color-rgb), 0.2)',
      }}
    >
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="rounded-full p-0.5 hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{ outlineColor: 'var(--cpt-color)' }}
      >
        <X size={10} />
      </button>
    </span>
  )
}

function StatusFilter({ selected, onChange }) {
  const [open, setOpen] = useState(false)
  const options = [{ value: 'published', label: 'Published' }, { value: 'unpublished', label: 'Unpublished' }]
  return (
    <div className="relative">
      <button
        className="btn-secondary text-sm"
        style={selected.length > 0 ? {
          borderColor: 'var(--cpt-color)',
          color: 'var(--cpt-color)',
          backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)',
        } : undefined}
        onClick={() => setOpen(!open)}
      >
        Status{selected.length > 0 ? ` (${selected.length})` : ''}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px] py-1">
          {options.map(o => (
            <div
              key={o.value}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
              onClick={() => onChange(selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value])}
            >
              <Checkbox
                checked={selected.includes(o.value)}
                onChange={() => onChange(selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value])}
              />
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


