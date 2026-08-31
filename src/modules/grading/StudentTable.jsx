import { useState, useMemo } from 'react'
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import Card from '../../components/Card.jsx'

const COLUMNS = [
  { key: 'userSortableName', label: 'Student',  sortable: true,  align: 'left'  },
  { key: 'currentScore',     label: 'Overall',  sortable: true,  align: 'left'  },
  { key: 'missing',          label: 'Missing',  sortable: true,  align: 'left'  },
  { key: 'ungraded',         label: 'Ungraded', sortable: true,  align: 'left'  },
  { key: 'late',             label: 'Late',     sortable: true,  align: 'left'  },
]

const SKELETON_WIDTHS = [
  ['w-40', 'w-16', 'w-8', 'w-8', 'w-8'],
  ['w-32', 'w-20', 'w-6', 'w-6', 'w-6'],
  ['w-48', 'w-16', 'w-8', 'w-6', 'w-8'],
  ['w-36', 'w-20', 'w-6', 'w-8', 'w-6'],
  ['w-44', 'w-16', 'w-8', 'w-8', 'w-6'],
  ['w-52', 'w-20', 'w-6', 'w-6', 'w-8'],
]

// Overall-grade color band. Mirrors the success/warning/error tokens used in
// the assignment table so the two lenses read the same.
function scoreColor(score) {
  if (score == null) return 'var(--color-text-disabled)'
  if (score < 60) return 'var(--color-error)'
  if (score < 70) return 'var(--color-warning)'
  return 'var(--color-success)'
}

function countCell(n) {
  return n > 0
    ? <span className="font-medium text-[var(--color-text-body)]">{n}</span>
    : <span className="text-[var(--color-text-disabled)]">0</span>
}

function sortRows(rows, key, dir) {
  const m = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let av = a[key], bv = b[key]
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    return av < bv ? -m : av > bv ? m : 0
  })
}

function SkeletonRow({ widths }) {
  return (
    <tr className="border-b border-[var(--color-border-subtle)]">
      {widths.map((w, i) => (
        <td key={i} className="px-3 py-3.5">
          <div className={`h-3.5 ${w} rounded bg-[var(--color-border-subtle)] animate-pulse`} />
        </td>
      ))}
    </tr>
  )
}

export default function StudentTable({ summaries, loading, onSelectStudent }) {
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('userSortableName')
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let rows = summaries
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(s => (s.userName ?? '').toLowerCase().includes(q))
    }
    return sortRows(rows, sortKey, sortDir)
  }, [summaries, search, sortKey, sortDir])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students..."
            className="input pl-9"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        {!loading && summaries.length > 0 && (
          <span className="text-sm text-[var(--color-text-disabled)] shrink-0">
            {filtered.length === summaries.length
              ? `${summaries.length} students`
              : `${filtered.length} of ${summaries.length}`}
          </span>
        )}
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-page)] border-b border-[var(--color-border)]">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`table-header-cell px-3 py-3 text-left ${
                      col.sortable && !loading ? 'cursor-pointer select-none hover:text-[var(--color-text-secondary)]' : 'select-none'
                    }`}
                    onClick={col.sortable && !loading ? () => handleSort(col.key) : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && !loading && (
                        sortKey === col.key
                          ? sortDir === 'asc' ? <ChevronUp size={12} style={{ color: 'var(--cpt-color)' }} /> : <ChevronDown size={12} style={{ color: 'var(--cpt-color)' }} />
                          : <ChevronsUpDown size={11} className="text-[var(--color-text-disabled)]" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading
                ? SKELETON_WIDTHS.map((widths, i) => <SkeletonRow key={i} widths={widths} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="py-12 text-center text-[var(--color-text-muted)] text-sm">
                        {summaries.length === 0
                          ? 'No students found in this course.'
                          : 'No students match the search.'}
                      </td>
                    </tr>
                  )
                  : filtered.map(s => (
                    <tr
                      key={s.userId}
                      className="hover:bg-[var(--color-bg-hover)] cursor-pointer"
                      onClick={() => onSelectStudent(s)}
                    >
                      <td className="px-3 py-3 font-medium text-[var(--color-text-body)] truncate max-w-[16rem]" title={s.userName ?? ''}>
                        {s.userName ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {s.currentScore != null
                          ? <span className="font-medium" style={{ color: scoreColor(s.currentScore) }}>
                              {Math.round(s.currentScore)}%{s.currentGrade && <span className="font-normal text-[var(--color-text-disabled)]"> {s.currentGrade}</span>}
                            </span>
                          : <span className="text-[var(--color-text-disabled)]">—</span>}
                      </td>
                      <td className="px-3 py-3 text-sm">{countCell(s.missing)}</td>
                      <td className="px-3 py-3 text-sm">{countCell(s.ungraded)}</td>
                      <td className="px-3 py-3 text-sm">{countCell(s.late)}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
