import { Fragment, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, Eye, RotateCcw } from 'lucide-react'
import DateInput, { toDateInputValue } from '../../components/DateInput.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import IconButton from '../../components/IconButton.jsx'
import Badge from '../../components/Badge.jsx'
import { groupColorCss } from '../../utils/groupColors.js'

// Reads a staged value for one field. Returns undefined when the field has no
// pending edit, null when it was explicitly cleared, or a 'YYYY-MM-DD' string.
// The `field in bucket` test keeps "cleared to null" distinct from "untouched".
function pendingFor(bucket, field) {
  return bucket && field in bucket ? bucket[field] : undefined
}

const COLUMNS = [
  { key: 'name', label: 'Assignment', width: 'w-64' },
  { key: 'assignmentGroupName', label: 'Group', width: 'w-32' },
  { key: 'dueAt', label: 'Due Date', width: 'w-32' },
  { key: 'unlockAt', label: 'Available From', width: 'w-32' },
  { key: 'lockAt', label: 'Available Until', width: 'w-32' },
  { key: 'pointsPossible', label: 'Points', width: 'w-20' },
  { key: 'published', label: 'Status', width: 'w-24' },
]

// Widths vary per skeleton row so placeholders look like real content
const SKELETON_WIDTHS = [
  ['w-48', 'w-20', 'w-24', 'w-24', 'w-24', 'w-8',  'w-16'],
  ['w-32', 'w-24', 'w-24', 'w-28', 'w-20', 'w-8',  'w-20'],
  ['w-56', 'w-20', 'w-20', 'w-24', 'w-24', 'w-10', 'w-16'],
  ['w-40', 'w-28', 'w-24', 'w-24', 'w-28', 'w-8',  'w-20'],
  ['w-52', 'w-20', 'w-24', 'w-20', 'w-24', 'w-8',  'w-16'],
  ['w-36', 'w-24', 'w-28', 'w-24', 'w-24', 'w-10', 'w-20'],
  ['w-44', 'w-20', 'w-24', 'w-28', 'w-20', 'w-8',  'w-16'],
  ['w-60', 'w-24', 'w-24', 'w-24', 'w-24', 'w-8',  'w-20'],
]

// Accordion child-row height, in rem. Kept exact so the virtualizer's computed
// estimateSize matches what we actually render — otherwise expanded rows drift.
const SECTION_ROW_REM = 2.75

// Stable empty set so an assignment with no checked sections never gets a fresh
// reference each render (which would needlessly re-render its accordion).
const EMPTY_SET = new Set()

export default function AssignmentTable({ assignments, selectedIds, onToggle, onToggleAll, sortKey, sortDir, onSort, loading, groupColorTokens, sections = [], groups = [], tableEdits = {}, onEditDate, onEditField, onPreview, fillHeight = false, actionBarVisible = false }) {
  const allSelected = assignments.length > 0 && assignments.every(a => selectedIds.has(a.id))
  const someSelected = assignments.some(a => selectedIds.has(a.id))

  const parentRef = useRef(null)
  const [skeletonRowCount, setSkeletonRowCount] = useState(SKELETON_WIDTHS.length)

  // Which assignments have their per-section accordion open. Keyed by id so the
  // set survives re-sorts and re-filters. A course with one section has nothing
  // to break out, so expansion is only offered when sections.length > 1.
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const canExpand = sections.length > 1

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Which sections are checked, per assignment: Map<assignmentId, Set<sectionId>>.
  // Checked sections share date edits — editing one fills all of them.
  const [sectionSelection, setSectionSelection] = useState(() => new Map())

  function toggleSection(assignmentId, sectionId) {
    setSectionSelection(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(assignmentId))
      set.has(sectionId) ? set.delete(sectionId) : set.add(sectionId)
      set.size ? next.set(assignmentId, set) : next.delete(assignmentId)
      return next
    })
  }

  function toggleAllSections(assignmentId, selectAll) {
    setSectionSelection(prev => {
      const next = new Map(prev)
      if (selectAll) next.set(assignmentId, new Set(sections.map(s => s.id)))
      else next.delete(assignmentId)
      return next
    })
  }

  useLayoutEffect(() => {
    if (!loading || !parentRef.current) return
    const count = Math.ceil(parentRef.current.clientHeight / 48)
    setSkeletonRowCount(Math.max(count, 1))
  }, [loading])
  // count must stay 0 while loading — the skeleton/empty branches below don't read from the virtualizer
  const rowVirtualizer = useVirtualizer({
    count: loading ? 0 : assignments.length,
    getScrollElement: () => parentRef.current,
    // 3rem base row, plus one SECTION_ROW_REM child row per section when open.
    // Reads the live root font-size so it tracks the user's text-size setting.
    estimateSize: (index) => {
      const fontPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const a = assignments[index]
      const base = fontPx * 3
      if (!a || !expandedIds.has(a.id)) return base
      // +1 row for the accordion header (select-all + batch hint).
      return base + (sections.length + 1) * fontPx * SECTION_ROW_REM
    },
    overscan: 5,
  })

  // Re-measure when an accordion opens or closes so row offsets stay correct.
  useEffect(() => {
    if (!loading) rowVirtualizer.measure()
  }, [expandedIds, sections.length])
  // NOTE: only handles the design doc's "100-500 rows" virtual-scrolling tier.
  // The >500-row "virtual scrolling + group-based pagination" tier is not implemented.
  // The preview column is optional so the table keeps working for any caller
  // that has no content to show. +1 for the checkbox column.
  const showPreview = typeof onPreview === 'function'
  const colSpan = COLUMNS.length + 1 + (showPreview ? 1 : 0)

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0

  return (
    <div ref={parentRef} className={`overflow-auto ${fillHeight ? 'flex-1 min-h-0' : 'max-h-[34rem]'}`}>
      <table
        className={`w-full ${showPreview ? 'min-w-[67.5rem]' : 'min-w-[61.5rem]'} text-sm border-collapse table-fixed`}
        role="grid"
        aria-label="Assignments"
        aria-rowcount={assignments.length}
        aria-multiselectable="true"
      >
        <thead className="sticky top-0 z-10 bg-[var(--color-bg-page)] border-b border-[var(--color-border)]">
          <tr aria-rowindex={1} style={{ height: '3rem' }}>
            <th className="table-header-cell w-10 py-3 align-middle">
              {!loading && (
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={() => onToggleAll(!allSelected)}
                    ariaLabel="Select all assignments"
                  />
                </div>
              )}
            </th>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                className={`table-header-cell ${col.width} px-3 py-3 text-left font-medium text-sm text-[var(--color-text-secondary)] select-none ${loading ? '' : 'cursor-pointer hover:text-[var(--color-text-body)]'}`}
                onClick={() => !loading && onSort(col.key)}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {!loading && <SortIcon columnKey={col.key} sortKey={sortKey} sortDir={sortDir} />}
                </span>
              </th>
            ))}
            {showPreview && (
              <th className="table-header-cell w-24 px-3 py-3 text-left font-medium text-sm text-[var(--color-text-secondary)]">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRowCount }, (_, i) => (
                <SkeletonRow
                  key={i}
                  widths={SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}
                  showPreview={showPreview}
                />
              ))
            : assignments.length === 0
              ? (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-[var(--color-text-muted)] text-sm">
                    No assignments match the current filters.
                  </td>
                </tr>
              )
              : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={colSpan} style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualItems.map(virtualRow => {
                    const a = assignments[virtualRow.index]
                    const expanded = expandedIds.has(a.id)
                    const edits = tableEdits[a.id]
                    return (
                      <Fragment key={a.id}>
                        <AssignmentRow
                          assignment={a}
                          selected={selectedIds.has(a.id)}
                          onToggle={() => onToggle(a.id)}
                          rowIndex={virtualRow.index}
                          groupColor={groupColorCss(a.assignmentGroupId, groupColorTokens)}
                          onPreview={showPreview ? () => onPreview(a) : null}
                          canExpand={canExpand}
                          expanded={expanded}
                          onToggleExpand={() => toggleExpand(a.id)}
                          baseEdits={edits?.base}
                          fieldEdits={edits?.fields}
                          onEditDate={onEditDate}
                          onEditField={onEditField}
                          groups={groups}
                          groupColorTokens={groupColorTokens}
                        />
                        {expanded && (
                          <AccordionRows
                            assignment={a}
                            sections={sections}
                            colSpan={colSpan}
                            showPreview={showPreview}
                            sectionEdits={edits?.sections}
                            onEditDate={onEditDate}
                            selectedSections={sectionSelection.get(a.id) ?? EMPTY_SET}
                            onToggleSection={toggleSection}
                            onToggleAllSections={toggleAllSections}
                          />
                        )}
                      </Fragment>
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td colSpan={colSpan} style={{ height: paddingBottom }} />
                    </tr>
                  )}
                  {actionBarVisible && (
                    <tr aria-hidden="true">
                      <td colSpan={colSpan} style={{ height: '17rem' }} />
                    </tr>
                  )}
                </>
              )
          }
        </tbody>
      </table>
    </div>
  )
}

function SkeletonRow({ widths, showPreview = false }) {
  return (
    <tr className="border-b border-[var(--color-border-subtle)]">
      <td className="px-3 py-3.5">
        <div className="h-4 w-4 rounded bg-[var(--color-border)] animate-pulse" />
      </td>
      {widths.map((w, i) => (
        <td key={i} className="px-3 py-3.5">
          <div className={`h-3.5 ${w} rounded bg-[var(--color-border)] animate-pulse`} />
        </td>
      ))}
      {showPreview && (
        <td className="px-3 py-3.5">
          <div className="h-3.5 w-16 rounded bg-[var(--color-border)] animate-pulse" />
        </td>
      )}
    </tr>
  )
}

function AssignmentRow({ assignment: a, selected, onToggle, rowIndex, groupColor, onPreview, canExpand, expanded, onToggleExpand, baseEdits, fieldEdits, onEditDate, onEditField, groups, groupColorTokens }) {
  const trRef = useRef(null)
  const checkboxTdRef = useRef(null)

  // Effective values reflect staged field edits so the row previews the pending
  // state. The group color follows the pending group, not the saved one.
  const effectiveGroupId = fieldEdits && 'assignmentGroupId' in fieldEdits
    ? fieldEdits.assignmentGroupId
    : a.assignmentGroupId
  const effectivePublished = fieldEdits && 'published' in fieldEdits
    ? fieldEdits.published
    : a.published
  const groupEdited = fieldEdits && 'assignmentGroupId' in fieldEdits
  const publishedEdited = fieldEdits && 'published' in fieldEdits
  const effectiveGroupColor = groupEdited
    ? groupColorCss(effectiveGroupId, groupColorTokens)
    : groupColor

  return (
    <tr
      ref={trRef}
      className="border-b cursor-pointer transition-colors hover:bg-[var(--color-bg-hover)]"
      style={{
        height: '3rem',
        borderBottomColor: 'var(--color-border-subtle)',
        ...(selected ? {
          backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)',
          backgroundImage: 'linear-gradient(to right, var(--cpt-color) 2px, transparent 2px)',
        } : {}),
      }}
      onClick={onToggle}
      aria-rowindex={rowIndex + 2}
      aria-selected={selected}
      aria-expanded={canExpand ? expanded : undefined}
    >
      <td ref={checkboxTdRef} className="py-3 align-middle" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center">
          <Checkbox checked={selected} onChange={onToggle} ariaLabel={`Select ${a.name}`} />
        </div>
      </td>
      <td className="px-3 py-3 align-middle font-medium text-[var(--color-text-body)]">
        <span className="flex items-center gap-1.5 min-w-0">
          {canExpand ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggleExpand() }}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} section dates for ${a.name}`}
              className="shrink-0 grid place-items-center w-5 h-5 rounded-[var(--radius-control)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)] transition-colors duration-75"
            >
              <ChevronRight size={14} aria-hidden="true" className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="shrink-0 w-5" aria-hidden="true" />
          )}
          <span className="truncate">{a.name}</span>
        </span>
      </td>
      <td className="px-1.5 py-1 align-middle text-[var(--color-text-secondary)]" onClick={e => e.stopPropagation()}>
        <span className="flex items-center gap-1.5 max-w-full">
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-3 shrink-0 rounded-[var(--radius-sm)]"
            style={{ backgroundColor: effectiveGroupColor }}
          />
          <select
            value={effectiveGroupId ?? ''}
            onChange={e => onEditField(a.id, 'assignmentGroupId', e.target.value || null)}
            aria-label={`Assignment group for ${a.name}`}
            className={`input flex-1 min-w-0 text-sm !py-1 ${groupEdited ? 'ring-1 ring-[var(--cpt-color)]' : ''}`}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </span>
      </td>
      <EditableDateCell
        originalIso={a.dueAt}
        pending={pendingFor(baseEdits, 'dueAt')}
        onChange={v => onEditDate(a.id, 'base', 'dueAt', v)}
        ariaLabel={`Due date for ${a.name}`}
      />
      <EditableDateCell
        originalIso={a.unlockAt}
        pending={pendingFor(baseEdits, 'unlockAt')}
        onChange={v => onEditDate(a.id, 'base', 'unlockAt', v)}
        ariaLabel={`Available-from date for ${a.name}`}
      />
      <EditableDateCell
        originalIso={a.lockAt}
        pending={pendingFor(baseEdits, 'lockAt')}
        onChange={v => onEditDate(a.id, 'base', 'lockAt', v)}
        ariaLabel={`Available-until date for ${a.name}`}
      />
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{a.pointsPossible != null ? a.pointsPossible : <span className="text-[var(--color-text-disabled)]">—</span>}</td>
      <td className="px-1.5 py-1 align-middle" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onEditField(a.id, 'published', !effectivePublished)}
          aria-pressed={effectivePublished}
          aria-label={`${effectivePublished ? 'Unpublish' : 'Publish'} ${a.name}`}
          className={`inline-flex items-center rounded-[var(--radius-control)] ${publishedEdited ? 'ring-1 ring-[var(--cpt-color)]' : ''}`}
        >
          <Badge tone={effectivePublished ? 'success' : 'neutral'}>
            {effectivePublished ? 'Published' : 'Unpublished'}
          </Badge>
        </button>
      </td>
      {onPreview && (
        <td className="px-3 py-3 align-middle" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={onPreview}
            className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-control)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)] transition-colors duration-75"
            aria-label={`Preview ${a.name}`}
          >
            <Eye size={12} aria-hidden="true" />
            Preview
          </button>
        </td>
      )}
    </tr>
  )
}

// The per-assignment accordion body: one aligned row per course section.
// A section with its own assignment_override shows that override's dates; a
// section without one inherits the course-wide ("Everyone") dates, shown muted.
// Columns line up under the parent row: label spans Assignment + Group, then the
// three date columns, then an empty span for Points / Status / Actions.
function AccordionRows({ assignment: a, sections, colSpan, showPreview, sectionEdits, onEditDate, selectedSections, onToggleSection, onToggleAllSections }) {
  const restSpan = colSpan - 6 // 1 checkbox + 2 label + 3 dates = 6 fixed columns
  const allSecSelected = sections.length > 0 && sections.every(s => selectedSections.has(s.id))
  const someSecSelected = sections.some(s => selectedSections.has(s.id))
  const selCount = selectedSections.size

  // Edit one field. If the edited section is checked, the same value fans out to
  // every checked section — that is the batch mechanism. An unchecked section
  // edits only itself. Revert always stays single-target (see EditableDateCell).
  function editField(sectionId, field, value) {
    if (selectedSections.has(sectionId)) {
      selectedSections.forEach(sid => onEditDate(a.id, sid, field, value))
    } else {
      onEditDate(a.id, sectionId, field, value)
    }
  }

  return (
    <>
      {/* Accordion header: select-all + the batch hint. */}
      <tr
        style={{ height: `${SECTION_ROW_REM}rem`, backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)' }}
        className="border-b border-[var(--color-border-subtle)]"
      >
        <td className="align-middle" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-center">
            <Checkbox
              checked={allSecSelected}
              indeterminate={!allSecSelected && someSecSelected}
              onChange={() => onToggleAllSections(a.id, !allSecSelected)}
              ariaLabel={`Select all sections for ${a.name}`}
            />
          </div>
        </td>
        <td colSpan={2} className="pl-9 pr-3 align-middle">
          <span className="section-label !mb-0">Sections</span>
        </td>
        <td colSpan={3} className="px-3 align-middle text-xs text-[var(--color-text-muted)]">
          {selCount > 0
            ? `Editing a date fills all ${selCount} selected section${selCount !== 1 ? 's' : ''}.`
            : 'Check sections to edit several at once.'}
        </td>
        <td colSpan={restSpan} />
      </tr>

      {sections.map(s => {
        const override = a.overrides.find(o => String(o.courseSectionId) === String(s.id))
        // Where each field reads from today: an existing override uses its own
        // dates (nulls included); a section with no override inherits the base.
        const source = override ?? a
        const edits = sectionEdits?.[s.id]
        const touched = edits && Object.keys(edits).length > 0
        // "Inherited" only while the section still has no override and no staged
        // edit. Once the teacher touches it, it is becoming its own override.
        const inherited = !override && !touched
        const checked = selectedSections.has(s.id)

        return (
          <tr
            key={s.id}
            style={{
              height: `${SECTION_ROW_REM}rem`,
              backgroundColor: checked ? 'rgba(var(--cpt-color-rgb), 0.1)' : 'rgba(var(--cpt-color-rgb), 0.03)',
            }}
            className="border-b border-[var(--color-border-subtle)]"
          >
            <td className="align-middle" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={checked}
                  onChange={() => onToggleSection(a.id, s.id)}
                  ariaLabel={`Select section ${s.name} on ${a.name}`}
                />
              </div>
            </td>
            <td colSpan={2} className="pl-9 pr-3 align-middle truncate text-[var(--color-text-secondary)]">
              {s.name}
              {inherited && (
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">· inherited</span>
              )}
            </td>
            <EditableDateCell
              originalIso={source.dueAt}
              pending={pendingFor(edits, 'dueAt')}
              onChange={v => editField(s.id, 'dueAt', v)}
              onRevert={() => onEditDate(a.id, s.id, 'dueAt', toDateInputValue(source.dueAt) || null)}
              ariaLabel={`Due date for ${s.name} on ${a.name}`}
              muted={inherited}
            />
            <EditableDateCell
              originalIso={source.unlockAt}
              pending={pendingFor(edits, 'unlockAt')}
              onChange={v => editField(s.id, 'unlockAt', v)}
              onRevert={() => onEditDate(a.id, s.id, 'unlockAt', toDateInputValue(source.unlockAt) || null)}
              ariaLabel={`Available-from date for ${s.name} on ${a.name}`}
              muted={inherited}
            />
            <EditableDateCell
              originalIso={source.lockAt}
              pending={pendingFor(edits, 'lockAt')}
              onChange={v => editField(s.id, 'lockAt', v)}
              onRevert={() => onEditDate(a.id, s.id, 'lockAt', toDateInputValue(source.lockAt) || null)}
              ariaLabel={`Available-until date for ${s.name} on ${a.name}`}
              muted={inherited}
            />
            <td colSpan={restSpan} />
          </tr>
        )
      })}
    </>
  )
}

// One inline, staged date field. Shows the pending value when edited (ring +
// revert control), otherwise the current Canvas value. Clicks are stopped from
// bubbling so editing a date never toggles the row's selection.
function EditableDateCell({ originalIso, pending, onChange, onRevert, ariaLabel, muted = false }) {
  const edited = pending !== undefined
  const value = edited ? (pending ?? '') : (toDateInputValue(originalIso) || '')

  function revert() {
    // Passing the original back makes App's diff see "no change" and drop the
    // edit. onRevert lets a caller force a single-target revert even when a
    // plain edit would fan out to other checked sections.
    if (onRevert) onRevert()
    else onChange(toDateInputValue(originalIso) || null)
  }

  return (
    <td className="px-1.5 py-1 align-middle" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        <DateInput
          value={value}
          onChange={onChange}
          ariaLabel={ariaLabel}
          className={`flex-1 min-w-0 rounded-[var(--radius-control)] ${edited ? 'ring-1 ring-[var(--cpt-color)]' : ''} ${muted && !edited ? 'opacity-60' : ''}`}
        />
        {edited && (
          <IconButton
            icon={RotateCcw}
            label="Revert this date"
            size="sm"
            onClick={revert}
          />
        )}
      </div>
    </td>
  )
}

function SortIcon({ columnKey, sortKey, sortDir }) {
  if (sortKey !== columnKey) return <ChevronsUpDown size={12} className="text-[var(--color-text-disabled)]" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--cpt-color)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--cpt-color)' }} />
}
