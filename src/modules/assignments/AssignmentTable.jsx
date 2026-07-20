import { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatDate } from '../../components/DateInput.jsx'
import { Checkbox } from '../../components/FormControls.jsx'

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

export default function AssignmentTable({ assignments, selectedIds, onToggle, onToggleAll, sortKey, sortDir, onSort, loading, fillHeight = false, actionBarVisible = false }) {
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
  // DEBUG: log scroll-container dimensions on every selection change — remove before ship
  useEffect(() => {
    if (!parentRef.current) return
    const { clientHeight, scrollHeight } = parentRef.current
    console.log('[DEBUG table] selectedIds.size=', selectedIds.size, '→ clientH=', clientHeight, 'scrollH=', scrollHeight)
  }, [selectedIds])

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
            <th className="w-10 px-3 flex items-center" style={{ height: '3rem' }}>
              {!loading && (
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onChange={() => onToggleAll(!allSelected)}
                  ariaLabel="Select all assignments"
                />
              )}
            </th>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                className={`${col.width} px-3 py-3 text-left font-medium text-xs text-[var(--color-text-secondary)] select-none ${loading ? '' : 'cursor-pointer hover:text-[var(--color-text-body)]'}`}
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

function AssignmentRow({ assignment: a, selected, onToggle, rowIndex }) {
  const trRef = useRef(null)
  const checkboxTdRef = useRef(null)
  const prevSel = useRef(selected)
  // DEBUG: log row and checkbox-cell positions on selection change — remove before ship
  useEffect(() => {
    if (prevSel.current !== selected) {
      const trRect = trRef.current?.getBoundingClientRect()
      const cbRect = checkboxTdRef.current?.getBoundingClientRect()
      console.log(
        `[DEBUG row ${rowIndex}] ${prevSel.current}→${selected}`,
        `| tr: h=${trRef.current?.offsetHeight} y=${trRect?.y.toFixed(2)}`,
        `| cb-td: x=${cbRect?.x.toFixed(2)} y=${cbRect?.y.toFixed(2)} w=${cbRect?.width.toFixed(2)} h=${cbRect?.height.toFixed(2)}`,
      )
      prevSel.current = selected
    }
  })

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
      <td ref={checkboxTdRef} className="px-3 flex items-center" style={{ height: '3rem' }} onClick={e => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggle} ariaLabel={`Select ${a.name}`} />
      </td>
      <td className="px-3 py-3 align-middle font-medium text-[var(--color-text-body)] max-w-xs truncate">{a.name}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{a.assignmentGroupName ?? '—'}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{formatDate(a.dueAt)}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{formatDate(a.unlockAt)}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{formatDate(a.lockAt)}</td>
      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">{a.pointsPossible ?? '—'}</td>
      <td className="px-3 py-3 align-middle">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${a.published ? 'bg-green-100 text-green-800' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'}`}>
          {a.published ? 'Published' : 'Unpublished'}
        </span>
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
