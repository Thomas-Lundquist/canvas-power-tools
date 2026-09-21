import { useRef, useState, useLayoutEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, ChevronsUpDown, Home, Lock, History, Eye } from 'lucide-react'
import { formatDate } from '../../components/DateInput.jsx'
import { Checkbox } from '../../components/FormControls.jsx'
import Badge from '../../components/Badge.jsx'
import { formatEditingRoles, EDITOR_LABELS } from './pagesHelpers.js'

const COLUMNS = [
  { key: 'title',        label: 'Page',          width: 'w-72' },
  { key: 'published',    label: 'Status',        width: 'w-28' },
  { key: 'editingRoles', label: 'Who Can Edit',  width: 'w-44' },
  { key: 'editor',       label: 'Editor',        width: 'w-28' },
  { key: 'updatedAt',    label: 'Last Updated',  width: 'w-32' },
]

// Widths vary per skeleton row so placeholders look like real content
const SKELETON_WIDTHS = [
  ['w-52', 'w-20', 'w-32', 'w-20', 'w-24'],
  ['w-36', 'w-16', 'w-36', 'w-16', 'w-24'],
  ['w-60', 'w-20', 'w-28', 'w-20', 'w-20'],
  ['w-44', 'w-16', 'w-32', 'w-16', 'w-24'],
  ['w-56', 'w-20', 'w-40', 'w-20', 'w-24'],
  ['w-40', 'w-16', 'w-28', 'w-16', 'w-20'],
  ['w-48', 'w-20', 'w-36', 'w-20', 'w-24'],
  ['w-64', 'w-16', 'w-32', 'w-16', 'w-24'],
]

export default function PagesTable({
  pages, selectedIds, onToggle, onToggleAll, sortKey, sortDir, onSort,
  loading, onPreview, onRevisions, fillHeight = false, actionBarVisible = false,
}) {
  const allSelected = pages.length > 0 && pages.every(p => selectedIds.has(p.url))
  const someSelected = pages.some(p => selectedIds.has(p.url))

  const parentRef = useRef(null)
  const [skeletonRowCount, setSkeletonRowCount] = useState(SKELETON_WIDTHS.length)

  useLayoutEffect(() => {
    if (!loading || !parentRef.current) return
    const count = Math.ceil(parentRef.current.clientHeight / 48)
    setSkeletonRowCount(Math.max(count, 1))
  }, [loading])

  // count must stay 0 while loading — the skeleton/empty branches below don't read from the virtualizer
  const rowVirtualizer = useVirtualizer({
    count: loading ? 0 : pages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => parseFloat(getComputedStyle(document.documentElement).fontSize) * 3, // 3rem in px — adapts to user's text size setting
    overscan: 5,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0

  // +1 for the checkbox column, +1 for the per-row actions column
  const colSpan = COLUMNS.length + 2

  return (
    <div ref={parentRef} className={`overflow-auto ${fillHeight ? 'flex-1 min-h-0' : 'max-h-[34rem]'}`}>
      <table
        className="w-full min-w-[61.5rem] text-sm border-collapse table-fixed"
        role="grid"
        aria-label="Pages"
        aria-rowcount={pages.length}
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
                    ariaLabel="Select all pages"
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
            <th className="table-header-cell w-44 px-3 py-3 text-left font-medium text-sm text-[var(--color-text-secondary)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRowCount }, (_, i) => (
                <SkeletonRow key={i} widths={SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]} />
              ))
            : pages.length === 0
              ? (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-[var(--color-text-muted)] text-sm">
                    No pages match the current filters.
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
                    const page = pages[virtualRow.index]
                    return (
                      <PageRow
                        key={page.url}
                        page={page}
                        selected={selectedIds.has(page.url)}
                        onToggle={() => onToggle(page.url)}
                        onPreview={() => onPreview(page)}
                        onRevisions={() => onRevisions(page)}
                        rowIndex={virtualRow.index}
                      />
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td colSpan={colSpan} style={{ height: paddingBottom }} />
                    </tr>
                  )}
                  {actionBarVisible && (
                    <tr aria-hidden="true">
                      <td colSpan={colSpan} style={{ height: '14rem' }} />
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
      <td className="px-3 py-3.5">
        <div className="h-3.5 w-32 rounded bg-[var(--color-border)] animate-pulse" />
      </td>
    </tr>
  )
}

function PageRow({ page, selected, onToggle, onPreview, onRevisions, rowIndex }) {
  return (
    <tr
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
      <td className="py-3 align-middle" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center">
          <Checkbox checked={selected} onChange={onToggle} ariaLabel={`Select ${page.title}`} />
        </div>
      </td>

      <td className="px-3 py-3 align-middle font-medium text-[var(--color-text-body)]">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{page.title}</span>
          {page.frontPage && (
            <Home
              size={13}
              className="shrink-0 text-[var(--color-text-muted)]"
              aria-label="Front page"
            />
          )}
          {page.lockedForUser && (
            <Lock
              size={13}
              className="shrink-0 text-[var(--color-text-muted)]"
              aria-label={page.lockExplanation ?? 'Locked by a module requirement'}
            />
          )}
        </span>
      </td>

      <td className="px-3 py-3 align-middle">
        <Badge tone={page.published ? 'success' : 'neutral'}>
          {page.published ? 'Published' : 'Unpublished'}
        </Badge>
      </td>

      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">
        <span className="truncate block">{formatEditingRoles(page.editingRoles)}</span>
      </td>

      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">
        {EDITOR_LABELS[page.editor]}
      </td>

      <td className="px-3 py-3 align-middle text-[var(--color-text-secondary)]">
        {formatDate(page.updatedAt) || <span className="text-[var(--color-text-disabled)]">—</span>}
      </td>

      <td className="px-3 py-3 align-middle" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <RowAction
            icon={Eye}
            label="Preview"
            ariaLabel={`Preview ${page.title}`}
            onClick={onPreview}
          />
          <RowAction
            icon={History}
            label="Revisions"
            ariaLabel={`View and restore revisions of ${page.title}`}
            onClick={onRevisions}
          />
        </div>
      </td>
    </tr>
  )
}

function RowAction({ icon: Icon, label, ariaLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-control)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)] transition-colors duration-75"
      aria-label={ariaLabel}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </button>
  )
}

function SortIcon({ columnKey, sortKey, sortDir }) {
  if (sortKey !== columnKey) return <ChevronsUpDown size={12} className="text-[var(--color-text-disabled)]" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--cpt-color)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--cpt-color)' }} />
}
