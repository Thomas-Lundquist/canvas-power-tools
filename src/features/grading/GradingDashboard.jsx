import { useState, useEffect, useMemo } from 'react'
import { Search, X, Loader, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import CourseSelector from '../../components/CourseSelector.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignmentsWithGradingData } from '../../api/submissions.js'

const FILTERS = [
  { id: 'all',           label: 'All' },
  { id: 'needs-grading', label: 'Needs Grading' },
  { id: 'fully-graded',  label: 'Fully Graded' },
  { id: 'has-missing',   label: 'Has Missing' },
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

export default function GradingDashboard({ initialCourseId }) {
  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(null)
  const [assignments, setAssignments]       = useState([])
  const [loading, setLoading]               = useState(false)
  const [search, setSearch]                 = useState('')
  const [filter, setFilter]                 = useState('all')
  const [sortKey, setSortKey]               = useState('position')
  const [sortDir, setSortDir]               = useState('asc')

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        const start = initialCourseId && list.find(c => c.id === String(initialCourseId))
          ? String(initialCourseId)
          : list[0]?.id ?? null
        if (start) loadData(start)
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  async function loadData(cId) {
    setCourseId(cId)
    setAssignments([])
    setLoading(true)
    try {
      const data = await getAssignmentsWithGradingData(cId)
      setAssignments(data)
    } finally {
      setLoading(false)
    }
  }

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

  // Summary stats derived from first assignment's submission summary
  const totalStudents = useMemo(() => {
    const s = assignments.find(a => a.submissionSummary)?.submissionSummary
    return s ? s.graded + s.ungraded + s.notSubmitted : null
  }, [assignments])

  const needsGradingCount = useMemo(
    () => assignments.filter(a => (a.submissionSummary?.ungraded ?? 0) > 0).length,
    [assignments],
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Grading Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Track submission and grading progress across all assignments.</p>
      </div>

      <div className="card p-4 mb-5 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600 shrink-0">Course</span>
        <CourseSelector courses={courses} selectedId={courseId} onChange={loadData} loading={loadingCourses} />
      </div>

      {/* Summary stats */}
      {!loading && assignments.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <StatCard label="Total Assignments" value={assignments.length} />
          <StatCard
            label="Need Grading"
            value={needsGradingCount}
            accent={needsGradingCount > 0}
          />
          <StatCard label="Enrolled Students" value={totalStudents ?? '—'} />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                filter === f.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
              style={filter === f.id ? { backgroundColor: 'var(--cpt-color)' } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
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
        {assignments.length > 0 && (
          <span className="text-sm text-gray-400 shrink-0">
            {filtered.length === assignments.length
              ? `${assignments.length} assignments`
              : `${filtered.length} of ${assignments.length}`}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden mb-4">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm p-6">
            <Loader size={14} className="animate-spin" /> Loading grading data...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-400 p-6">
            {assignments.length === 0
              ? 'No assignments found in this course.'
              : 'No assignments match the current filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={`${col.width} px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 ${
                        col.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''
                      }`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && (
                          sortKey === col.key
                            ? sortDir === 'asc' ? <ChevronUp size={12} style={{ color: 'var(--cpt-color)' }} /> : <ChevronDown size={12} style={{ color: 'var(--cpt-color)' }} />
                            : <ChevronsUpDown size={11} className="text-gray-300" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => {
                  const s = a.submissionSummary
                  const total = s ? s.graded + s.ungraded + s.notSubmitted : 0
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-900 truncate max-w-[14rem]" title={a.name}>
                        {a.name}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{a.assignmentGroupName ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{a.dueAt ? formatDate(a.dueAt) : '—'}</td>
                      <td className="px-3 py-3 text-sm">
                        {s ? <span className="font-medium text-green-700">{s.graded}{total > 0 && <span className="font-normal text-gray-400">/{total}</span>}</span> : '—'}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {s ? (
                          s.ungraded > 0
                            ? <span className="font-medium text-yellow-600">{s.ungraded}</span>
                            : <span className="text-gray-300">0</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {s ? (
                          s.notSubmitted > 0
                            ? <span className="font-medium text-red-500">{s.notSubmitted}</span>
                            : <span className="text-gray-300">0</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        {s && total > 0
                          ? <ProgressBar graded={s.graded} ungraded={s.ungraded} notSubmitted={s.notSubmitted} />
                          : <span className="text-xs text-gray-300">No data</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Graded</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-yellow-400 inline-block" /> Submitted, not graded</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gray-200 inline-block" /> Not submitted</span>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="card p-4">
      <div
        className={`text-2xl font-bold ${accent ? '' : 'text-gray-900'}`}
        style={accent ? { color: 'var(--cpt-color)' } : undefined}
      >
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
