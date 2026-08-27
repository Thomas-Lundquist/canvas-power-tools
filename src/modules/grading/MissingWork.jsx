import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, X, Send, Loader, CheckCircle } from 'lucide-react'
import Card from '../../components/Card.jsx'
import Badge from '../../components/Badge.jsx'
import Button from '../../components/Button.jsx'
import SegmentedToggle from '../../components/SegmentedToggle.jsx'
import Callout from '../../components/Callout.jsx'
import { getCourseSubmissions, getAssignmentsWithGradingData, updateSubmissionGrade } from '../../api/submissions.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'

const VIEW_MODES = [
  { value: 'by-assignment', label: 'By Assignment' },
  { value: 'by-student',    label: 'By Student' },
]

function daysSince(isoDate) {
  if (!isoDate) return null
  return Math.floor((Date.now() - new Date(isoDate)) / 86400000)
}

function nudgeUrl({ courseId, assignmentId, studentIds }) {
  const params = new URLSearchParams({ courseId, assignmentId })
  for (const id of studentIds) params.append('studentId', id)
  return chrome.runtime.getURL(`src/pages/submission-reminders/index.html?${params.toString()}`)
}

function ConfirmModal({ message, onConfirm, onCancel, confirming, progress }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <Card padding="lg" className="max-w-sm w-full space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
        {confirming && progress && (
          <p className="text-xs text-[var(--color-text-disabled)]">{progress}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={confirming}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={confirming}>
            <span className="flex items-center gap-1.5">
              {confirming && <Loader size={13} className="animate-spin" />}
              Grade as Zero
            </span>
          </Button>
        </div>
      </Card>
    </div>
  )
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <Card key={i} className="flex items-center gap-4 animate-pulse">
      <div className="w-5 h-5 rounded bg-[var(--color-border-subtle)]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-40 bg-[var(--color-border-subtle)] rounded" />
        <div className="h-3 w-24 bg-[var(--color-border-subtle)] rounded" />
      </div>
      <div className="h-7 w-28 bg-[var(--color-border-subtle)] rounded" />
    </Card>
  ))
}

export default function MissingWork({ courseId, courseName, loadingCourse }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [assignments, setAssignments]       = useState([])
  const [missing, setMissing]               = useState([])
  const [loading, setLoading]               = useState(false)
  const [viewMode, setViewMode]             = useState('by-assignment')
  const [search, setSearch]                 = useState('')
  const [expanded, setExpanded]             = useState(new Set())
  const [confirm, setConfirm]               = useState(null)
  const [confirming, setConfirming]         = useState(false)
  const [progress, setProgress]             = useState('')

  useEffect(() => {
    if (!courseId) { setMissing([]); setAssignments([]); return }
    setMissing([])
    setAssignments([])
    setExpanded(new Set())
    setLoading(true)
    Promise.all([
      getCourseSubmissions(courseId),
      getAssignmentsWithGradingData(courseId),
    ]).then(([subs, asns]) => {
      setAssignments(asns)
      setMissing(subs.filter(s => s.missing))
    }).finally(() => setLoading(false))
  }, [courseId])

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
      setLoading(true)
      Promise.all([getCourseSubmissions(courseId), getAssignmentsWithGradingData(courseId)])
        .then(([subs, asns]) => { setAssignments(asns); setMissing(subs.filter(s => s.missing)) })
        .finally(() => setLoading(false))
    })
  }

  function openConfirm(rows, label) {
    setConfirm({
      message: `Grade ${rows.length === 1 ? 'this missing submission' : `${rows.length} missing submissions`} as zero${label ? ` for ${label}` : ''}? This cannot be undone.`,
      rows,
    })
  }

  function goNudge(assignmentId, studentIds) {
    window.location.href = nudgeUrl({ courseId, assignmentId, studentIds })
  }

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

  const q = search.trim().toLowerCase()
  const filteredByAssignment = q
    ? byAssignment.filter(g => g.name.toLowerCase().includes(q) || g.rows.some(r => (r.userName ?? '').toLowerCase().includes(q)))
    : byAssignment
  const filteredByStudent = q
    ? byStudent.filter(g => (g.userName ?? '').toLowerCase().includes(q) || g.rows.some(r => (assignmentMap[r.assignmentId]?.name ?? '').toLowerCase().includes(q)))
    : byStudent

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Missing Work</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Identify outstanding submissions and nudge or grade them as zero in bulk.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SegmentedToggle options={VIEW_MODES} value={viewMode} onChange={v => { setViewMode(v); setExpanded(new Set()) }} ariaLabel="Missing work view" />
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by assignment or student..."
            className="input pl-9"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        {!loading && missing.length > 0 && (
          <span className="text-sm text-[var(--color-text-disabled)] shrink-0">
            {missing.length} missing submission{missing.length !== 1 ? 's' : ''} · {byAssignment.length} assignment{byAssignment.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading || loadingCourse ? (
        <div className="space-y-2"><SkeletonRows /></div>
      ) : missing.length === 0 ? (
        <Card padding="lg" className="text-center space-y-2 py-12">
          <CheckCircle size={32} className="mx-auto" style={{ color: 'var(--color-success)' }} />
          <p className="font-medium text-[var(--color-text-body)]">No missing submissions</p>
          <p className="text-sm text-[var(--color-text-muted)]">All students have submitted their work in this course.</p>
        </Card>
      ) : viewMode === 'by-assignment' ? (
        <div className="space-y-3">
          {filteredByAssignment.map(group => {
            const open = expanded.has(group.assignmentId)
            const days = daysSince(group.dueAt)
            return (
              <Card key={group.assignmentId} padding="none" className="overflow-hidden">
                <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-subtle)]">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">{group.rows.length} missing</Badge>
                      {days !== null && <Badge tone="danger">{days === 0 ? 'Due today' : `${days}d overdue`}</Badge>}
                    </div>
                    <h3 className="font-semibold text-[var(--color-text-body)] truncate">{group.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" icon={Send} onClick={() => goNudge(group.assignmentId, group.rows.map(r => r.userId))}>
                      Nudge All ({group.rows.length})
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => openConfirm(group.rows, group.name)}>
                      Grade All as Zero
                    </Button>
                    <button
                      onClick={() => toggleExpand(group.assignmentId)}
                      className="p-2 rounded-[var(--radius-control)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                      aria-expanded={open}
                      aria-label="Toggle missing students"
                    >
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-bg-page)]">
                    {group.rows.map(row => (
                      <div key={row.userId} className="flex items-center gap-3 px-4 py-2.5">
                        <p className="text-sm text-[var(--color-text-body)] flex-1 truncate">{row.userName ?? 'Unknown Student'}</p>
                        <Button size="sm" variant="secondary" icon={Send} onClick={() => goNudge(group.assignmentId, [row.userId])}>
                          Nudge
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => openConfirm([row], `${row.userName} — ${group.name}`)}>
                          Zero
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <Callout tone="info">
            Grade as Zero is performed from the By Assignment view. Nudge here sends a reminder for one assignment at a time.
          </Callout>
          {filteredByStudent.map(group => {
            const open = expanded.has(group.userId)
            return (
              <Card key={group.userId} padding="none" className="overflow-hidden">
                <div className="p-4 flex items-center gap-3 border-b border-[var(--color-border-subtle)]">
                  <button
                    onClick={() => toggleExpand(group.userId)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    aria-expanded={open}
                  >
                    {open ? <ChevronDown size={16} className="text-[var(--color-text-muted)] shrink-0" /> : <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />}
                    <span className="font-semibold text-[var(--color-text-body)] truncate">{group.userName ?? 'Unknown Student'}</span>
                    <Badge tone="warning">{group.rows.length} missing</Badge>
                  </button>
                </div>
                {open && (
                  <div className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-bg-page)]">
                    {group.rows.map(row => {
                      const asn = assignmentMap[row.assignmentId]
                      const days = daysSince(asn?.dueAt)
                      return (
                        <div key={row.assignmentId} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--color-text-body)] truncate">{asn?.name ?? row.assignmentId}</p>
                            {days !== null && (
                              <p className="text-xs text-[var(--color-text-disabled)]">{days === 0 ? 'Due today' : `${days} day${days !== 1 ? 's' : ''} past due`}</p>
                            )}
                          </div>
                          <Button size="sm" variant="secondary" icon={Send} onClick={() => goNudge(row.assignmentId, [row.userId])}>
                            Nudge
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
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
