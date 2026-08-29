import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Check, X, AlertCircle,
         Loader, Copy, GitMerge, Edit2, FolderKanban, FileText, ExternalLink } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import CopyToCoursesModal from '../../components/CopyToCoursesModal.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { getAssignments, updateAssignment } from '../../api/assignments.js'
import {
  getAssignmentGroups,
  createAssignmentGroup,
  updateAssignmentGroup,
  deleteAssignmentGroup,
} from '../../api/assignmentGroups.js'
import { usePinGate } from '../../security/usePinGate.jsx'

export default function AssignmentGroupManager({ courseId, courses }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [groups, setGroups]                 = useState([])
  const [loadingGroups, setLoadingGroups]   = useState(false)
  const [assignments, setAssignments]       = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const [expandedGroups, setExpandedGroups] = useState({})
  const [movingId, setMovingId]             = useState(null)

  const [editingId, setEditingId]           = useState(null)
  const [isAddingGroup, setIsAddingGroup]   = useState(false)
  const [editForm, setEditForm]             = useState({ name: '', groupWeight: '' })

  const [deleteTarget, setDeleteTarget]     = useState(null)
  const [deleteMoveToId, setDeleteMoveToId] = useState(null)

  const [mergeSource, setMergeSource]       = useState(null)
  const [mergeTargetId, setMergeTargetId]   = useState(null)
  const [merging, setMerging]               = useState(false)

  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState(null)
  const [copyToGroup, setCopyToGroup]       = useState(null)

  useEffect(() => {
    if (courseId) loadCourseData(courseId)
  }, [courseId])

  async function loadCourseData(cId) {
    setGroups([])
    setAssignments([])
    setEditingId(null)
    setIsAddingGroup(false)
    setExpandedGroups({})
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
      setExpandedGroups(Object.fromEntries(groupData.map(g => [g.id, true])))
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

  function toggleExpand(groupId) {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  // ── Edit / New ────────────────────────────────────────────────────────────────

  function startEdit(group) {
    setIsAddingGroup(false)
    setEditingId(group.id)
    setEditForm({ name: group.name, groupWeight: group.groupWeight > 0 ? String(group.groupWeight) : '' })
  }

  function startNew() {
    setEditingId(null)
    setIsAddingGroup(true)
    setEditForm({ name: '', groupWeight: '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setIsAddingGroup(false)
  }

  async function saveEdit() {
    if (!editForm.name.trim()) return
    const isNew = isAddingGroup && editingId === null
    await pinGuard(`${isNew ? 'Created' : 'Updated'} assignment group "${editForm.name.trim()}"`, async () => {
      setSaving(true)
      setError(null)
      try {
        const fields = {
          name:        editForm.name.trim(),
          groupWeight: editForm.groupWeight !== '' ? parseFloat(editForm.groupWeight) : 0,
        }
        if (isNew) {
          const created = await createAssignmentGroup(courseId, { ...fields, position: groups.length + 1 })
          setGroups(prev => [...prev, created])
          setExpandedGroups(prev => ({ ...prev, [created.id]: true }))
          toast('Group created', 'success')
        } else {
          const updated = await updateAssignmentGroup(courseId, editingId, fields)
          setGroups(prev => prev.map(g => g.id === editingId ? updated : g))
          toast('Group updated', 'success')
        }
        setEditingId(null)
        setIsAddingGroup(false)
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    })
  }

  // ── Reorder ───────────────────────────────────────────────────────────────────

  async function swapPositions(indexA, indexB) {
    const a = groups[indexA]
    const b = groups[indexB]
    await pinGuard(`Reordered "${a.name}" and "${b.name}"`, async () => {
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

  // ── Duplicate ─────────────────────────────────────────────────────────────────

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
        setExpandedGroups(prev => ({ ...prev, [created.id]: true }))
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
    await pinGuard(`Merged "${mergeSource.name}" into "${target?.name}"`, async () => {
      setMerging(true)
      setError(null)
      try {
        await deleteAssignmentGroup(courseId, mergeSource.id, mergeTargetId)
        setAssignments(prev => prev.map(a =>
          a.assignmentGroupId === mergeSource.id ? { ...a, assignmentGroupId: mergeTargetId } : a
        ))
        setGroups(prev => prev.filter(g => g.id !== mergeSource.id))
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
        setDeleteTarget(null)
        toast('Group deleted', 'success')
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    })
  }

  // ── Move assignment ───────────────────────────────────────────────────────────

  async function moveAssignment(assignmentId, newGroupId) {
    const aName = assignments.find(a => a.id === assignmentId)?.name ?? assignmentId
    const gName = groups.find(g => g.id === newGroupId)?.name ?? newGroupId
    await pinGuard(`Moved "${aName}" to group "${gName}"`, async () => {
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

  const totalWeight   = groups.reduce((s, g) => s + (g.groupWeight ?? 0), 0)
  const weightDisplay = Math.round(totalWeight * 10) / 10
  const weightOk      = Math.abs(weightDisplay - 100) < 0.1
  const weightNonZero = weightDisplay > 0

  return (
    <div className="grid grid-cols-[260px_1fr] items-start gap-6">

      {/* Left sidebar: title, add button, stat cards */}
      <div className="space-y-4">
        <div>
          <h1 className="mb-3 text-2xl font-semibold text-[var(--color-text-body)]">
            Assignment Groups
          </h1>
          <Button
            variant="primary"
            icon={Plus}
            onClick={startNew}
            disabled={isAddingGroup}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Add Group
          </Button>
        </div>

        {!loadingGroups && groups.length > 0 && (
          <div className="space-y-3">
            <StatCard
              label="Assignment Groups"
              value={groups.length}
              icon={<FolderKanban size={18} className="text-[var(--color-domain-assignments)]" aria-hidden="true" />}
            />
            <StatCard
              label="Total Assignments"
              value={assignments.length}
              icon={<FileText size={18} className="text-[var(--color-domain-assignments)]" aria-hidden="true" />}
            />
          </div>
        )}
      </div>

      {/* Right column: error, group accordion, weight footer */}
      <div>
        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-error)] p-3 text-sm text-[var(--color-error)]"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 12%, var(--color-bg-surface))' }}
            role="alert"
          >
            <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
            {error}
            <button className="ml-auto text-[var(--color-error)] hover:opacity-80" onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="space-y-3">
          {loadingGroups
            ? [0, 1, 2, 3].map(i => <GroupCardSkeleton key={i} />)
            : groups.map((group, index) => (
              <GroupCard
                key={group.id}
                group={group}
                index={index}
                total={groups.length}
                count={(assignmentsByGroup[group.id] ?? []).length}
                assignments={assignmentsByGroup[group.id] ?? []}
                allGroups={groups}
                expanded={!!expandedGroups[group.id]}
                isEditing={editingId === group.id}
                editForm={editForm}
                onEditFormChange={setEditForm}
                saving={saving}
                loadingAssignments={loadingAssignments}
                movingId={movingId}
                onToggleExpand={() => toggleExpand(group.id)}
                onMoveUp={() => swapPositions(index, index - 1)}
                onMoveDown={() => swapPositions(index, index + 1)}
                onEdit={() => startEdit(group)}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onCopy={() => copyGroup(group)}
                onCopyTo={() => setCopyToGroup(group)}
                onMerge={() => openMergeModal(group)}
                onDelete={() => openDeleteModal(group)}
                onMoveAssignment={moveAssignment}
                deleteDisabled={groups.length <= 1}
                mergeDisabled={groups.length <= 1}
              />
            ))
          }

          {isAddingGroup && (
            <AddGroupForm
              form={editForm}
              onChange={setEditForm}
              onSave={saveEdit}
              onCancel={cancelEdit}
              saving={saving}
            />
          )}
        </div>

        {!loadingGroups && weightNonZero && (
          <div className="list-row-meta mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>Total weight:</span>
            <span className={`font-semibold ${weightOk ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
              {weightDisplay}%
            </span>
            {!weightOk && (
              <span className="text-[var(--color-warning)]">— should total 100% when weighting is enabled</span>
            )}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <Modal
          title={`Delete "${deleteTarget.name}"?`}
          size="sm"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete Group'}
              </Button>
            </>
          }
        >
          <p className="mb-1 text-sm text-[var(--color-text-secondary)]">
            This action is permanent and cannot be undone.
          </p>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            The {(assignmentsByGroup[deleteTarget.id] ?? []).length} assignment
            {(assignmentsByGroup[deleteTarget.id] ?? []).length !== 1 ? 's' : ''} in this group
            will be moved to another group before deletion.
          </p>
          {groups.filter(g => g.id !== deleteTarget.id).length > 0 && (
            <div>
              <label className="label" htmlFor="delete-move-to">Move assignments to</label>
              <select
                id="delete-move-to"
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
          title={`Merge "${mergeSource.name}"`}
          size="sm"
          onClose={() => setMergeSource(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setMergeSource(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmMerge} disabled={merging || !mergeTargetId}>
                {merging ? 'Merging…' : 'Merge Groups'}
              </Button>
            </>
          }
        >
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            All {(assignmentsByGroup[mergeSource.id] ?? []).length} assignment
            {(assignmentsByGroup[mergeSource.id] ?? []).length !== 1 ? 's' : ''} from{' '}
            <strong>&quot;{mergeSource.name}&quot;</strong> will be moved to the selected group,
            then the source group will be deleted.
          </p>
          <div>
            <label className="label" htmlFor="merge-into">Merge into</label>
            <select
              id="merge-into"
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

      {copyToGroup && (
        <CopyToCoursesModal
          assignments={assignmentsByGroup[copyToGroup.id] ?? []}
          sourceCourseId={courseId}
          onClose={() => setCopyToGroup(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
      <div>
        <p className="section-label !mb-0">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-[var(--color-text-body)]">{value}</p>
      </div>
      {icon}
    </div>
  )
}

function GroupCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <div className="flex items-center gap-3 bg-[var(--color-bg-hover)] p-3">
        <div className="h-7 w-7 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-7 w-16 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)]" />
          ))}
        </div>
      </div>
    </div>
  )
}

function GroupCard({
  group, index, total, count, assignments, allGroups, expanded,
  isEditing, editForm, onEditFormChange, saving, loadingAssignments, movingId,
  onToggleExpand, onMoveUp, onMoveDown,
  onEdit, onSaveEdit, onCancelEdit, onCopy, onCopyTo, onMerge, onDelete,
  onMoveAssignment, deleteDisabled, mergeDisabled,
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-hover)] p-3">
        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1.5 transition-colors hover:bg-[var(--color-bg-hover)]"
          aria-label={expanded ? 'Collapse group' : 'Expand group'}
        >
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>

        {/* Name / inline edit */}
        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="text"
              value={editForm.name}
              onChange={e => onEditFormChange(f => ({ ...f, name: e.target.value }))}
              className="input min-w-0 flex-1 py-1.5 text-sm font-semibold"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }}
            />
            <input
              type="number" min="0" max="100"
              value={editForm.groupWeight}
              onChange={e => onEditFormChange(f => ({ ...f, groupWeight: e.target.value }))}
              placeholder="0"
              className="input w-16 py-1.5 text-sm"
            />
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">%</span>
            <button
              onClick={onCancelEdit}
              className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)]"
              aria-label="Cancel edit"
            >
              <X size={13} aria-hidden="true" />
            </button>
            <button
              onClick={onSaveEdit}
              disabled={saving || !editForm.name.trim()}
              className="rounded-[var(--radius-control)] p-1.5 text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--cpt-color)' }}
              aria-label="Save group"
            >
              {saving ? <Loader size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-body)]">
              {group.name}
            </h3>
            <span className="shrink-0"><Badge tone="neutral">{count}</Badge></span>
            {group.groupWeight > 0 && (
              <span className="shrink-0"><Badge tone="muted">{group.groupWeight}%</Badge></span>
            )}
          </div>
        )}

        {/* Action toolbar */}
        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="mr-1 flex">
              <button
                onClick={onMoveUp}
                disabled={index === 0}
                className="rounded-[var(--radius-control)] p-1 text-[var(--color-text-disabled)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)] disabled:opacity-25"
                title="Move up"
                aria-label="Move group up"
              >
                <ChevronUp size={12} aria-hidden="true" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={index === total - 1}
                className="rounded-[var(--radius-control)] p-1 text-[var(--color-text-disabled)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)] disabled:opacity-25"
                title="Move down"
                aria-label="Move group down"
              >
                <ChevronDown size={12} aria-hidden="true" />
              </button>
            </div>
            <ToolbarBtn onClick={onEdit} icon={<Edit2 size={12} aria-hidden="true" />} label="Rename" />
            <ToolbarBtn onClick={onCopy} icon={<Copy size={12} aria-hidden="true" />} label="Duplicate" />
            <ToolbarBtn onClick={onCopyTo} disabled={!assignments.length} icon={<ExternalLink size={12} aria-hidden="true" />} label="Copy to" />
            <ToolbarBtn onClick={onMerge} disabled={mergeDisabled} icon={<GitMerge size={12} aria-hidden="true" />} label="Merge" />
            <ToolbarBtn
              onClick={onDelete}
              disabled={deleteDisabled}
              icon={<Trash2 size={12} aria-hidden="true" />}
              label="Delete"
              danger
            />
          </div>
        )}
      </div>

      {expanded && (
        <AssignmentList
          assignments={assignments}
          groups={allGroups}
          currentGroupId={group.id}
          loading={loadingAssignments}
          movingId={movingId}
          onMove={onMoveAssignment}
        />
      )}
    </div>
  )
}

function ToolbarBtn({ onClick, icon, label, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center gap-1 rounded-[var(--radius-control)] border bg-[var(--color-bg-surface)] px-2 py-1.5 transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-30',
        danger
          ? 'border-[var(--color-error)] text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_12%,var(--color-bg-surface))]'
          : 'border-[var(--color-border)] text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)]',
      ].join(' ')}
    >
      {icon}
      <span className="list-row-meta text-xs font-medium">{label}</span>
    </button>
  )
}

function AddGroupForm({ form, onChange, onSave, onCancel, saving }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-page)]">
      <div className="card-titlebar">
        <span className="flex items-center gap-2">
          <Plus size={13} aria-hidden="true" />
          Create new assignment group
        </span>
      </div>
      <div className="flex items-center gap-2 p-3">
        <input
          type="text"
          autoFocus
          value={form.name}
          onChange={e => onChange(f => ({ ...f, name: e.target.value }))}
          placeholder="Group name..."
          className="input flex-1 py-1.5 text-sm font-semibold"
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        />
        <input
          type="number" min="0" max="100"
          value={form.groupWeight}
          onChange={e => onChange(f => ({ ...f, groupWeight: e.target.value }))}
          placeholder="0"
          className="input w-16 py-1.5 text-sm"
        />
        <span className="shrink-0 text-xs text-[var(--color-text-muted)]">% weight</span>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving || !form.name.trim()}>
          {saving ? 'Creating…' : 'Create'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AssignmentList({ assignments, groups, currentGroupId, loading, movingId, onMove }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-[var(--color-text-muted)]">
        <Loader size={12} className="animate-spin" aria-hidden="true" /> Loading assignments…
      </div>
    )
  }
  if (assignments.length === 0) {
    return (
      <div className="mx-3 my-3 rounded-[var(--radius-card)] border-2 border-dashed border-[var(--color-border)] px-4 py-5 text-center text-xs text-[var(--color-text-muted)]">
        No assignments in this group.
      </div>
    )
  }
  return (
    <div className="p-3">
      <div className="list-row-meta grid grid-cols-12 gap-2 border-b border-[var(--color-border)] px-2 pb-1.5 text-xs font-medium text-[var(--color-text-muted)]">
        <div className="col-span-5">Assignment</div>
        <div className="col-span-2 text-right">Points</div>
        <div className="col-span-2">Due</div>
        <div className="col-span-3 text-right">Move to group</div>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {assignments.map(a => (
          <div key={a.id} className="grid grid-cols-12 items-center gap-2 px-2 py-2.5 transition-colors hover:bg-[var(--color-bg-hover)]">
            <div className="col-span-5 truncate text-xs text-[var(--color-text-body)]">{a.name}</div>
            <div className="col-span-2 text-right text-xs text-[var(--color-text-secondary)]">{a.pointsPossible ?? '—'}</div>
            <div className="col-span-2 text-xs text-[var(--color-text-secondary)]">{a.dueAt ? formatDate(a.dueAt) : '—'}</div>
            <div className="col-span-3 text-right">
              {movingId === a.id ? (
                <Loader size={12} className="ml-auto animate-spin text-[var(--color-text-muted)]" aria-hidden="true" />
              ) : (
                <select
                  value={currentGroupId}
                  onChange={e => onMove(a.id, e.target.value)}
                  className="input w-full px-2 py-1 text-xs"
                  aria-label={`Move ${a.name} to group`}
                >
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
