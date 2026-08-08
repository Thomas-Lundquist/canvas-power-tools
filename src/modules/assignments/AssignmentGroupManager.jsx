import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Check, X, AlertCircle,
         Loader, Copy, GitMerge, Edit2, FolderKanban, FileText, ExternalLink } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import CopyToCoursesModal from '../../components/CopyToCoursesModal.jsx'
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
    <div className="grid grid-cols-[260px_1fr] gap-6 items-start">

      {/* Left sidebar: title, add button, stat cards */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-body)] uppercase mb-3">
            Assignment Groups
          </h1>
          <button
            className="btn-primary flex items-center gap-1.5 text-xs font-mono font-bold uppercase w-full justify-center"
            onClick={startNew}
            disabled={isAddingGroup}
          >
            <Plus size={13} /> ADD GROUP
          </button>
        </div>

        {!loadingGroups && groups.length > 0 && (
          <div className="space-y-3">
            <StatCard
              label="Assignment Groups"
              value={groups.length}
              icon={<FolderKanban size={18} className="text-[var(--color-domain-assignments)]" />}
            />
            <StatCard
              label="Total Assignments"
              value={assignments.length}
              icon={<FileText size={18} className="text-[var(--color-domain-assignments)]" />}
            />
          </div>
        )}
      </div>

      {/* Right column: error, group accordion, weight footer */}
      <div>
        {error && (
          <div className="mb-4 border border-[var(--color-domain-alert)] bg-[color-mix(in_srgb,var(--color-domain-alert)_12%,var(--color-bg-surface))] rounded-[2px] p-3 flex items-center gap-2 text-sm text-[var(--color-domain-alert)]">
            <AlertCircle size={14} className="shrink-0" />
            {error}
            <button className="ml-auto text-[var(--color-domain-alert)] hover:text-[color-mix(in_srgb,var(--color-domain-alert)_80%,black)]" onClick={() => setError(null)}>
              <X size={14} />
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
          <div className="mt-4 flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)]">
            <span className="uppercase tracking-wide">Total weight:</span>
            <span className={`font-bold ${weightOk ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
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
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="px-4 py-2 rounded-[2px] text-sm font-medium text-white bg-[var(--color-domain-alert)] disabled:opacity-50"
                onClick={confirmDelete}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete Group'}
              </button>
            </>
          }
        >
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">
            This action is permanent and cannot be undone.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            The {(assignmentsByGroup[deleteTarget.id] ?? []).length} assignment
            {(assignmentsByGroup[deleteTarget.id] ?? []).length !== 1 ? 's' : ''} in this group
            will be moved to another group before deletion.
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
          title={`Merge "${mergeSource.name}"`}
          size="sm"
          onClose={() => setMergeSource(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setMergeSource(null)}>Cancel</button>
              <button
                className="btn-primary disabled:opacity-50"
                onClick={confirmMerge}
                disabled={merging || !mergeTargetId}
              >
                {merging ? 'Merging…' : 'Merge Groups'}
              </button>
            </>
          }
        >
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            All {(assignmentsByGroup[mergeSource.id] ?? []).length} assignment
            {(assignmentsByGroup[mergeSource.id] ?? []).length !== 1 ? 's' : ''} from{' '}
            <strong>"{mergeSource.name}"</strong> will be moved to the selected group,
            then the source group will be deleted.
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
    <div className="bg-[var(--color-bg-surface)] border-2 border-[var(--color-stroke)] rounded-[2px] p-4 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-mono font-bold uppercase text-[var(--color-text-muted)] tracking-wide">{label}</p>
        <p className="text-2xl font-black text-[var(--color-text-body)] font-mono mt-0.5">{value}</p>
      </div>
      {icon}
    </div>
  )
}

function GroupCardSkeleton() {
  return (
    <div className="bg-[var(--color-bg-surface)] border-2 border-[var(--color-stroke)] rounded-[2px] overflow-hidden">
      <div className="p-3 bg-[var(--color-container-inset)] flex items-center gap-3">
        <div className="w-7 h-7 bg-[var(--color-border)] rounded-[1px] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 bg-[var(--color-border)] rounded animate-pulse" />
          <div className="h-3 w-20 bg-[var(--color-border)] rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-16 h-7 bg-[var(--color-border)] rounded-[1px] animate-pulse" />
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
    <div className="bg-[var(--color-bg-surface)] border-2 border-[var(--color-stroke)] rounded-[2px] overflow-hidden">
      <div className="bg-[var(--color-container-inset)] border-b border-[var(--color-stroke)] p-3 flex flex-wrap items-center gap-3">
        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="p-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-stroke)] rounded-[1px] hover:bg-[var(--color-bg-hover)] transition-colors"
          aria-label={expanded ? 'Collapse group' : 'Expand group'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Name / inline edit */}
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={editForm.name}
              onChange={e => onEditFormChange(f => ({ ...f, name: e.target.value }))}
              className="input text-sm py-1.5 flex-1 min-w-0 font-bold"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }}
            />
            <input
              type="number" min="0" max="100"
              value={editForm.groupWeight}
              onChange={e => onEditFormChange(f => ({ ...f, groupWeight: e.target.value }))}
              placeholder="0"
              className="input w-16 text-sm py-1.5"
            />
            <span className="text-xs text-[var(--color-text-muted)] font-mono shrink-0">%</span>
            <button
              onClick={onCancelEdit}
              className="p-1.5 rounded-[1px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <X size={13} />
            </button>
            <button
              onClick={onSaveEdit}
              disabled={saving || !editForm.name.trim()}
              className="p-1.5 rounded-[1px] text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--cpt-color)' }}
            >
              {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-extrabold text-sm text-[var(--color-text-body)] uppercase tracking-tight truncate">
              {group.name}
            </h3>
            <span className="shrink-0 px-1.5 py-0.5 bg-[var(--color-bg-surface)] border border-[var(--color-stroke)] font-mono text-[10px] font-bold text-[var(--color-text-muted)]">
              {count}
            </span>
            {group.groupWeight > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 bg-[var(--color-bg-surface)] border border-[var(--color-stroke)] font-mono text-[10px] font-bold text-[var(--color-text-secondary)]">
                {group.groupWeight}%
              </span>
            )}
          </div>
        )}

        {/* Action toolbar */}
        {!isEditing && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex mr-1">
              <button
                onClick={onMoveUp}
                disabled={index === 0}
                className="p-1 text-[var(--color-text-disabled)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] disabled:opacity-25 rounded-[1px] transition-colors"
                title="Move up"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={onMoveDown}
                disabled={index === total - 1}
                className="p-1 text-[var(--color-text-disabled)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] disabled:opacity-25 rounded-[1px] transition-colors"
                title="Move down"
              >
                <ChevronDown size={12} />
              </button>
            </div>
            <ToolbarBtn onClick={onEdit} icon={<Edit2 size={12} />} label="RENAME" />
            <ToolbarBtn onClick={onCopy} icon={<Copy size={12} />} label="DUPLICATE" />
            <ToolbarBtn onClick={onCopyTo} disabled={!assignments.length} icon={<ExternalLink size={12} />} label="COPY TO" />
            <ToolbarBtn onClick={onMerge} disabled={mergeDisabled} icon={<GitMerge size={12} />} label="MERGE" />
            <ToolbarBtn
              onClick={onDelete}
              disabled={deleteDisabled}
              icon={<Trash2 size={12} />}
              label="DELETE"
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
        'px-2 py-1.5 bg-[var(--color-bg-surface)] border font-mono font-bold text-[10px] uppercase',
        'rounded-[1px] flex items-center gap-1 transition-colors',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        danger
          ? 'border-[var(--color-domain-alert)] text-[var(--color-domain-alert)] hover:bg-[color-mix(in_srgb,var(--color-domain-alert)_12%,var(--color-bg-surface))]'
          : 'border-[var(--color-stroke)] text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)]',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function AddGroupForm({ form, onChange, onSave, onCancel, saving }) {
  return (
    <div className="border-2 border-[var(--color-stroke)] rounded-[2px] overflow-hidden" style={{ backgroundColor: '#FEF08A' }}>
      <div className="px-3 py-2 border-b border-[var(--color-stroke)] flex items-center gap-2 font-mono font-extrabold text-xs uppercase text-[var(--color-text-body)]">
        <Plus size={13} />
        <span>Create New Assignment Group</span>
      </div>
      <div className="p-3 flex items-center gap-2">
        <input
          type="text"
          autoFocus
          value={form.name}
          onChange={e => onChange(f => ({ ...f, name: e.target.value }))}
          placeholder="Group name..."
          className="input flex-1 text-sm py-1.5 font-bold"
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        />
        <input
          type="number" min="0" max="100"
          value={form.groupWeight}
          onChange={e => onChange(f => ({ ...f, groupWeight: e.target.value }))}
          placeholder="0"
          className="input w-16 text-sm py-1.5"
        />
        <span className="text-xs text-[var(--color-text-muted)] font-mono shrink-0">% weight</span>
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="px-4 py-1.5 bg-[var(--color-stroke)] text-white font-mono font-bold text-xs uppercase rounded-[1px] hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {saving ? 'Creating…' : 'CREATE'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-stroke)] font-mono font-bold text-xs uppercase rounded-[1px] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}

function AssignmentList({ assignments, groups, currentGroupId, loading, movingId, onMove }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-mono px-4 py-3">
        <Loader size={12} className="animate-spin" /> Loading assignments…
      </div>
    )
  }
  if (assignments.length === 0) {
    return (
      <div className="mx-3 my-3 px-4 py-5 text-center border-2 border-dashed border-[var(--color-border)] rounded-[2px] font-mono text-xs text-[var(--color-text-muted)] uppercase">
        No assignments in this group.
      </div>
    )
  }
  return (
    <div className="p-3">
      <div className="grid grid-cols-12 gap-2 text-[10px] font-mono font-bold text-[var(--color-text-muted)] uppercase px-2 pb-1.5 border-b border-[var(--color-border)]">
        <div className="col-span-5">Assignment</div>
        <div className="col-span-2 text-right">Points</div>
        <div className="col-span-2">Due</div>
        <div className="col-span-3 text-right">Move to Group</div>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {assignments.map(a => (
          <div key={a.id} className="grid grid-cols-12 gap-2 items-center px-2 py-2.5 hover:bg-[var(--color-bg-hover)] transition-colors">
            <div className="col-span-5 text-xs text-[var(--color-text-body)] truncate">{a.name}</div>
            <div className="col-span-2 text-right text-xs text-[var(--color-text-secondary)]">{a.pointsPossible ?? '—'}</div>
            <div className="col-span-2 text-xs text-[var(--color-text-secondary)]">{a.dueAt ? formatDate(a.dueAt) : '—'}</div>
            <div className="col-span-3 text-right">
              {movingId === a.id ? (
                <Loader size={12} className="animate-spin text-[var(--color-text-muted)] ml-auto" />
              ) : (
                <select
                  value={currentGroupId}
                  onChange={e => onMove(a.id, e.target.value)}
                  className="text-xs border border-[var(--color-border)] rounded-[1px] px-2 py-1 bg-[var(--color-bg-surface)] text-[var(--color-text-body)] font-mono w-full"
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
