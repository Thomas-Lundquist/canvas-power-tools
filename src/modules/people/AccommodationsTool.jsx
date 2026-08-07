import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, Plus, Loader, CheckCircle, Trash2, ArrowLeft } from 'lucide-react'
import CourseSelector from '../../components/CourseSelector.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { formatDate, toDateInputValue, toIsoDate } from '../../components/DateInput.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignmentsWithOverrides, createStudentOverride, updateOverride, deleteOverride } from '../../api/overrides.js'
import { getEnrollments } from '../../api/enrollments.js'
import { useToast } from '../../components/Toast.jsx'
import { usePinGate } from '../../security/usePinGate.jsx'

// ── Helpers ─────────────────────────────────────────────────────────────────

function addDays(isoDate, days) {
  if (!isoDate) return null
  const d = new Date(isoDate)
  d.setUTCDate(d.getUTCDate() + Number(days))
  return d.toISOString()
}

function overrideStatus(dueAt) {
  if (!dueAt) return 'upcoming'
  const now = Date.now()
  return new Date(dueAt).getTime() < now ? 'past' : 'upcoming'
}

// ── StudentDetailPanel ───────────────────────────────────────────────────────

function StudentDetailPanel({ student, assignments, overviewData, courseId, courseName, onClose, onAddMore, onRemoved }) {
  const toast = useToast()
  const { requirePin } = usePinGate()
  const [removing, setRemoving] = useState(null)

  const studentRow = overviewData.find(r => r.userId === student.userId)
  const overrideList = studentRow?.overrideList ?? []

  async function handleRemove(item) {
    await requirePin(
      { action: 'remove_override', summary: `Remove override for ${student.userName} on "${item.assignmentName}" in ${courseName}`, courseId, courseName },
      async () => {
        setRemoving(item.assignmentId)
        try {
          await deleteOverride(courseId, item.assignmentId, item.overrideId)
          toast(`Override removed for ${item.assignmentName}`, 'success')
          onRemoved()
        } finally {
          setRemoving(null)
        }
      }
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        <div>
          <p className="font-semibold text-[var(--color-text-body)]">{student.userName}</p>
          <p className="text-xs text-[var(--color-text-disabled)]">{overrideList.length} active override{overrideList.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={onAddMore}>
            <Plus size={12} /> Add Overrides
          </button>
          <button className="text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)] transition-colors" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {overrideList.length === 0 ? (
        <p className="text-sm text-[var(--color-text-disabled)] py-8 text-center">No overrides set.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Assignment</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Standard Due</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Override Due</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {overrideList.map(item => {
              const status = overrideStatus(item.overrideDueAt)
              return (
                <tr key={item.assignmentId} className={status === 'past' ? 'opacity-50' : ''}>
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text-body)]">{item.assignmentName}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{formatDate(item.standardDueAt)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text-body)]">{formatDate(item.overrideDueAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-xs font-medium ${status === 'past' ? 'text-[var(--color-text-disabled)]' : 'text-[var(--color-info)]'}`}>
                      {status === 'past' ? 'Past' : 'Upcoming'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleRemove(item)}
                      disabled={removing === item.assignmentId}
                      aria-label={`Remove override for ${item.assignmentName}`}
                      className="text-[var(--color-text-disabled)] hover:text-[var(--color-error)] transition-colors disabled:opacity-40"
                    >
                      {removing === item.assignmentId ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Step 1: Select Student ───────────────────────────────────────────────────

function StepSelectStudent({ enrollments, loading, selected, onSelect, onNext, onCancel }) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enrollments.filter(e => (e.userName ?? '').toLowerCase().includes(q))
  }, [enrollments, search])

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)]">
        <p className="text-xs text-[var(--color-text-disabled)] uppercase tracking-wide font-medium mb-1">Step 1 of 3</p>
        <h3 className="font-semibold text-[var(--color-text-body)]">Select Student</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Choose the student who needs accommodation overrides.</p>
      </div>
      <div className="px-5 py-3 border-b border-[var(--color-border-subtle)]">
        <input
          type="search"
          placeholder="Search students…"
          className="input text-sm w-full"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="overflow-y-auto max-h-64">
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-[var(--color-text-disabled)] text-sm">
            <Loader size={14} className="animate-spin" /> Loading students…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)] py-8 text-center">No students found.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {filtered.map(e => (
              <label key={e.userId} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[var(--color-bg-hover)]">
                <input
                  type="radio"
                  name="student"
                  checked={selected?.userId === e.userId}
                  onChange={() => onSelect(e)}
                  className="accent-[var(--cpt-color)]"
                />
                <span className="text-sm text-[var(--color-text-body)]">{e.userSortableName ?? e.userName}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] flex justify-end gap-3">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={!selected} onClick={onNext}>Next</button>
      </div>
    </div>
  )
}

// ── Step 2: Select Assignments ───────────────────────────────────────────────

function StepSelectAssignments({ student, assignments, overviewData, selectedIds, onToggle, onSelectAll, onBack, onNext }) {
  const [search, setSearch] = useState('')

  const studentRow = overviewData.find(r => r.userId === student.userId)
  const overridesByAsn = useMemo(() => {
    const map = {}
    for (const item of (studentRow?.overrideList ?? [])) map[item.assignmentId] = item.overrideDueAt
    return map
  }, [studentRow])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return assignments.filter(a => a.published && a.name.toLowerCase().includes(q))
  }, [assignments, search])

  const allVisible = filtered.every(a => selectedIds.has(a.id))

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)]">
        <p className="text-xs text-[var(--color-text-disabled)] uppercase tracking-wide font-medium mb-1">Step 2 of 3</p>
        <h3 className="font-semibold text-[var(--color-text-body)]">Select Assignments — {student.userName}</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Choose which assignments to apply overrides to.</p>
      </div>
      <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
        <input
          type="search"
          placeholder="Search assignments…"
          className="input text-sm flex-1"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className="text-xs text-[var(--color-info)] hover:text-[var(--color-info)] font-medium shrink-0"
          onClick={() => onSelectAll(filtered, !allVisible)}
        >
          {allVisible ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="overflow-y-auto max-h-64">
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {filtered.map(a => {
            const currentDue = overridesByAsn[a.id] ?? a.dueAt
            return (
              <label key={a.id} className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-[var(--color-bg-hover)]">
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.id)}
                  onChange={() => onToggle(a.id)}
                  className="mt-0.5 accent-[var(--cpt-color)]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-body)] truncate">{a.name}</p>
                  <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
                    Standard: {formatDate(a.dueAt)}
                    {overridesByAsn[a.id] && (
                      <span className="ml-2 text-[var(--color-info)]">Override: {formatDate(overridesByAsn[a.id])}</span>
                    )}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </div>
      <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-disabled)]">{selectedIds.size} selected</p>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-1" onClick={onBack}><ArrowLeft size={13} /> Back</button>
          <button className="btn-primary" disabled={selectedIds.size === 0} onClick={onNext}>Next</button>
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Set Override Dates ───────────────────────────────────────────────

function StepSetDates({ student, assignments, selectedIds, overviewData, courseId, courseName, onBack, onCancel, onDone }) {
  const toast = useToast()
  const { requirePin } = usePinGate()
  const [dateMode, setDateMode]       = useState('extend')
  const [extendDays, setExtendDays]   = useState('3')
  const [indivDates, setIndivDates]   = useState({})
  const [applying, setApplying]       = useState(false)
  const [progress, setProgress]       = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const studentRow = overviewData.find(r => r.userId === student.userId)
  const overrideMap = useMemo(() => {
    const map = {}
    for (const item of (studentRow?.overrideList ?? [])) map[item.assignmentId] = item
    return map
  }, [studentRow])

  const selectedAssignments = assignments.filter(a => selectedIds.has(a.id))

  // Compute preview rows
  const previewRows = useMemo(() => {
    return selectedAssignments.map(a => {
      const baseDue = overrideMap[a.id]?.overrideDueAt ?? a.dueAt
      let newDue
      if (dateMode === 'extend') {
        const days = parseInt(extendDays, 10)
        newDue = !isNaN(days) && days > 0 ? addDays(baseDue, days) : null
      } else {
        newDue = toIsoDate(indivDates[a.id] ?? '') || null
      }
      return {
        assignmentId: a.id,
        assignmentName: a.name,
        standardDue: a.dueAt,
        currentDue: baseDue,
        newDue,
        overrideId: overrideMap[a.id]?.overrideId ?? null,
      }
    })
  }, [selectedAssignments, dateMode, extendDays, indivDates, overrideMap])

  async function handleApply() {
    const valid = previewRows.filter(r => r.newDue)
    if (!valid.length) return
    const summary = `Set ${valid.length} accommodation override${valid.length !== 1 ? 's' : ''} for ${student.userName} in ${courseName}`
    await requirePin({ action: 'accommodation_override', summary, courseId, courseName }, async () => {
      setApplying(true)
      let done = 0
      for (const row of valid) {
        if (row.overrideId) {
          await updateOverride(courseId, row.assignmentId, row.overrideId, { dueAt: row.newDue })
        } else {
          await createStudentOverride(courseId, row.assignmentId, student.userId, { dueAt: row.newDue })
        }
        done++
        setProgress(`${done} of ${valid.length} applied…`)
      }
      setApplying(false)
      setProgress('')
      setShowConfirm(false)
      toast(`Applied ${valid.length} override${valid.length !== 1 ? 's' : ''} for ${student.userName}`, 'success')
      onDone()
    })
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)]">
          <p className="text-xs text-[var(--color-text-disabled)] uppercase tracking-wide font-medium mb-1">Step 3 of 3</p>
          <h3 className="font-semibold text-[var(--color-text-body)]">Set Override Dates — {student.userName}</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedAssignments.length} assignment{selectedAssignments.length !== 1 ? 's' : ''} selected</p>
        </div>

        {/* Mode toggle */}
        <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="dateMode" checked={dateMode === 'extend'} onChange={() => setDateMode('extend')} className="accent-[var(--cpt-color)]" />
            Extend by <input
              type="number"
              min="1"
              max="365"
              value={extendDays}
              onChange={e => setExtendDays(e.target.value)}
              disabled={dateMode !== 'extend'}
              className="input w-16 text-sm py-0.5 px-2 inline-block mx-1"
            /> days from standard due date
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="dateMode" checked={dateMode === 'individual'} onChange={() => setDateMode('individual')} className="accent-[var(--cpt-color)]" />
            Set a specific date for each assignment individually
          </label>
        </div>

        {/* Preview / individual date inputs */}
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Assignment</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Current</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">New Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {previewRows.map(row => (
                <tr key={row.assignmentId}>
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text-body)] max-w-[12rem] truncate">{row.assignmentName}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{formatDate(row.currentDue)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {dateMode === 'individual' ? (
                      <input
                        type="date"
                        className="input text-sm py-0.5 px-2 w-36"
                        value={indivDates[row.assignmentId] ?? toDateInputValue(row.currentDue)}
                        onChange={e => setIndivDates(prev => ({ ...prev, [row.assignmentId]: e.target.value }))}
                      />
                    ) : (
                      <span className={`font-medium ${row.newDue ? 'text-[var(--color-info)]' : 'text-[var(--color-text-disabled)]'}`}>
                        {row.newDue ? formatDate(row.newDue) : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] flex justify-between items-center">
          <button className="btn-secondary flex items-center gap-1" onClick={onBack} disabled={applying}><ArrowLeft size={13} /> Back</button>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={onCancel} disabled={applying}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => setShowConfirm(true)}
              disabled={applying || previewRows.every(r => !r.newDue)}
            >
              Preview &amp; Apply
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="px-6 pt-5 pb-4 border-b border-[var(--color-border-subtle)] shrink-0">
              <h3 className="font-semibold text-[var(--color-text-body)]">Confirm Override Changes</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{student.userName} · {previewRows.filter(r => r.newDue).length} overrides will be applied</p>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Assignment</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Standard Due</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">{student.userName}&apos;s Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {previewRows.filter(r => r.newDue).map(row => (
                    <tr key={row.assignmentId}>
                      <td className="px-4 py-2.5 font-medium text-[var(--color-text-body)]">{row.assignmentName}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{formatDate(row.standardDue)}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-info)] font-medium">{formatDate(row.newDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-[var(--color-border-subtle)] shrink-0">
              {applying && <p className="text-xs text-[var(--color-text-disabled)] mb-3">{progress}</p>}
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => setShowConfirm(false)} disabled={applying}>Back</button>
                <button
                  className="btn-primary flex items-center gap-1.5"
                  onClick={handleApply}
                  disabled={applying}
                >
                  {applying ? <><Loader size={13} className="animate-spin" /> Applying…</> : 'Apply Overrides'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Overview row ─────────────────────────────────────────────────────────────

function OverviewRow({ row, onView, onAddMore }) {
  const nextDue = row.overrideList
    .filter(i => overrideStatus(i.overrideDueAt) === 'upcoming')
    .sort((a, b) => new Date(a.overrideDueAt) - new Date(b.overrideDueAt))[0]?.overrideDueAt ?? null

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-hover)]">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-body)]">{row.userName}</p>
        <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
          {row.overrideList.length} active override{row.overrideList.length !== 1 ? 's' : ''}
          {nextDue ? <> · Next: {formatDate(nextDue)}</> : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-secondary text-xs" onClick={() => onView(row)}>View</button>
        <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => onAddMore(row)}>
          <Plus size={11} /> Edit
        </button>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AccommodationsTool({ initialStudentId }) {
  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(null)
  const [courseName, setCourseName]         = useState('')

  const [enrollments, setEnrollments]     = useState([])
  const [assignments, setAssignments]     = useState([])
  const [overviewData, setOverviewData]   = useState([])
  const [loadingData, setLoadingData]     = useState(false)

  // Wizard state
  const [wizardMode, setWizardMode]           = useState(false)  // true = wizard, false = overview
  const [wizardStep, setWizardStep]           = useState(1)
  const [wizardStudent, setWizardStudent]     = useState(null)
  const [selectedAsnIds, setSelectedAsnIds]   = useState(new Set())
  const [detailStudent, setDetailStudent]     = useState(null)

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        if (list.length > 0) { setCourseId(list[0].id); setCourseName(list[0].name) }
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  useEffect(() => {
    if (!courseId) return
    loadData(courseId)
  }, [courseId])

  async function loadData(cId) {
    setLoadingData(true)
    setOverviewData([])
    try {
      const [asnsWithOverrides, enrs] = await Promise.all([
        getAssignmentsWithOverrides(cId),
        getEnrollments(cId),
      ])
      setAssignments(asnsWithOverrides)
      setEnrollments(enrs)
      // Build enrollment map: userId → userName
      const nameMap = {}
      for (const e of enrs) nameMap[e.userId] = e.userName
      // Aggregate overrides by student
      const byStudent = {}
      for (const asn of asnsWithOverrides) {
        for (const override of asn.overrides) {
          if (!override.studentIds) continue  // skip section overrides
          for (const uid of override.studentIds) {
            if (!byStudent[uid]) byStudent[uid] = { userId: uid, userName: nameMap[uid] ?? uid, overrideList: [] }
            byStudent[uid].overrideList.push({
              assignmentId:   asn.id,
              assignmentName: asn.name,
              standardDueAt:  asn.dueAt,
              overrideDueAt:  override.dueAt,
              overrideId:     override.id,
            })
          }
        }
      }
      setOverviewData(Object.values(byStudent).sort((a, b) => (a.userName ?? '').localeCompare(b.userName ?? '')))
    } finally {
      setLoadingData(false)
    }
  }

  function handleCourseChange(cId) {
    const c = courses.find(x => x.id === cId)
    setCourseId(cId)
    setCourseName(c?.name ?? '')
    setDetailStudent(null)
    cancelWizard()
  }

  function startWizard(student = null) {
    setWizardMode(true)
    setWizardStep(1)
    setWizardStudent(student)
    setSelectedAsnIds(new Set())
    setDetailStudent(null)
  }

  function cancelWizard() {
    setWizardMode(false)
    setWizardStep(1)
    setWizardStudent(null)
    setSelectedAsnIds(new Set())
  }

  function handleWizardDone() {
    cancelWizard()
    loadData(courseId)
  }

  function toggleAsnId(id) {
    setSelectedAsnIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll(filtered, checked) {
    setSelectedAsnIds(prev => {
      const next = new Set(prev)
      for (const a of filtered) checked ? next.add(a.id) : next.delete(a.id)
      return next
    })
  }

  return (
    <div>
      <PageHeader
        title="Accommodations"
        actions={!wizardMode && (
          <button className="btn-primary flex items-center gap-1.5" onClick={() => startWizard()}>
            <Plus size={14} /> New Override
          </button>
        )}
      >
        Apply per-student due date overrides across multiple assignments at once.
      </PageHeader>

      <div className="card p-4 mb-5 flex items-center gap-4">
        <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0">Course</span>
        <CourseSelector courses={courses} selectedId={courseId} onChange={handleCourseChange} loading={loadingCourses} />
      </div>

      {wizardMode ? (
        <>
          {wizardStep === 1 && (
            <StepSelectStudent
              enrollments={enrollments}
              loading={loadingData}
              selected={wizardStudent}
              onSelect={s => setWizardStudent(s)}
              onNext={() => setWizardStep(2)}
              onCancel={cancelWizard}
            />
          )}
          {wizardStep === 2 && wizardStudent && (
            <StepSelectAssignments
              student={wizardStudent}
              assignments={assignments}
              overviewData={overviewData}
              selectedIds={selectedAsnIds}
              onToggle={toggleAsnId}
              onSelectAll={selectAll}
              onBack={() => setWizardStep(1)}
              onNext={() => setWizardStep(3)}
            />
          )}
          {wizardStep === 3 && wizardStudent && (
            <StepSetDates
              student={wizardStudent}
              assignments={assignments}
              selectedIds={selectedAsnIds}
              overviewData={overviewData}
              courseId={courseId}
              courseName={courseName}
              onBack={() => setWizardStep(2)}
              onCancel={cancelWizard}
              onDone={handleWizardDone}
            />
          )}
        </>
      ) : courseId && (
        <>
          {detailStudent && (
            <div className="mb-4">
              <StudentDetailPanel
                student={detailStudent}
                assignments={assignments}
                overviewData={overviewData}
                courseId={courseId}
                courseName={courseName}
                onClose={() => setDetailStudent(null)}
                onAddMore={row => { startWizard(row) }}
                onRemoved={() => { loadData(courseId) }}
              />
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-body)]">Students with Overrides</p>
              <p className="text-xs text-[var(--color-text-disabled)]">{overviewData.length} student{overviewData.length !== 1 ? 's' : ''}</p>
            </div>
            {loadingData ? (
              <div className="flex items-center gap-2 py-10 justify-center text-[var(--color-text-disabled)] text-sm">
                <Loader size={14} className="animate-spin" /> Loading overrides…
              </div>
            ) : overviewData.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle size={28} className="mx-auto mb-3 text-[var(--color-text-disabled)]" />
                <p className="text-sm font-medium text-[var(--color-text-muted)]">No accommodation overrides set</p>
                <p className="text-xs text-[var(--color-text-disabled)] mt-1">Click "New Override" to add overrides for a student.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {overviewData.map(row => (
                  <OverviewRow
                    key={row.userId}
                    row={row}
                    onView={r => setDetailStudent(r)}
                    onAddMore={r => startWizard(r)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
