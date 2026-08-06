import { useState, useEffect, useMemo } from 'react'
import { Loader } from 'lucide-react'
import CourseSelector from '../../components/CourseSelector.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { formatDate, toDateInputValue, toIsoDate } from '../../components/DateInput.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignmentsWithGradingData, getAssignmentSubmissions } from '../../api/submissions.js'
import { getSections } from '../../api/sections.js'
import { getAssignmentOverrides, createSectionOverride, updateSectionOverride } from '../../api/overrides.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'

// ── Preview Modal ───────────────────────────────────────────────────────────

function PreviewModal({ rows, assignmentName, onConfirm, onCancel, applying, progress }) {
  const changed = rows.filter(r => r.changed)
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-bg-surface)] rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="px-6 pt-5 pb-4 border-b border-[var(--color-border-subtle)] shrink-0">
          <h3 className="font-semibold text-[var(--color-text-body)]">Preview Section Overrides</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{assignmentName} · {changed.length} section{changed.length !== 1 ? 's' : ''} will change</p>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Section</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Current Due</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">New Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {rows.map(r => (
                <tr key={r.sectionId} className={r.changed ? '' : 'opacity-40'}>
                  <td className="px-4 py-2.5 text-[var(--color-text-body)]">{r.sectionName}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{r.currentDue ? formatDate(r.currentDue) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-[var(--color-text-body)]">{r.newDue ? formatDate(r.newDue) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-[var(--color-border-subtle)] shrink-0">
          {applying && <p className="text-xs text-[var(--color-text-disabled)] mb-3">{progress}</p>}
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={onCancel} disabled={applying}>Cancel</button>
            <button className="btn-primary flex items-center gap-1.5" onClick={onConfirm} disabled={applying || changed.length === 0}>
              {applying ? <><Loader size={13} className="animate-spin" /> Applying…</> : `Apply ${changed.length} Override${changed.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Set Due Dates sub-view ──────────────────────────────────────────────────

function SetDueDates({ courseId, courseName, courses }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [assignments, setAssignments]       = useState([])
  const [loadingAsn, setLoadingAsn]         = useState(false)
  const [assignmentId, setAssignmentId]     = useState('')
  const [sections, setSections]             = useState([])
  const [overrides, setOverrides]           = useState([])  // existing overrides for this assignment
  const [loadingData, setLoadingData]       = useState(false)
  const [sectionDates, setSectionDates]     = useState({})  // sectionId → dateStr
  const [unlockDate, setUnlockDate]         = useState('')
  const [lockDate, setLockDate]             = useState('')
  const [showPreview, setShowPreview]       = useState(false)
  const [applying, setApplying]             = useState(false)
  const [progress, setProgress]             = useState('')

  useEffect(() => {
    if (!courseId) return
    setLoadingAsn(true)
    getAssignmentsWithGradingData(courseId)
      .then(data => {
        setAssignments(data)
        if (data.length > 0) loadSectionData(courseId, data[0].id, data[0])
      })
      .finally(() => setLoadingAsn(false))
  }, [courseId])

  async function loadSectionData(cId, aId, assignment) {
    setAssignmentId(aId)
    setLoadingData(true)
    setOverrides([])
    setSectionDates({})
    try {
      const [secs, ovrs] = await Promise.all([
        getSections(cId),
        getAssignmentOverrides(cId, aId),
      ])
      setSections(secs)
      setOverrides(ovrs)
      // Pre-fill section dates from existing section overrides or standard due date
      const dates = {}
      for (const sec of secs) {
        const existing = ovrs.find(o => o.courseSectionId === sec.id)
        dates[sec.id] = toDateInputValue(existing?.dueAt ?? assignment?.dueAt ?? null)
      }
      setSectionDates(dates)
      setUnlockDate(toDateInputValue(assignment?.unlockAt ?? null))
      setLockDate(toDateInputValue(assignment?.lockAt ?? null))
    } finally {
      setLoadingData(false)
    }
  }

  const selectedAssignment = useMemo(
    () => assignments.find(a => a.id === assignmentId) ?? null,
    [assignments, assignmentId],
  )

  const previewRows = useMemo(() => {
    if (!selectedAssignment || sections.length === 0) return []
    return sections.map(sec => {
      const existing = overrides.find(o => o.courseSectionId === sec.id)
      const currentDue = existing?.dueAt ?? selectedAssignment.dueAt
      const newDue = toIsoDate(sectionDates[sec.id] ?? '')
      return {
        sectionId:   sec.id,
        sectionName: sec.name,
        overrideId:  existing?.id ?? null,
        currentDue,
        newDue,
        changed:     newDue !== currentDue,
      }
    })
  }, [sections, overrides, sectionDates, selectedAssignment])

  async function handleApply() {
    const changed = previewRows.filter(r => r.changed)
    if (!changed.length || !selectedAssignment) return
    const summary = `Set section due dates for "${selectedAssignment.name}" in ${courseName}`
    await requirePin({ action: 'section_override', summary, courseId, courseName }, async () => {
      setApplying(true)
      let done = 0
      const dates = { dueAt: null, unlockAt: toIsoDate(unlockDate) || null, lockAt: toIsoDate(lockDate) || null }
      for (const row of changed) {
        const rowDates = { ...dates, dueAt: row.newDue }
        if (row.overrideId) {
          await updateSectionOverride(courseId, selectedAssignment.id, row.overrideId, rowDates)
        } else {
          await createSectionOverride(courseId, selectedAssignment.id, row.sectionId, rowDates)
        }
        done++
        setProgress(`${done} of ${changed.length} applied…`)
      }
      setApplying(false)
      setProgress('')
      setShowPreview(false)
      toast(`Updated ${changed.length} section override${changed.length !== 1 ? 's' : ''}`, 'success')
      loadSectionData(courseId, assignmentId, selectedAssignment)
    })
  }

  return (
    <div className="space-y-5">
      {/* Assignment picker */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0 w-24">Assignment</span>
          {loadingAsn ? (
            <span className="text-sm text-[var(--color-text-disabled)] flex items-center gap-1.5"><Loader size={13} className="animate-spin" /> Loading…</span>
          ) : (
            <select
              className="input text-sm flex-1"
              value={assignmentId}
              onChange={e => {
                const a = assignments.find(x => x.id === e.target.value)
                loadSectionData(courseId, e.target.value, a)
              }}
              disabled={assignments.length === 0}
            >
              {assignments.length === 0
                ? <option>No assignments found</option>
                : assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
              }
            </select>
          )}
        </div>
      </div>

      {/* Section date table */}
      {assignmentId && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
            <p className="text-sm font-semibold text-[var(--color-text-body)]">Due Date Per Section</p>
            {selectedAssignment?.dueAt && (
              <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">Standard due: {formatDate(selectedAssignment.dueAt)}</p>
            )}
          </div>
          {loadingData ? (
            <div className="flex items-center gap-2 py-8 px-4 text-[var(--color-text-disabled)] text-sm justify-center">
              <Loader size={14} className="animate-spin" /> Loading sections…
            </div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)] py-8 text-center">No sections found in this course.</p>
          ) : (
            <>
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {sections.map(sec => (
                  <div key={sec.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-body)]">{sec.name}</p>
                      <p className="text-xs text-[var(--color-text-disabled)]">{sec.studentCount} student{sec.studentCount !== 1 ? 's' : ''}</p>
                    </div>
                    <input
                      type="date"
                      className="input text-sm w-40"
                      value={sectionDates[sec.id] ?? ''}
                      onChange={e => setSectionDates(prev => ({ ...prev, [sec.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              {/* Shared unlock/lock dates */}
              <div className="border-t border-[var(--color-border-subtle)] px-4 py-4 space-y-3 bg-[var(--color-bg-hover)]">
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Shared for all sections (optional)</p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="w-28 shrink-0">Available from</span>
                    <input type="date" className="input text-sm w-40" value={unlockDate} onChange={e => setUnlockDate(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="w-28 shrink-0">Available until</span>
                    <input type="date" className="input text-sm w-40" value={lockDate} onChange={e => setLockDate(e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 flex justify-end">
                <button
                  className="btn-primary"
                  disabled={loadingData || previewRows.every(r => !r.changed)}
                  onClick={() => setShowPreview(true)}
                >
                  Preview Changes
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showPreview && selectedAssignment && (
        <PreviewModal
          rows={previewRows}
          assignmentName={selectedAssignment.name}
          applying={applying}
          progress={progress}
          onConfirm={handleApply}
          onCancel={() => !applying && setShowPreview(false)}
        />
      )}
    </div>
  )
}

// ── Grade Comparison sub-view ───────────────────────────────────────────────

function GradeComparison({ courseId }) {
  const [assignments, setAssignments]   = useState([])
  const [loadingAsn, setLoadingAsn]     = useState(false)
  const [assignmentId, setAssignmentId] = useState('')
  const [sections, setSections]         = useState([])
  const [submissions, setSubmissions]   = useState([])
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    if (!courseId) return
    setLoadingAsn(true)
    Promise.all([
      getAssignmentsWithGradingData(courseId),
      getSections(courseId),
    ]).then(([asns, secs]) => {
      setAssignments(asns)
      setSections(secs)
      if (asns.length > 0) loadComparison(courseId, asns[0].id, secs)
    }).finally(() => setLoadingAsn(false))
  }, [courseId])

  async function loadComparison(cId, aId, secs) {
    setAssignmentId(aId)
    setSubmissions([])
    setLoading(true)
    try {
      const subs = await getAssignmentSubmissions(cId, aId)
      setSubmissions(subs.filter(s => s.score !== null))
    } finally {
      setLoading(false)
    }
  }

  const selectedAssignment = assignments.find(a => a.id === assignmentId) ?? null

  const sectionStats = useMemo(() => {
    if (!selectedAssignment || sections.length === 0) return []
    const max = selectedAssignment.pointsPossible
    return sections.map(sec => {
      const secSubs = submissions.filter(s => sec.studentIds.includes(s.userId))
      if (secSubs.length === 0) return { ...sec, avg: null, count: 0 }
      const avg = secSubs.reduce((sum, s) => sum + s.score, 0) / secSubs.length
      return { ...sec, avg: Math.round(avg * 10) / 10, avgPct: max > 0 ? Math.round((avg / max) * 100) : null, count: secSubs.length }
    })
  }, [sections, submissions, selectedAssignment])

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0 w-24">Assignment</span>
          {loadingAsn ? (
            <span className="text-sm text-[var(--color-text-disabled)] flex items-center gap-1.5"><Loader size={13} className="animate-spin" /> Loading…</span>
          ) : (
            <select
              className="input text-sm flex-1"
              value={assignmentId}
              onChange={e => loadComparison(courseId, e.target.value, sections)}
              disabled={assignments.length === 0}
            >
              {assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {assignmentId && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
            <p className="text-sm font-semibold text-[var(--color-text-body)]">Grade Distribution by Section</p>
            <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">Read-only — no data is written</p>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-8 px-4 text-[var(--color-text-disabled)] text-sm justify-center">
              <Loader size={14} className="animate-spin" /> Loading submissions…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Section</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Students Graded</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Avg Score</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Avg %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {sectionStats.map(sec => (
                  <tr key={sec.id}>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-body)]">{sec.name}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-muted)]">{sec.count}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-body)]">{sec.avg ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {sec.avgPct !== null
                        ? <span className={`font-medium ${sec.avgPct >= 70 ? 'text-[var(--color-success)]' : sec.avgPct >= 60 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}`}>{sec.avgPct}%</span>
                        : <span className="text-[var(--color-text-disabled)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

const VIEWS = [
  { id: 'due-dates',   label: 'Set Section Due Dates' },
  { id: 'comparison',  label: 'Grade Comparison' },
]

export default function SectionsTool() {
  const [courses, setCourses]             = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]           = useState(null)
  const [courseName, setCourseName]       = useState('')
  const [view, setView]                   = useState('due-dates')

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) { setCourseId(list[0].id); setCourseName(list[0].name) }
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  function handleCourseChange(cId) {
    const c = courses.find(x => x.id === cId)
    setCourseId(cId)
    setCourseName(c?.name ?? '')
  }

  return (
    <div>
      <PageHeader title="Section Management">
        Set per-section due dates and compare grades across sections.
      </PageHeader>

      <div className="card p-4 mb-5 flex items-center gap-4">
        <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0">Course</span>
        <CourseSelector courses={courses} selectedId={courseId} onChange={handleCourseChange} loading={loadingCourses} />
      </div>

      {/* Sub-view toggle */}
      <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden w-fit mb-5">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-4 py-2 text-sm font-medium border-r border-[var(--color-border)] last:border-r-0 transition-colors ${
              view === v.id ? 'text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]'
            }`}
            style={view === v.id ? { backgroundColor: 'var(--cpt-color)' } : undefined}
          >
            {v.label}
          </button>
        ))}
      </div>

      {courseId && view === 'due-dates' && (
        <SetDueDates courseId={courseId} courseName={courseName} courses={courses} />
      )}
      {courseId && view === 'comparison' && (
        <GradeComparison courseId={courseId} />
      )}
    </div>
  )
}
