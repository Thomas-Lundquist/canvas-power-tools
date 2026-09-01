import { useRef, useState, useLayoutEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatDate } from '../../components/DateInput.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import Badge from '../../components/Badge.jsx'
import { groupColorCss } from '../../utils/groupColors.js'

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

export default function AssignmentTable({ assignments, selectedIds, onToggle, onToggleAll, sortKey, sortDir, onSort, loading, groupColorTokens, fillHeight = false, actionBarVisible = false }) {
  const allSelected = assignments.length > 0 && assignments.every(a => selectedIds.has(a.id))
  const someSelected = assignments.some(a => selectedIds.has(a.id))

  const parentRef = useRef(null)
  const [skeletonRowCount, setSkeletonRowCount] = useState(SKELETON_WIDTHS.length)

  useLayoutEffect(() => {
    if (!loading || !parentRef.current) return
    const count = Math.ceil(parentRef.current.clientHeight / 48)
    setSkeletonRowCount(Math.max(count, 1))
  }, [loading])
  // count must stay 0 while loading — the skeleton/empty branches below don't read from the virtualizer
  const rowVirtualizer = useVirtualizer({
    count: loading ? 0 : assignments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => parseFloat(getComputedStyle(document.documentElement).fontSize) * 3, // 3rem in px — adapts to user's text size setting
    overscan: 5,
  })
  // NOTE: only handles the design doc's "100-500 rows" virtual-scrolling tier.
  // The >500-row "virtual scrolling + group-based pagination" tier is not implemented.
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0

  return (
    <div ref={parentRef} className={`overflow-auto ${fillHeight ? 'flex-1 min-h-0' : 'max-h-[34rem]'}`}>
      <table
        className="w-full min-w-[61.5rem] text-sm border-collapse table-fixed"
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
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRowCount }, (_, i) => (
                <SkeletonRow key={i} widths={SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]} />
              ))
            : assignments.length === 0
              ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="py-12 text-center text-[var(--color-text-muted)] text-sm">
                    No assignments match the current filters.
                  </td>
                </tr>
              )
              : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualItems.map(virtualRow => {
                    const a = assignments[virtualRow.index]
                    return (
                      <AssignmentRow
                        key={a.id}
                        assignment={a}
                        selected={selectedIds.has(a.id)}
                        onToggle={() => onToggle(a.id)}
                        rowIndex={virtualRow.index}
                        groupColor={groupColorCss(a.assignmentGroupId, groupColorTokens)}
                      />
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} style={{ height: paddingBottom }} />
                    </tr>
                  )}
                  {actionBarVisible && (
                    <tr aria-hidden="true">
                      <td colSpan={COLUMNS.length + 1} style={{ height: '14rem' }} />
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

function SkeletonRow({ widths }) {
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
    </tr>
  )
}

function AssignmentRow({ assignment: a, selected, onToggle, rowIndex, groupColor }) {
  const trRef = useRef(null)
  const checkboxTdRef = useRef(null)

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
    >
      <td ref={checkboxTdRef} className="py-3 align-middle" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center">
          <Checkbox checked={selected} onChange={onToggle} ariaLabel={`Select ${a.name}`} />
        </div>
      </td>
      <td className="px-3 py-3 align-middle font-medium text-[var(--color-text-body)] max-w-xs truncate">{a.name}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">
        <span className="inline-flex items-center gap-1.5 max-w-full">
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-3 shrink-0 rounded-[var(--radius-sm)]"
            style={{ backgroundColor: groupColor }}
          />
          <span className="truncate">{a.assignmentGroupName}</span>
        </span>
      </td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-body)]">{formatDate(a.dueAt) || <span className="text-[var(--color-text-disabled)]">—</span>}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{formatDate(a.unlockAt) || <span className="text-[var(--color-text-disabled)]">—</span>}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{formatDate(a.lockAt) || <span className="text-[var(--color-text-disabled)]">—</span>}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{a.pointsPossible != null ? a.pointsPossible : <span className="text-[var(--color-text-disabled)]">—</span>}</td>
      <td className="px-3 py-3 align-middle">
        <Badge tone={a.published ? 'success' : 'neutral'}>
          {a.published ? 'Published' : 'Unpublished'}
        </Badge>
      </td>
    </tr>
  )
}

function SortIcon({ columnKey, sortKey, sortDir }) {
  if (sortKey !== columnKey) return <ChevronsUpDown size={12} className="text-[var(--color-text-disabled)]" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--cpt-color)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--cpt-color)' }} />
}
