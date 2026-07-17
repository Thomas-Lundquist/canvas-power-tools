import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, AlertCircle,
         Loader, ChevronRight, Copy, GitMerge } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import Modal from '../../components/Modal.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { getCourses } from '../../api/courses.js'
import { getAssignments, updateAssignment } from '../../api/assignments.js'
import {
  getAssignmentGroups,
  createAssignmentGroup,
  updateAssignmentGroup,
  deleteAssignmentGroup,
} from '../../api/assignmentGroups.js'
import { usePinGate } from '../../security/usePinGate.jsx'

const GROUP_SKELETON_WIDTHS = [
  ['w-8', 'w-32', 'w-12', 'w-24', 'w-20'],
  ['w-8', 'w-40', 'w-12', 'w-20', 'w-20'],
  ['w-8', 'w-28', 'w-10', 'w-24', 'w-20'],
  ['w-8', 'w-36', 'w-12', 'w-20', 'w-20'],
  ['w-8', 'w-44', 'w-8',  'w-24', 'w-20'],
]

function SkeletonRow({ widths }) {
  return (
    <tr className="border-b border-[var(--color-border)]">
      {widths.map((w, i) => (
        <td key={i} className="px-3 py-3.5">
          <div className={`h-3.5 ${w} rounded bg-[var(--color-border)] animate-pulse`} />
        </td>
      ))}
    </tr>
  )
}

export default function AssignmentGroupManager({ initialCourseId }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [courses, setCourses]             = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]           = useState(null)
  const [groups, setGroups]               = useState([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [assignments, setAssignments]     = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const [movingId, setMovingId]           = useState(null)

  const [editingId, setEditingId]         = useState(null)
  const [editForm, setEditForm]           = useState({ name: '', groupWeight: '' })

  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [deleteMoveToId, setDeleteMoveToId] = useState(null)

  const [mergeSource, setMergeSource]     = useState(null)
  const [mergeTargetId, setMergeTargetId] = useState(null)
  const [merging, setMerging]             = useState(false)

  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        const start = initialCourseId && list.find(c => c.id === String(initialCourseId))
          ? String(initialCourseId)
          : list[0]?.id ?? null
        if (start) loadCourseData(start)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingCourses(false))
  }, [])

  async function loadCourseData(cId) {
    setCourseId(cId)
    setGroups([])
    setAssignments([])
    setEditingId(null)
    setExpandedGroupId(null)
    setError(null)
    setLoadingGroups(true)
    setLoadingAssignments(true)
    try {
      const [groupData, assignmentData] = await Promise.all([
        getAssignmentGroups(cId),
        getAssignments(cId),
      ])
      setGroups(groupData)
      setAssignments(assignmentData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingGroups(false)
      setLoadingAssignments(false)
    }
  }

  const assignmentsByGroup = useMemo(() => {
    const map = {}
    for (const a of assignments) {
      const gId = a.assignmentGroupId
      if (gId) {
        if (!map[gId]) map[gId] = []
        map[gId].push(a)
      }
    }
    return map
  }, [assignments])

  function pinGuard(summary, action) {
    const courseName = courses.find(c => c.id === courseId)?.name ?? courseId
    return requirePin({ action: 'assignment_group_change', summary, courseId, courseName }, action)
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function startEdit(group) {
    setEditingId(group.id)
    setEditForm({ name: group.name, groupWeight: group.groupWeight > 0 ? String(group.groupWeight) : '' })
  }

  function startNew() {
    setEditingId('new')
    setEditForm({ name: '', groupWeight: '' })
  }

  function cancelEdit() { setEditingId(null) }

  async function saveEdit() {
    if (!editForm.name.trim()) return
    const verb = editingId === 'new' ? 'Created' : 'Updated'
    await pinGuard(`${verb} assignment group "${editForm.name.trim()}"`, async () => {
      setSaving(true)
      setError(null)
      try {
        const fields = {
          name:        editForm.name.trim(),
          groupWeight: editForm.groupWeight !== '' ? parseFloat(editForm.groupWeight) : 0,
        }
        if (editingId === 'new') {
          const created = await createAssignmentGroup(courseId, { ...fields, position: groups.length + 1 })
          setGroups(prev => [...prev, created])
          toast('Group created', 'success')
        } else {
          const updated = await updateAssignmentGroup(courseId, editingId, fields)
          setGroups(prev => prev.map(g => g.id === editingId ? updated : g))
          toast('Group updated', 'success')
        }
        setEditingId(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    })
  }

  // ── Reorder ──────────────────────────────────────────────────────────────────

  async function swapPositions(indexA, indexB) {
    const a = groups[indexA]
    const b = groups[indexB]
    await pinGuard(`Reordered assignment groups "${a.name}" and "${b.name}"`, async () => {
      setError(null)
      try {
        await Promise.all([
          updateAssignmentGroup(courseId, a.id, { position: b.position }),
          updateAssignmentGroup(courseId, b.id, { position: a.position }),
        ])
        setGroups(prev => {
          const next = [...prev]
          next[indexA] = { ...a, position: b.position }
          next[indexB] = { ...b, position: a.position }
          return next.sort((x, y) => x.position - y.position)
        })
      } catch (err) {
        setError(err.message)
      }
    })
  }

  // ── Copy ─────────────────────────────────────────────────────────────────────

  async function copyGroup(group) {
    await pinGuard(`Duplicated assignment group "${group.name}"`, async () => {
      setError(null)
      try {
        const created = await createAssignmentGroup(courseId, {
          name:        `${group.name} (copy)`,
          groupWeight: group.groupWeight,
          position:    groups.length + 1,
        })
        setGroups(prev => [...prev, created])
        toast(`"${group.name}" duplicated`, 'success')
      } catch (err) {
        setError(err.message)
      }
    })
  }

  // ── Merge ─────────────────────────────────────────────────────────────────────

  function openMergeModal(group) {
    const fallback = groups.find(g => g.id !== group.id)?.id ?? null
    setMergeSource(group)
    setMergeTargetId(fallback)
  }

  async function confirmMerge() {
    const target = groups.find(g => g.id === mergeTargetId)
    await pinGuard(`Merged assignment group "${mergeSource.name}" into "${target?.name}"`, async () => {
      setMerging(true)
      setError(null)
      try {
        await deleteAssignmentGroup(courseId, mergeSource.id, mergeTargetId)
        setAssignments(prev => prev.map(a =>
          a.assignmentGroupId === mergeSource.id ? { ...a, assignmentGroupId: mergeTargetId } : a
        ))
        setGroups(prev => prev.filter(g => g.id !== mergeSource.id))
        if (expandedGroupId === mergeSource.id) setExpandedGroupId(null)
        setMergeSource(null)
        toast('Groups merged', 'success')
      } catch (err) {
        setError(err.message)
      } finally {
        setMerging(false)
      }
    })
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  function openDeleteModal(group) {
    const fallback = groups.find(g => g.id !== group.id)?.id ?? null
    setDeleteTarget(group)
    setDeleteMoveToId(fallback)
  }

  async function confirmDelete() {
    await pinGuard(`Deleted assignment group "${deleteTarget.name}"`, async () => {
      setSaving(true)
      setError(null)
      try {
        await deleteAssignmentGroup(courseId, deleteTarget.id, deleteMoveToId)
        setGroups(prev => prev.filter(g => g.id !== deleteTarget.id))
        if (expandedGroupId === deleteTarget.id) setExpandedGroupId(null)
        setDeleteTarget(null)
        toast('Group deleted', 'success')
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    })
  }

  // ── Move assignment ────────────────────────────────────────────────────────────

  async function moveAssignment(assignmentId, newGroupId) {
    const aName = assignments.find(a => a.id === assignmentId)?.name ?? assignmentId
    const gName = groups.find(g => g.id === newGroupId)?.name ?? newGroupId
    await pinGuard(`Moved assignment "${aName}" to group "${gName}"`, async () => {
      setMovingId(assignmentId)
      setError(null)
      try {
        await updateAssignment(courseId, assignmentId, { assignmentGroupId: newGroupId })
        setAssignments(prev => prev.map(a =>
          a.id === assignmentId ? { ...a, assignmentGroupId: newGroupId } : a
        ))
      } catch (err) {
        setError(err.message)
      } finally {
        setMovingId(null)
      }
    })
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const totalWeight   = groups.reduce((s, g) => s + (g.groupWeight ?? 0), 0)
  const weightDisplay = Math.round(totalWeight * 10) / 10
  const weightOk      = Math.abs(weightDisplay - 100) < 0.1
  const weightNonZero = weightDisplay > 0

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-body)]">Assignment Groups</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Manage assignment groups and grade weights. Expand a group to see its assignments or move them to another group.
        </p>
      </div>

      <div className="card p-4 mb-6 flex items-center gap-4">
        <span className="text-sm font-medium text-[var(--color-text-secondary)] shrink-0">Course</span>
        <CourseSelector courses={courses} selectedId={courseId} onChange={loadCourseData} loading={loadingCourses} />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className="card overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-page)] border-b border-[var(--color-border)]">
              <th className="w-8 px-3 py-3" />
              <th className="w-16 px-3 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Order</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Group</th>
              <th className="w-24 px-3 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Weight</th>
              <th className="w-36 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loadingGroups
              ? GROUP_SKELETON_WIDTHS.map((widths, i) => <SkeletonRow key={i} widths={widths} />)
              : (
                <>
                  {groups.map((group, index) => (
                    editingId === group.id ? (
                      <EditRow
                        key={group.id}
                        index={index}
                        form={editForm}
                        onChange={setEditForm}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                        colSpan={5}
                      />
                    ) : (
                      <>
                        <GroupRow
                          key={group.id}
                          group={group}
                          index={index}
                          total={groups.length}
                          count={(assignmentsByGroup[group.id] ?? []).length}
                          expanded={expandedGroupId === group.id}
                          onToggleExpand={() => setExpandedGroupId(id => id === group.id ? null : group.id)}
                          onMoveUp={() => swapPositions(index, index - 1)}
                          onMoveDown={() => swapPositions(index, index + 1)}
                          onCopy={() => copyGroup(group)}
                          onMerge={() => openMergeModal(group)}
                          onEdit={() => startEdit(group)}
                          onDelete={() => openDeleteModal(group)}
                          deleteDisabled={groups.length <= 1}
                          mergeDisabled={groups.length <= 1}
                        />
                        {expandedGroupId === group.id && (
                          <tr key={`${group.id}-expand`}>
                            <td colSpan={5} className="bg-[var(--color-bg-page)] border-b border-[var(--color-border)] px-0 py-0">
                              <AssignmentList
                                assignments={assignmentsByGroup[group.id] ?? []}
                                groups={groups}
                                currentGroupId={group.id}
                                loading={loadingAssignments}
                                movingId={movingId}
                                onMove={moveAssignment}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  ))}
                  {editingId === 'new' && (
                    <EditRow
                      key="new"
                      index={groups.length}
                      form={editForm}
                      onChange={setEditForm}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      saving={saving}
                      isNew
                      colSpan={5}
                    />
                  )}
                </>
              )
            }
          </tbody>
        </table>

        {!loadingGroups && (
          <div className="px-4 py-3 bg-[var(--color-bg-page)] border-t border-[var(--color-border)] flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-muted)]">
              Total weight:{' '}
              <span className={`font-semibold ${weightOk ? 'text-green-600' : weightNonZero ? 'text-yellow-600' : 'text-[var(--color-text-muted)]'}`}>
                {weightDisplay}%
              </span>
              {!weightOk && weightNonZero && (
                <span className="ml-1 text-yellow-500">— should total 100% when weighting is enabled</span>
              )}
            </p>
            {editingId === null && (
              <button className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3" onClick={startNew}>
                <Plus size={13} /> New Group
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Grade weighting is enabled or disabled in Canvas Course Settings. Weights set here only affect grades when weighting is active.
      </p>

      {/* Delete modal */}
      {deleteTarget && (
        <Modal
          title={`Delete "${deleteTarget.name}"?`}
          size="sm"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#dc2626' }}
                onClick={confirmDelete}
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete Group'}
              </button>
            </>
          }
        >
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">
            This action is permanent and cannot be undone.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            The {(assignmentsByGroup[deleteTarget.id] ?? []).length} assignment{(assignmentsByGroup[deleteTarget.id] ?? []).length !== 1 ? 's' : ''} in this group will be moved to another group before deletion.
          </p>
          {groups.filter(g => g.id !== deleteTarget.id).length > 0 && (
            <div>
              <label className="label">Move assignments to</label>
              <select
                value={deleteMoveToId ?? ''}
                onChange={e => setDeleteMoveToId(e.target.value)}
                className="input"
              >
                {groups.filter(g => g.id !== deleteTarget.id).map(g =>
                  <option key={g.id} value={g.id}>{g.name}</option>
                )}
              </select>
            </div>
          )}
        </Modal>
      )}

      {/* Merge modal */}
      {mergeSource && (
        <Modal
          title={`Merge "${mergeSource.name}" into another group?`}
          size="sm"
          onClose={() => setMergeSource(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setMergeSource(null)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={confirmMerge}
                disabled={merging || !mergeTargetId}
              >
                {merging ? 'Merging...' : 'Merge Groups'}
              </button>
            </>
          }
        >
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">
            This action is permanent and cannot be undone.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            All {(assignmentsByGroup[mergeSource.id] ?? []).length} assignment{(assignmentsByGroup[mergeSource.id] ?? []).length !== 1 ? 's' : ''} from <strong>"{mergeSource.name}"</strong> will be moved to the selected group, then the group will be deleted.
          </p>
          <div>
            <label className="label">Merge into</label>
            <select
              value={mergeTargetId ?? ''}
              onChange={e => setMergeTargetId(e.target.value)}
              className="input"
            >
              {groups.filter(g => g.id !== mergeSource.id).map(g =>
                <option key={g.id} value={g.id}>{g.name}</option>
              )}
            </select>
          </div>
        </Modal>
      )}
    </div>
  )
}

function GroupRow({ group, index, total, count, expanded, onToggleExpand,
                    onMoveUp, onMoveDown, onCopy, onMerge, onEdit, onDelete,
                    deleteDisabled, mergeDisabled }) {
  return (
    <tr className="hover:bg-[var(--color-bg-hover)] transition-colors duration-75 cursor-pointer" onClick={onToggleExpand}>
      <td className="px-3 py-3 w-8">
        <ChevronRight
          size={13}
          className={`text-[var(--color-text-disabled)] transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
      </td>
      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          <button
            className="p-1 rounded text-[var(--color-text-disabled)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors duration-75"
            onClick={onMoveUp} disabled={index === 0} title="Move up"
          >
            <ChevronUp size={13} />
          </button>
          <button
            className="p-1 rounded text-[var(--color-text-disabled)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors duration-75"
            onClick={onMoveDown} disabled={index === total - 1} title="Move down"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-[var(--color-text-body)]">{group.name}</span>
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] px-1.5 py-0.5 rounded-full leading-none">
            {count}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-[var(--color-text-secondary)] text-sm">
        {group.groupWeight > 0 ? `${group.groupWeight}%` : <span className="text-[var(--color-text-disabled)]">—</span>}
      </td>
      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end">
          <button
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={onCopy} title="Duplicate group"
          >
            <Copy size={13} />
          </button>
          <button
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-75"
            onClick={onMerge} disabled={mergeDisabled} title="Merge into another group"
          >
            <GitMerge size={13} />
          </button>
          <button
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={onEdit} title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-75"
            onClick={onDelete} disabled={deleteDisabled} title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function AssignmentList({ assignments, groups, currentGroupId, loading, movingId, onMove }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] px-6 py-4">
        <Loader size={12} className="animate-spin" /> Loading assignments...
      </div>
    )
  }
  if (assignments.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)] italic px-6 py-4">No assignments in this group.</p>
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[var(--color-border)]">
          <th className="pl-6 pr-3 py-2 text-left font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Assignment</th>
          <th className="w-16 px-3 py-2 text-right font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Points</th>
          <th className="w-36 px-3 py-2 text-left font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Due</th>
          <th className="w-44 px-3 py-2 text-right font-medium text-[var(--color-text-muted)] uppercase tracking-wide pr-4">Move to group</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-border)]">
        {assignments.map(a => (
          <tr key={a.id} className="hover:bg-[var(--color-bg-hover)]/50 transition-colors duration-75">
            <td className="pl-6 pr-3 py-2.5 text-[var(--color-text-body)]">{a.name}</td>
            <td className="px-3 py-2.5 text-right text-[var(--color-text-secondary)]">{a.pointsPossible ?? '—'}</td>
            <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{a.dueAt ? formatDate(a.dueAt) : '—'}</td>
            <td className="px-3 py-2.5 text-right pr-4">
              {movingId === a.id ? (
                <Loader size={12} className="animate-spin text-[var(--color-text-muted)] ml-auto" />
              ) : (
                <select
                  value={currentGroupId}
                  onChange={e => onMove(a.id, e.target.value)}
                  className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text-body)]"
                >
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EditRow({ index, form, onChange, onSave, onCancel, saving, isNew, colSpan }) {
  return (
    <tr className={isNew ? 'bg-[var(--color-bg-page)]' : ''}>
      <td className="px-3 py-2.5 text-xs text-[var(--color-text-disabled)]" colSpan={2}>{isNew ? '' : index + 1}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={form.name}
          onChange={e => onChange(f => ({ ...f, name: e.target.value }))}
          placeholder={isNew ? 'Group name...' : undefined}
          className="input text-sm py-1.5"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="number" min="0" max="100"
            value={form.groupWeight}
            onChange={e => onChange(f => ({ ...f, groupWeight: e.target.value }))}
            placeholder="0"
            className="input w-16 text-sm py-1.5"
          />
          <span className="text-xs text-[var(--color-text-muted)]">%</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 justify-end">
          <button className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75" onClick={onCancel} title="Cancel">
            <X size={13} />
          </button>
          <button
            className="p-1.5 rounded-md text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--cpt-color)' }}
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            title="Save"
          >
            {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
        </div>
      </td>
    </tr>
  )
}
