import { useState, useEffect, useMemo } from 'react'
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown, CheckCircle2, Send, AlertTriangle, Clock } from 'lucide-react'
import Card from '../../components/Card.jsx'
import StatCard from '../../components/StatCard.jsx'
import SegmentedToggle from '../../components/SegmentedToggle.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { getAssignmentsWithGradingData } from '../../api/submissions.js'

const FILTERS = [
  { value: 'all',           label: 'All' },
  { value: 'needs-grading', label: 'Needs Grading' },
  { value: 'fully-graded',  label: 'Fully Graded' },
  { value: 'has-missing',   label: 'Has Missing' },
]

const COLUMNS = [
  { key: 'name',               label: 'Assignment',  sortable: true,  width: 'min-w-[14rem]' },
  { key: 'assignmentGroupName',label: 'Group',        sortable: true,  width: 'w-28' },
  { key: 'dueAt',              label: 'Due',          sortable: true,  width: 'w-28' },
  { key: '_graded',            label: 'Graded',       sortable: false, width: 'w-20' },
  { key: '_ungraded',          label: 'Ungraded',     sortable: false, width: 'w-20' },
  { key: '_missing',           label: 'Missing',      sortable: false, width: 'w-20' },
  { key: '_progress',          label: 'Progress',     sortable: false, width: 'w-44' },
]

const SKELETON_WIDTHS = [
  ['w-40', 'w-16', 'w-20', 'w-8',  'w-8',  'w-8',  'w-36'],
  ['w-32', 'w-20', 'w-20', 'w-6',  'w-6',  'w-6',  'w-28'],
  ['w-52', 'w-16', 'w-20', 'w-8',  'w-6',  'w-8',  'w-40'],
  ['w-36', 'w-20', 'w-20', 'w-8',  'w-8',  'w-6',  'w-32'],
  ['w-48', 'w-16', 'w-20', 'w-6',  'w-8',  'w-8',  'w-36'],
  ['w-44', 'w-20', 'w-20', 'w-8',  'w-6',  'w-6',  'w-44'],
]

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

export default function GradingDashboard({ courseId, loadingCourse }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState('all')
  const [sortKey, setSortKey]         = useState('position')
  const [sortDir, setSortDir]         = useState('asc')

  useEffect(() => {
    if (!courseId) { setAssignments([]); return }
    setLoading(true)
    getAssignmentsWithGradingData(courseId)
      .then(setAssignments)
      .finally(() => setLoading(false))
  }, [courseId])

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let rows = assignments
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(a => a.name.toLowerCase().includes(q))
    }
    if (filter === 'needs-grading') rows = rows.filter(a => (a.submissionSummary?.ungraded ?? 0) > 0)
    if (filter === 'fully-graded')  rows = rows.filter(a => {
      const s = a.submissionSummary
      if (!s) return false
      const total = s.graded + s.ungraded + s.notSubmitted
      return total > 0 && s.ungraded === 0 && s.notSubmitted === 0
    })
    if (filter === 'has-missing')   rows = rows.filter(a => (a.submissionSummary?.notSubmitted ?? 0) > 0)
    return sortRows(rows, sortKey, sortDir)
  }, [assignments, search, filter, sortKey, sortDir])

  const totals = useMemo(() => {
    let graded = 0, submitted = 0, missing = 0
    for (const a of assignments) {
      const s = a.submissionSummary
      if (!s) continue
      graded += s.graded
      submitted += s.graded + s.ungraded
      missing += s.notSubmitted
    }
    const dueSoon = assignments.filter(a => {
      if (!a.dueAt) return false
      const hrs = (new Date(a.dueAt) - Date.now()) / 3600000
      return hrs > 0 && hrs <= 48
    }).length
    return { graded, submitted, missing, dueSoon }
  }, [assignments])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Overview</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Track submission and grading progress across all assignments.</p>
      </div>

      {!loadingCourse && courseId && !loading && assignments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Graded" value={totals.graded} icon={CheckCircle2} style={{ borderTop: '4px solid var(--color-success)' }} />
          <StatCard label="Submitted" value={totals.submitted} icon={Send} style={{ borderTop: '4px solid var(--color-info)' }} />
          <StatCard label="Missing" value={totals.missing} icon={AlertTriangle} style={{ borderTop: '4px solid var(--color-error)' }} />
          <StatCard label="Due Soon" value={totals.dueSoon} hint="Within 48 hours" icon={Clock} style={{ borderTop: '4px solid var(--color-warning)' }} />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <SegmentedToggle options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter assignments" />
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assignments..."
            className="input pl-9"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        {assignments.length > 0 && (
          <span className="text-sm text-[var(--color-text-disabled)] shrink-0">
            {filtered.length === assignments.length
              ? `${assignments.length} assignments`
              : `${filtered.length} of ${assignments.length}`}
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
                    className={`table-header-cell ${col.width} px-3 py-3 text-left ${
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
              {!courseId || loading
                ? SKELETON_WIDTHS.map((widths, i) => <SkeletonRow key={i} widths={widths} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="py-12 text-center text-[var(--color-text-muted)] text-sm">
                        {assignments.length === 0
                          ? 'No assignments found in this course.'
                          : 'No assignments match the current filter.'}
                      </td>
                    </tr>
                  )
                  : filtered.map(a => {
                    const s = a.submissionSummary
                    const total = s ? s.graded + s.ungraded + s.notSubmitted : 0
                    return (
                      <tr key={a.id} className="hover:bg-[var(--color-bg-hover)]">
                        <td className="px-3 py-3 font-medium text-[var(--color-text-body)] truncate max-w-[14rem]" title={a.name}>
                          {a.name}
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--color-text-muted)]">{a.assignmentGroupName ?? '—'}</td>
                        <td className="px-3 py-3 text-xs text-[var(--color-text-muted)]">{a.dueAt ? formatDate(a.dueAt) : '—'}</td>
                        <td className="px-3 py-3 text-sm">
                          {s ? <span className="font-medium" style={{ color: 'var(--color-success)' }}>{s.graded}{total > 0 && <span className="font-normal text-[var(--color-text-disabled)]">/{total}</span>}</span> : '—'}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {s ? (
                            s.ungraded > 0
                              ? <span className="font-medium" style={{ color: 'var(--color-warning)' }}>{s.ungraded}</span>
                              : <span className="text-[var(--color-text-disabled)]">0</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {s ? (
                            s.notSubmitted > 0
                              ? <span className="font-medium" style={{ color: 'var(--color-error)' }}>{s.notSubmitted}</span>
                              : <span className="text-[var(--color-text-disabled)]">0</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          {s && total > 0
                            ? <ProgressBar graded={s.graded} ungraded={s.ungraded} notSubmitted={s.notSubmitted} />
                            : <span className="text-xs text-[var(--color-text-disabled)]">No data</span>}
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </Card>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-[var(--color-text-disabled)]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-[var(--radius-xs)]" style={{ background: 'var(--color-success)' }} /> Graded</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-[var(--radius-xs)]" style={{ background: 'var(--color-warning)' }} /> Submitted, not graded</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-[var(--radius-xs)] bg-[var(--color-border)]" /> Not submitted</span>
        </div>
      )}
    </div>
  )
}
