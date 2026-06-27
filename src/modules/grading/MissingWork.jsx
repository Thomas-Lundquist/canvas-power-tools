import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, Loader, CheckCircle } from 'lucide-react'
import CourseSelector from '../../components/CourseSelector.jsx'
import { getCourses } from '../../api/courses.js'
import { getCourseSubmissions, getAssignmentsWithGradingData, updateSubmissionGrade } from '../../api/submissions.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'

function daysSince(isoDate) {
  if (!isoDate) return null
  return Math.floor((Date.now() - new Date(isoDate)) / 86400000)
}

function ConfirmModal({ message, onConfirm, onCancel, confirming, progress }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <p className="text-sm text-gray-700">{message}</p>
        {confirming && progress && (
          <p className="text-xs text-gray-400">{progress}</p>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary text-sm" onClick={onCancel} disabled={confirming}>Cancel</button>
          <button className="btn-danger text-sm flex items-center gap-1.5" onClick={onConfirm} disabled={confirming}>
            {confirming && <Loader size={13} className="animate-spin" />}
            Grade as Zero
          </button>
        </div>
      </div>
    </div>
  )
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <div key={i} className="card p-4 flex items-center gap-4 animate-pulse">
      <div className="w-5 h-5 rounded bg-gray-200" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-40 bg-gray-200 rounded" />
        <div className="h-3 w-24 bg-gray-100 rounded" />
      </div>
      <div className="h-7 w-28 bg-gray-200 rounded" />
    </div>
  ))
}

export default function MissingWork() {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(null)
  const [courseName, setCourseName]         = useState('')
  const [assignments, setAssignments]       = useState([])
  const [missing, setMissing]               = useState([])   // filtered submissions
  const [loading, setLoading]               = useState(false)
  const [viewMode, setViewMode]             = useState('by-student')
  const [expanded, setExpanded]             = useState(new Set())
  const [confirm, setConfirm]               = useState(null)  // { message, rows }
  const [confirming, setConfirming]         = useState(false)
  const [progress, setProgress]             = useState('')

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) loadData(list[0].id, list[0].name)
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  async function loadData(cId, cName) {
    setCourseId(cId)
    setCourseName(cName ?? courses.find(c => c.id === cId)?.name ?? '')
    setMissing([])
    setAssignments([])
    setExpanded(new Set())
    setLoading(true)
    try {
      const [subs, asns] = await Promise.all([
        getCourseSubmissions(cId),
        getAssignmentsWithGradingData(cId),
      ])
      setAssignments(asns)
      setMissing(subs.filter(s => s.missing))
    } finally {
      setLoading(false)
    }
  }

  function handleCourseChange(cId) {
    const course = courses.find(c => c.id === cId)
    loadData(cId, course?.name ?? '')
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function gradeZero(rows, summary) {
    await requirePin({ action: 'grade_as_zero', summary, courseId, courseName }, async () => {
      setConfirming(true)
      let done = 0
      for (const row of rows) {
        await updateSubmissionGrade(courseId, row.assignmentId, row.userId, { posted_grade: '0' })
        done++
        if (rows.length > 1) setProgress(`${done} of ${rows.length} updated…`)
      }
      setConfirming(false)
      setConfirm(null)
      setProgress('')
      toast(`Graded ${rows.length === 1 ? 'submission' : `${rows.length} submissions`} as zero`, 'success')
      loadData(courseId, courseName)
    })
  }

  function openConfirm(rows, label) {
    setConfirm({
      message: `Grade ${rows.length === 1 ? 'this missing submission' : `${rows.length} missing submissions`} as zero${label ? ` for ${label}` : ''}? This cannot be undone.`,
      rows,
    })
  }

  // --- Grouped data ---
  const assignmentMap = useMemo(() => {
    const m = {}
    for (const a of assignments) m[a.id] = a
    return m
  }, [assignments])

  const byStudent = useMemo(() => {
    const m = {}
    for (const s of missing) {
      if (!m[s.userId]) m[s.userId] = { userId: s.userId, userName: s.userName, rows: [] }
      m[s.userId].rows.push(s)
    }
    return Object.values(m).sort((a, b) => (a.userName ?? '').localeCompare(b.userName ?? ''))
  }, [missing])

  const byAssignment = useMemo(() => {
    const m = {}
    for (const s of missing) {
      const asn = assignmentMap[s.assignmentId]
      if (!asn) continue
      if (!m[s.assignmentId]) m[s.assignmentId] = { assignmentId: s.assignmentId, name: asn.name, dueAt: asn.dueAt, rows: [] }
      m[s.assignmentId].rows.push(s)
    }
    return Object.values(m).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [missing, assignmentMap])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Missing Work</h1>
        <p className="text-sm text-gray-500 mt-1">View unsubmitted assignments and grade them as zero in bulk.</p>
      </div>

      <div className="card p-4 mb-5 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600 shrink-0">Course</span>
        <CourseSelector courses={courses} selectedId={courseId} onChange={handleCourseChange} loading={loadingCourses} />
      </div>

      {!loading && missing.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[['by-student', 'By Student'], ['by-assignment', 'By Assignment']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setViewMode(id); setExpanded(new Set()) }}
                className={`px-3 py-1.5 text-xs font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                  viewMode === id ? 'text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
                style={viewMode === id ? { backgroundColor: 'var(--cpt-color)' } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-400">{missing.length} missing submission{missing.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2"><SkeletonRows /></div>
      ) : missing.length === 0 ? (
        <div className="card p-12 text-center space-y-2">
          <CheckCircle size={32} className="mx-auto text-green-400" />
          <p className="font-medium text-gray-700">No missing submissions</p>
          <p className="text-sm text-gray-400">All students have submitted their work in this course.</p>
        </div>
      ) : viewMode === 'by-student' ? (
        <div className="space-y-2">
          {byStudent.map(group => {
            const open = expanded.has(group.userId)
            return (
              <div key={group.userId} className="card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(group.userId)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    aria-expanded={open}
                  >
                    {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                    <span className="font-medium text-gray-900 truncate">{group.userName ?? 'Unknown Student'}</span>
                    <span className="text-xs text-gray-400 shrink-0">{group.rows.length} missing</span>
                  </button>
                  <button
                    className="btn-danger text-xs shrink-0"
                    onClick={() => openConfirm(group.rows, group.userName)}
                  >
                    Grade All as Zero
                  </button>
                </div>
                {open && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {group.rows.map(row => {
                      const asn = assignmentMap[row.assignmentId]
                      const days = daysSince(asn?.dueAt)
                      return (
                        <div key={row.assignmentId} className="flex items-center gap-3 px-4 py-2.5 pl-10 bg-gray-50/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{asn?.name ?? row.assignmentId}</p>
                            {days !== null && (
                              <p className="text-xs text-gray-400">{days === 0 ? 'Due today' : `${days} day${days !== 1 ? 's' : ''} past due`}</p>
                            )}
                          </div>
                          <button
                            className="btn-danger text-xs shrink-0"
                            onClick={() => openConfirm([row], `${group.userName} — ${asn?.name}`)}
                          >
                            Grade as Zero
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {byAssignment.map(group => {
            const open = expanded.has(group.assignmentId)
            const days = daysSince(group.dueAt)
            return (
              <div key={group.assignmentId} className="card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(group.assignmentId)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    aria-expanded={open}
                  >
                    {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 truncate block">{group.name}</span>
                      {days !== null && (
                        <span className="text-xs text-gray-400">{days === 0 ? 'Due today' : `${days} day${days !== 1 ? 's' : ''} past due`}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{group.rows.length} student{group.rows.length !== 1 ? 's' : ''}</span>
                  </button>
                  <button
                    className="btn-danger text-xs shrink-0"
                    onClick={() => openConfirm(group.rows, group.name)}
                  >
                    Grade All as Zero
                  </button>
                </div>
                {open && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {group.rows.map(row => (
                      <div key={row.userId} className="flex items-center gap-3 px-4 py-2.5 pl-10 bg-gray-50/50">
                        <p className="text-sm text-gray-800 flex-1 truncate">{row.userName ?? 'Unknown Student'}</p>
                        <button
                          className="btn-danger text-xs shrink-0"
                          onClick={() => openConfirm([row], `${row.userName} — ${group.name}`)}
                        >
                          Grade as Zero
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          confirming={confirming}
          progress={progress}
          onConfirm={() => gradeZero(confirm.rows, confirm.message)}
          onCancel={() => !confirming && setConfirm(null)}
        />
      )}
    </div>
  )
}
