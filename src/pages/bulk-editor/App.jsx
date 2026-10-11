import { useState, useEffect, useMemo } from 'react'
import { BookOpen, FileText, SlidersHorizontal } from 'lucide-react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import Callout from '../../components/Callout.jsx'
import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import FilterBar from '../../modules/assignments/FilterBar.jsx'
import AssignmentTable from '../../modules/assignments/AssignmentTable.jsx'
import ChangeLog from '../../modules/assignments/ChangeLog.jsx'
import useSort from '../../utils/useSort.js'
import BulkActionBar, { INITIAL_ACTIONS } from '../../modules/assignments/BulkActionBar.jsx'
import PreviewDiff from '../../modules/assignments/PreviewDiff.jsx'
import DeleteAssignmentsModal from '../../modules/assignments/DeleteAssignmentsModal.jsx'
import CopyToCoursesModal from '../../components/CopyToCoursesModal.jsx'
import ContentPreview from '../../components/ContentPreview.jsx'
import { toDateInputValue } from '../../components/DateInput.jsx'
import { buildChangesFromInlineEdits } from '../../modules/assignments/bulkEditorHelpers.js'
import { useToast } from '../../components/Toast.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignments } from '../../api/assignments.js'
import { getAssignmentGroups } from '../../api/assignmentGroups.js'
import { getModules } from '../../api/modules.js'
import { getSections } from '../../api/sections.js'
import { getPreferences, setLastUsedCourse, resolveInitialCourseId } from '../../storage/preferences.js'
import { getGroupColorOverrides } from '../../storage/groupColors.js'
import { resolveGroupColorTokens } from '../../utils/groupColors.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../../utils/color.js'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'


function applyFilters(assignments, search, filters) {
  let result = assignments

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(a => a.name.toLowerCase().includes(q))
  }

  for (const filter of filters) {
    if (filter.id === 'group') {
      result = result.filter(a => a.assignmentGroupId === filter.value.value)
    }
    if (filter.id === 'module') {
      result = result.filter(a => a.moduleIds.includes(filter.value.value))
    }
    if (filter.id === 'status') {
      if (filter.value.value === 'published')   result = result.filter(a => a.published)
      if (filter.value.value === 'unpublished') result = result.filter(a => !a.published && !a.unlockAt)
      if (filter.value.value === 'scheduled')   result = result.filter(a => !a.published && !!a.unlockAt)
    }
    if (filter.id === 'type') {
      if (filter.value.value === 'quiz')       result = result.filter(a => a.submissionTypes.includes('online_quiz'))
      if (filter.value.value === 'discussion') result = result.filter(a => a.submissionTypes.includes('discussion_topic'))
      if (filter.value.value === 'page')       result = result.filter(a => a.submissionTypes.includes('not_graded'))
      if (filter.value.value === 'assignment') result = result.filter(a =>
        !a.submissionTypes.includes('online_quiz') &&
        !a.submissionTypes.includes('discussion_topic') &&
        !a.submissionTypes.includes('not_graded')
      )
    }
    if (filter.id === 'dueDate') {
      if (filter.value.mode === 'hasDate') result = result.filter(a => !!a.dueAt)
      if (filter.value.mode === 'noDate')  result = result.filter(a => !a.dueAt)
      if (filter.value.mode === 'range') {
        if (filter.value.from) result = result.filter(a => a.dueAt && a.dueAt.slice(0, 10) >= filter.value.from)
        if (filter.value.to)   result = result.filter(a => a.dueAt && a.dueAt.slice(0, 10) <= filter.value.to)
      }
    }
  }

  return result
}

// One-time read of deep-link params. The Assignment Groups tool sends teachers
// here (?courseId=&group=&selectAll=1) to move / delete / bulk-edit a group's
// assignments, since this tool owns selection, filtering, preview and per-row
// failure handling.
function readLaunchIntent() {
  const p = new URLSearchParams(window.location.search)
  const courseId = p.get('courseId')
  const groupId = p.get('group')
  if (!courseId && !groupId) return null
  return { courseId, groupId, selectAll: p.get('selectAll') === '1' }
}

const LAUNCH_INTENT = readLaunchIntent()

// Total number of staged inline edits across every assignment: base dates,
// per-section dates, and course-wide fields (status, group).
function countInlineEdits(edits) {
  let count = 0
  for (const id in edits) {
    const entry = edits[id]
    if (entry.base) count += Object.keys(entry.base).length
    if (entry.fields) count += Object.keys(entry.fields).length
    if (entry.sections) {
      for (const sectionId in entry.sections) count += Object.keys(entry.sections[sectionId]).length
    }
  }
  return count
}

export default function App() {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [selectedCourseName, setSelectedCourseName] = useState('')
  const [assignments, setAssignments] = useState([])
  const [groups, setGroups] = useState([])
  const [sections, setSections] = useState([])
  const [groupColorTokens, setGroupColorTokens] = useState(() => new Map())
  const [modules, setModules] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState([])
  const [showChangeLog, setShowChangeLog] = useState(false)

  const [selectedIds, setSelectedIds] = useState(new Set())
  // Per-assignment inline edits, staged (not written) until Preview/Apply. Shape:
  //   { [assignmentId]: {
  //       base:     { dueAt, unlockAt, lockAt },        // course-wide dates
  //       sections: { [sectionId]: { dueAt, ... } },    // per-section override dates
  //       fields:   { published, assignmentGroupId },   // course-wide non-date fields
  //   } }
  // A date value is 'YYYY-MM-DD' or null (cleared). A field value is its native
  // type. An absent key means the field is untouched.
  const [tableEdits, setTableEdits] = useState({})
  const [actions, setActions] = useState(INITIAL_ACTIONS)
  const [showPreview, setShowPreview] = useState(false)
  const [showInlinePreview, setShowInlinePreview] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [previewAssignment, setPreviewAssignment] = useState(null)

  const filteredAssignments = useMemo(
    () => applyFilters(assignments, search, filters),
    [assignments, search, filters],
  )

  const sort = useSort(filteredAssignments, { key: 'name', dir: 'asc' })

  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  useEffect(() => {
    async function init() {
      try {
        const [fetchedCourses, prefs] = await Promise.all([getCourses(), getPreferences()])
        applyPalette(prefs.palette)
        applyDarkMode(prefs.themeMode ?? 'system')
        applyTextSize(prefs.textSize ?? 'medium')
        setCourses(fetchedCourses)
        const initialId = resolveInitialCourseId(fetchedCourses, {
          override: LAUNCH_INTENT?.courseId,
          prefs,
        })
        if (initialId) selectCourse(initialId, fetchedCourses, LAUNCH_INTENT)
        // Consume the deep-link params so a manual refresh starts clean.
        if (LAUNCH_INTENT) window.history.replaceState({}, '', window.location.pathname)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingCourses(false)
      }
    }
    init()
  }, [])

  async function selectCourse(courseId, courseList = courses, intent = null) {
    const course = courseList.find(c => c.id === courseId)
    setSelectedCourseId(courseId)
    setSelectedCourseName(course?.name ?? '')
    setAssignments([])
    setGroups([])
    setSections([])
    setGroupColorTokens(new Map())
    setModules([])
    setSelectedIds(new Set())
    setTableEdits({})
    setActions(INITIAL_ACTIONS)
    setError(null)
    setSearch('')
    setFilters([])
    setLoadingAssignments(true)
    await setLastUsedCourse(courseId)
    try {
      const [fetchedAssignments, fetchedGroups, fetchedModules, colorOverrides, fetchedSections] = await Promise.all([
        getAssignments(courseId),
        getAssignmentGroups(courseId),
        getModules(courseId),
        getGroupColorOverrides(courseId),
        // A section-fetch failure must not block the whole tool — the target
        // selector simply stays hidden if we can't list sections.
        getSections(courseId).catch(() => []),
      ])
      setGroupColorTokens(resolveGroupColorTokens(fetchedGroups, colorOverrides))
      setSections(fetchedSections)
      const groupNameById = new Map(fetchedGroups.map(g => [g.id, g.name]))
      const assignmentsWithGroups = fetchedAssignments.map(a => ({
        ...a,
        assignmentGroupName: a.assignmentGroupName ?? groupNameById.get(a.assignmentGroupId) ?? null,
      }))
      setAssignments(assignmentsWithGroups)
      setGroups(fetchedGroups)
      setModules(fetchedModules)

      // Deep-link from the Assignment Groups tool: pre-filter to the group and
      // (optionally) pre-select every assignment in it, ready to move / delete.
      if (intent?.groupId) {
        const g = fetchedGroups.find(x => x.id === intent.groupId)
        if (g) {
          setFilters([{
            id: 'group',
            label: 'Assignment Group',
            value: { value: g.id },
            displayValue: g.name,
          }])
          if (intent.selectAll) {
            setSelectedIds(new Set(
              assignmentsWithGroups.filter(a => a.assignmentGroupId === g.id).map(a => a.id),
            ))
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAssignments(false)
    }
  }

  const selectedAssignments = useMemo(
    () => assignments.filter(a => selectedIds.has(a.id)),
    [assignments, selectedIds],
  )

  function clearSelection() {
    setSelectedIds(new Set())
    setActions(INITIAL_ACTIONS)
  }

  const inlineEditCount = useMemo(() => countInlineEdits(tableEdits), [tableEdits])

  // The staged inline edits, flattened to the diff shape Preview/Apply consume,
  // and the assignments they touch (Preview needs these for override lookups).
  const inlineChanges = useMemo(
    () => buildChangesFromInlineEdits(tableEdits, assignments, sections),
    [tableEdits, assignments, sections],
  )
  const inlineEditedAssignments = useMemo(
    () => assignments.filter(a => tableEdits[a.id]),
    [assignments, tableEdits],
  )

  function handleInlinePreviewDone() {
    setShowInlinePreview(false)
    setTableEdits({})
    selectCourse(selectedCourseId)
  }

  function handleInlineViewReport() {
    setShowInlinePreview(false)
    setTableEdits({})
    selectCourse(selectedCourseId)
    setShowChangeLog(true)
  }

  // Stage (or un-stage) one inline date edit. Writes nothing to Canvas — the
  // edit joins the pending set that Preview later turns into a batch. Setting a
  // field back to its current Canvas value drops the edit, so the pending count
  // only ever reflects real deltas.
  function editDate(assignmentId, target, field, newValue) {
    const a = assignments.find(x => x.id === assignmentId)
    if (!a) return

    let originalIso
    if (target === 'base') {
      originalIso = a[field] ?? null
    } else {
      const override = a.overrides.find(o => String(o.courseSectionId) === String(target))
      // A section with no override inherits the base date as its starting point.
      originalIso = override ? (override[field] ?? null) : (a[field] ?? null)
    }
    const originalDateOnly = originalIso ? toDateInputValue(originalIso) : ''
    const normalized = newValue || ''

    setTableEdits(prev => {
      const next = { ...prev }
      const entry = {
        base: { ...next[assignmentId]?.base },
        sections: { ...next[assignmentId]?.sections },
        fields: { ...next[assignmentId]?.fields },
      }
      const bucket = target === 'base'
        ? entry.base
        : (entry.sections[target] = { ...entry.sections[target] })

      if (normalized === originalDateOnly) {
        delete bucket[field]
      } else {
        bucket[field] = normalized === '' ? null : normalized
      }

      if (target !== 'base' && Object.keys(entry.sections[target]).length === 0) {
        delete entry.sections[target]
      }
      const empty = Object.keys(entry.base).length === 0
        && Object.keys(entry.sections).length === 0
        && Object.keys(entry.fields).length === 0
      if (empty) delete next[assignmentId]
      else next[assignmentId] = entry
      return next
    })
  }

  // Stage one course-wide, non-date field edit (status or group). Same staging
  // rules as dates: setting a field back to its current Canvas value drops it.
  function editField(assignmentId, field, newValue) {
    const a = assignments.find(x => x.id === assignmentId)
    if (!a) return
    const original = a[field]

    setTableEdits(prev => {
      const next = { ...prev }
      const entry = {
        base: { ...next[assignmentId]?.base },
        sections: { ...next[assignmentId]?.sections },
        fields: { ...next[assignmentId]?.fields },
      }

      if (newValue === original) delete entry.fields[field]
      else entry.fields[field] = newValue

      const empty = Object.keys(entry.base).length === 0
        && Object.keys(entry.sections).length === 0
        && Object.keys(entry.fields).length === 0
      if (empty) delete next[assignmentId]
      else next[assignmentId] = entry
      return next
    })
  }

  function discardInlineEdits() {
    setTableEdits({})
  }

  function handlePreviewDone() {
    setShowPreview(false)
    clearSelection()
    selectCourse(selectedCourseId)
  }

  function handleViewReport() {
    setShowPreview(false)
    clearSelection()
    selectCourse(selectedCourseId)
    setShowChangeLog(true)
  }

  function handleDeleted(deletedIds) {
    const gone = new Set(deletedIds)
    setAssignments(prev => prev.filter(a => !gone.has(a.id)))
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const id of gone) next.delete(id)
      return next
    })
    setActions(INITIAL_ACTIONS)
    toast(`${deletedIds.length} assignment${deletedIds.length !== 1 ? 's' : ''} deleted`, 'success')
  }

  function clearFilters() {
    setSearch('')
    setFilters([])
  }

  function addFilter(filter) {
    setFilters(prev => [...prev, filter])
  }

  function updateFilter(updated) {
    setFilters(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  function removeFilter(id) {
    setFilters(prev => prev.filter(f => f.id !== id))
  }

  function toggleSelection(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllSelection(selectAll) {
    setSelectedIds(selectAll ? new Set(filteredAssignments.map(a => a.id)) : new Set())
  }

  function renderContent() {
    if (loadingCourses) {
      return (
        <Card
          padding="none"
          className="domain-accent flex-1 flex flex-col min-h-0 overflow-hidden mx-6 mt-4 mb-4 shadow-[var(--shadow-md)]"
          style={{ '--domain-color': 'var(--color-domain-assignments)' }}
        >
          <AssignmentTable
            assignments={[]}
            selectedIds={new Set()}
            onToggle={() => {}}
            onToggleAll={() => {}}
            sortKey=""
            sortDir="asc"
            onSort={() => {}}
            onPreview={() => {}}
            loading
            fillHeight
          />
        </Card>
      )
    }

    if (error) {
      return (
        <div className="px-6 py-4">
          <Callout tone="error" title="Something went wrong">
            {error}
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectedCourseId ? selectCourse(selectedCourseId) : window.location.reload()}
              >
                Try again
              </Button>
            </div>
          </Callout>
        </div>
      )
    }

    if (!selectedCourseId) {
      return (
        <EmptyState
          icon={BookOpen}
          title="Select a course to get started"
          body="Choose a course from the menu above to load its assignments."
        />
      )
    }

    if (!loadingAssignments && assignments.length === 0) {
      return <EmptyState icon={FileText} title="No assignments in this course" />
    }

    return (
      <Card
        padding="none"
        className="domain-accent flex-1 flex flex-col min-h-0 overflow-hidden mx-6 mt-4 mb-4 shadow-[var(--shadow-md)]"
        style={{ '--domain-color': 'var(--color-domain-assignments)' }}
      >
        {!loadingAssignments && (
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            groups={groups}
            modules={modules}
            onAddFilter={addFilter}
            onUpdateFilter={updateFilter}
            onRemoveFilter={removeFilter}
            onClearAll={clearFilters}
            onChangeLogClick={() => setShowChangeLog(true)}
            showChangeLog
          />
        )}
        {inlineEditCount > 0 && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2 bg-[rgba(var(--cpt-color-rgb),0.08)] border-b border-[var(--color-border)]"
            role="status"
          >
            <span className="text-sm text-[var(--color-text-body)]">
              {inlineEditCount} pending edit{inlineEditCount !== 1 ? 's' : ''} in the table
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={discardInlineEdits}>
                Discard all
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowInlinePreview(true)}
                disabled={inlineChanges.length === 0}
              >
                Preview edits →
              </Button>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!loadingAssignments && filteredAssignments.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="No assignments match your filters"
              body="Try adjusting your search or removing a filter."
              actions={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <AssignmentTable
              assignments={loadingAssignments ? [] : sort.sorted}
              selectedIds={selectedIds}
              onToggle={toggleSelection}
              onToggleAll={toggleAllSelection}
              sortKey={sort.key}
              sortDir={sort.dir}
              onSort={sort.onSort}
              loading={loadingAssignments}
              groupColorTokens={groupColorTokens}
              sections={sections}
              groups={groups}
              tableEdits={tableEdits}
              onEditDate={editDate}
              onEditField={editField}
              onPreview={setPreviewAssignment}
              fillHeight
              actionBarVisible={selectedIds.size > 0}
            />
          )}
        </div>
      </Card>
    )
  }

  return (
    <>
      <SkipLink />
      <ToolShell
        start={
          <>
            <BrandLogo />
            <div className="w-px h-5 bg-[var(--color-border)] shrink-0" aria-hidden="true" />
            <CourseSelector
              courses={courses}
              selectedId={selectedCourseId}
              onChange={id => selectCourse(id)}
              loading={loadingCourses}
            />
          </>
        }
        end={
          <>
            <AppNav current="bulk-editor" />
            <SettingsButton />
          </>
        }
      >
        <div className="relative flex-1 flex min-h-0">
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {renderContent()}
            {/* Inside the table column, not the viewport: the bar then sizes to the
                space left of the preview pane without being told how wide it is. */}
            <BulkActionBar
              selectedCount={selectedIds.size}
              actions={actions}
              onActionsChange={setActions}
              onPreview={() => setShowPreview(true)}
              onClearAll={clearSelection}
              onCopyTo={() => setShowCopyModal(true)}
              onDelete={() => setShowDeleteModal(true)}
              groups={groups}
              sections={sections}
            />
          </div>
          {previewAssignment && (
            <ContentPreview
              title={previewAssignment.name}
              subtitle={previewAssignment.published ? 'Published' : 'Unpublished'}
              html={previewAssignment.description}
              emptyNote="This assignment has no description."
              onClose={() => setPreviewAssignment(null)}
            />
          )}
        </div>
      </ToolShell>
      {showPreview && (
        <PreviewDiff
          selectedAssignments={selectedAssignments}
          actions={actions}
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          groups={groups}
          sections={sections}
          onCancel={() => setShowPreview(false)}
          onDone={handlePreviewDone}
          onViewReport={handleViewReport}
        />
      )}
      {showInlinePreview && (
        <PreviewDiff
          selectedAssignments={inlineEditedAssignments}
          changes={inlineChanges}
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          groups={groups}
          sections={sections}
          onCancel={() => setShowInlinePreview(false)}
          onDone={handleInlinePreviewDone}
          onViewReport={handleInlineViewReport}
        />
      )}
      {showCopyModal && (
        <CopyToCoursesModal
          assignments={selectedAssignments}
          sourceCourseId={selectedCourseId}
          onClose={() => setShowCopyModal(false)}
        />
      )}
      {showDeleteModal && (
        <DeleteAssignmentsModal
          assignments={selectedAssignments}
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleDeleted}
        />
      )}
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} context="bulk-editor" />}
      {showChangeLog && (
        <ChangeLog
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          onClose={() => setShowChangeLog(false)}
          onRevertComplete={() => selectCourse(selectedCourseId)}
        />
      )}
    </>
  )
}
