import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Trash, ChevronUp, ChevronDown, Check, X, AlertCircle,
         Loader, Copy, GitMerge, Edit2, FolderKanban, FileText, ExternalLink, ArrowUpDown, MoreHorizontal, FolderInput } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import Modal from '../../components/Modal.jsx'
import Menu from '../../components/Menu.jsx'
import CopyToCoursesModal from '../../components/CopyToCoursesModal.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import { formatDate } from '../../components/DateInput.jsx'
import { getAssignments, updateAssignment, deleteAssignment } from '../../api/assignments.js'
import {
  getAssignmentGroups,
  createAssignmentGroup,
  updateAssignmentGroup,
  deleteAssignmentGroup,
} from '../../api/assignmentGroups.js'
import { sortAssignments } from './bulkEditorHelpers.js'
import { usePinGate } from '../../security/usePinGate.jsx'

const SORT_OPTIONS = [
  { key: 'name', dir: 'asc', label: 'Name (A–Z)' },
  { key: 'name', dir: 'desc', label: 'Name (Z–A)' },
  { key: 'pointsPossible', dir: 'asc', label: 'Points (Low–High)' },
  { key: 'pointsPossible', dir: 'desc', label: 'Points (High–Low)' },
  { key: 'dueAt', dir: 'asc', label: 'Due Date (Earliest–Latest)' },
  { key: 'dueAt', dir: 'desc', label: 'Due Date (Latest–Earliest)' },
]

export default function AssignmentGroupManager({ courseId, courses }) {
  const toast = useToast()
  const { requirePin } = usePinGate()

  const [groups, setGroups]                 = useState([])
  const [loadingGroups, setLoadingGroups]   = useState(false)
  const [assignments, setAssignments]       = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const [expandedGroups, setExpandedGroups] = useState({})
  const [movingId, setMovingId]             = useState(null)
  const [reorderingGroupId, setReorderingGroupId] = useState(null)
  const [groupSortState, setGroupSortState] = useState({})

  const [deleteAssignmentsGroup, setDeleteAssignmentsGroup] = useState(null)
  const [selectedDeleteIds, setSelectedDeleteIds]           = useState(new Set())
  const [deletingAssignments, setDeletingAssignments]       = useState(false)

  const [moveAssignmentsGroup, setMoveAssignmentsGroup] = useState(null)
  const [selectedMoveIds, setSelectedMoveIds]           = useState(new Set())
  const [moveTargetGroupId, setMoveTargetGroupId]       = useState(null)
  const [movingAssignments, setMovingAssignments]       = useState(false)

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
    for (const gId in map) map[gId].sort((a, b) => a.position - b.position)
    return map
  }, [assignments])

  function pinGuard(summary, action, options = {}) {
    const { actionType = 'assignment_group_change', warning, forcePrompt = false } = options
    const courseName = courses.find(c => c.id === courseId)?.name ?? courseId
    return requirePin({ action: actionType, summary, courseId, courseName, warning }, action, { forcePrompt })
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

  // ── Reorder assignment within group ──────────────────────────────────────────

  // Canvas has no bulk reorder endpoint for assignments within a group —
  // position is set per-assignment via the update assignment endpoint
  // (assignment[position]), same as ASN-003 in the product backlog notes.
  async function moveAssignmentPosition(groupId, assignmentId, direction) {
    const groupAssignments = assignmentsByGroup[groupId] ?? []
    const index = groupAssignments.findIndex(a => a.id === assignmentId)
    const targetIndex = index + direction
    if (index === -1 || targetIndex < 0 || targetIndex >= groupAssignments.length) return

    const a = groupAssignments[index]
    const b = groupAssignments[targetIndex]

    await pinGuard(`Reordered "${a.name}" and "${b.name}"`, async () => {
      setReorderingGroupId(groupId)
      setError(null)
      try {
        await Promise.all([
          updateAssignment(courseId, a.id, { position: b.position }),
          updateAssignment(courseId, b.id, { position: a.position }),
        ])
        setAssignments(prev => prev.map(x => {
          if (x.id === a.id) return { ...x, position: b.position }
          if (x.id === b.id) return { ...x, position: a.position }
          return x
        }))
        // A manual nudge can break whatever sort was previously applied.
        setGroupSortState(prev => {
          if (!(groupId in prev)) return prev
          const next = { ...prev }
          delete next[groupId]
          return next
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setReorderingGroupId(null)
      }
    })
  }

  async function sortGroupAssignments(groupId, sortKey, sortDir) {
    const groupAssignments = assignmentsByGroup[groupId] ?? []
    if (groupAssignments.length < 2) return
    const sorted = sortAssignments(groupAssignments, sortKey, sortDir)
    const groupName = groups.find(g => g.id === groupId)?.name ?? groupId
    const toUpdate = sorted
      .map((a, i) => ({ id: a.id, newPosition: i + 1, changed: a.position !== i + 1 }))
      .filter(a => a.changed)

    if (toUpdate.length === 0) {
      setGroupSortState(prev => ({ ...prev, [groupId]: { key: sortKey, dir: sortDir } }))
      return
    }

    await pinGuard(`Sorted assignments in "${groupName}"`, async () => {
      setReorderingGroupId(groupId)
      setError(null)
      try {
        for (const a of toUpdate) {
          await updateAssignment(courseId, a.id, { position: a.newPosition })
        }
        const positionById = new Map(toUpdate.map(a => [a.id, a.newPosition]))
        setAssignments(prev => prev.map(x =>
          positionById.has(x.id) ? { ...x, position: positionById.get(x.id) } : x
        ))
        setGroupSortState(prev => ({ ...prev, [groupId]: { key: sortKey, dir: sortDir } }))
        toast('Assignments sorted', 'success')
      } catch (err) {
        setError(err.message)
      } finally {
        setReorderingGroupId(null)
      }
    })
  }

  // ── Delete assignments (scoped to one group) ──────────────────────────────────

  function openDeleteAssignmentsModal(group) {
    setDeleteAssignmentsGroup(group)
    setSelectedDeleteIds(new Set())
  }

  function toggleDeleteSelection(assignmentId) {
    setSelectedDeleteIds(prev => {
      const next = new Set(prev)
      next.has(assignmentId) ? next.delete(assignmentId) : next.add(assignmentId)
      return next
    })
  }

  async function confirmDeleteAssignments() {
    const group = deleteAssignmentsGroup
    const toDelete = (assignmentsByGroup[group.id] ?? []).filter(a => selectedDeleteIds.has(a.id))
    if (toDelete.length === 0) return
    const count = toDelete.length

    try {
      await pinGuard(
        `Deleted ${count} assignment${count !== 1 ? 's' : ''} from "${group.name}"`,
        async () => {
          setDeletingAssignments(true)
          setError(null)
          const failures = []
          const succeededIds = []
          for (const a of toDelete) {
            try {
              await deleteAssignment(courseId, a.id)
              succeededIds.push(a.id)
            } catch (err) {
              failures.push({ name: a.name, reason: err.message })
            }
          }
          if (succeededIds.length > 0) {
            setAssignments(prev => prev.filter(a => !succeededIds.includes(a.id)))
          }
          setDeletingAssignments(false)
          if (failures.length === 0) {
            toast(`${succeededIds.length} assignment${succeededIds.length !== 1 ? 's' : ''} deleted`, 'success')
            setDeleteAssignmentsGroup(null)
          } else {
            setError(`Deleted ${succeededIds.length} of ${count}. Failed: ${failures.map(f => f.name).join(', ')}`)
          }
        },
        {
          actionType: 'assignment_delete',
          forcePrompt: true,
          warning: `This permanently deletes ${count} assignment${count !== 1 ? 's' : ''} from Canvas — including all student submissions and grades. This cannot be undone.`,
        },
      )
    } catch (err) {
      setDeletingAssignments(false)
      setError(err.message)
    }
  }

  // ── Move assignments in bulk (scoped to one group) ────────────────────────────

  function openMoveAssignmentsModal(group) {
    const fallback = groups.find(g => g.id !== group.id)?.id ?? null
    setMoveAssignmentsGroup(group)
    setSelectedMoveIds(new Set())
    setMoveTargetGroupId(fallback)
  }

  function toggleMoveSelection(assignmentId) {
    setSelectedMoveIds(prev => {
      const next = new Set(prev)
      next.has(assignmentId) ? next.delete(assignmentId) : next.add(assignmentId)
      return next
    })
  }

  async function confirmMoveAssignments() {
    const group = moveAssignmentsGroup
    const toMove = (assignmentsByGroup[group.id] ?? []).filter(a => selectedMoveIds.has(a.id))
    const target = groups.find(g => g.id === moveTargetGroupId)
    if (toMove.length === 0 || !target) return
    const count = toMove.length

    await pinGuard(`Moved ${count} assignment${count !== 1 ? 's' : ''} from "${group.name}" to "${target.name}"`, async () => {
      setMovingAssignments(true)
      setError(null)
      const failures = []
      const succeededIds = []
      for (const a of toMove) {
        try {
          await updateAssignment(courseId, a.id, { assignmentGroupId: target.id })
          succeededIds.push(a.id)
        } catch (err) {
          failures.push({ name: a.name, reason: err.message })
        }
      }
      if (succeededIds.length > 0) {
        setAssignments(prev => prev.map(a =>
          succeededIds.includes(a.id) ? { ...a, assignmentGroupId: target.id } : a
        ))
      }
      setMovingAssignments(false)
      if (failures.length === 0) {
        toast(`${succeededIds.length} assignment${succeededIds.length !== 1 ? 's' : ''} moved to "${target.name}"`, 'success')
        setMoveAssignmentsGroup(null)
      } else {
        setError(`Moved ${succeededIds.length} of ${count}. Failed: ${failures.map(f => f.name).join(', ')}`)
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
                reordering={reorderingGroupId === group.id}
                sortState={groupSortState[group.id]}
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
                onDeleteAssignments={() => openDeleteAssignmentsModal(group)}
                onMoveAssignments={() => openMoveAssignmentsModal(group)}
                onMoveAssignment={moveAssignment}
                onReorderAssignment={(assignmentId, direction) => moveAssignmentPosition(group.id, assignmentId, direction)}
                onSortGroup={(sortKey, sortDir) => sortGroupAssignments(group.id, sortKey, sortDir)}
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

      {/* Delete assignments modal */}
      {deleteAssignmentsGroup && (
        <Modal
          title={`Delete assignments from "${deleteAssignmentsGroup.name}"`}
          size="md"
          onClose={() => !deletingAssignments && setDeleteAssignmentsGroup(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteAssignmentsGroup(null)} disabled={deletingAssignments}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDeleteAssignments}
                disabled={deletingAssignments || selectedDeleteIds.size === 0}
              >
                {deletingAssignments
                  ? 'Deleting…'
                  : `Delete ${selectedDeleteIds.size} Assignment${selectedDeleteIds.size !== 1 ? 's' : ''}`}
              </Button>
            </>
          }
        >
          <p className="mb-4 text-sm font-semibold text-[var(--color-error)]">
            This permanently deletes the selected assignments from Canvas — including all
            student submissions and grades. This cannot be undone.
          </p>

          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-body)]">
              <input
                type="checkbox"
                checked={
                  selectedDeleteIds.size > 0 &&
                  selectedDeleteIds.size === (assignmentsByGroup[deleteAssignmentsGroup.id] ?? []).length
                }
                onChange={e => setSelectedDeleteIds(
                  e.target.checked
                    ? new Set((assignmentsByGroup[deleteAssignmentsGroup.id] ?? []).map(a => a.id))
                    : new Set()
                )}
                disabled={deletingAssignments}
              />
              Select all
            </label>
            <span className="text-xs text-[var(--color-text-muted)]">{selectedDeleteIds.size} selected</span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {(assignmentsByGroup[deleteAssignmentsGroup.id] ?? []).map(a => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-hover)]"
              >
                <input
                  type="checkbox"
                  checked={selectedDeleteIds.has(a.id)}
                  onChange={() => toggleDeleteSelection(a.id)}
                  disabled={deletingAssignments}
                />
                <span className="flex-1 truncate text-[var(--color-text-body)]">{a.name}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{a.pointsPossible ?? '—'} pts</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* Move assignments modal */}
      {moveAssignmentsGroup && (
        <Modal
          title={`Move assignments from "${moveAssignmentsGroup.name}"`}
          size="md"
          onClose={() => !movingAssignments && setMoveAssignmentsGroup(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setMoveAssignmentsGroup(null)} disabled={movingAssignments}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={confirmMoveAssignments}
                disabled={movingAssignments || selectedMoveIds.size === 0 || !moveTargetGroupId}
              >
                {movingAssignments
                  ? 'Moving…'
                  : `Move ${selectedMoveIds.size} Assignment${selectedMoveIds.size !== 1 ? 's' : ''}`}
              </Button>
            </>
          }
        >
          <div className="mb-4">
            <label className="label" htmlFor="move-assignments-target">Move to group</label>
            <select
              id="move-assignments-target"
              value={moveTargetGroupId ?? ''}
              onChange={e => setMoveTargetGroupId(e.target.value)}
              disabled={movingAssignments}
              className="input"
            >
              {groups.filter(g => g.id !== moveAssignmentsGroup.id).map(g =>
                <option key={g.id} value={g.id}>{g.name}</option>
              )}
            </select>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-body)]">
              <input
                type="checkbox"
                checked={
                  selectedMoveIds.size > 0 &&
                  selectedMoveIds.size === (assignmentsByGroup[moveAssignmentsGroup.id] ?? []).length
                }
                onChange={e => setSelectedMoveIds(
                  e.target.checked
                    ? new Set((assignmentsByGroup[moveAssignmentsGroup.id] ?? []).map(a => a.id))
                    : new Set()
                )}
                disabled={movingAssignments}
              />
              Select all
            </label>
            <span className="text-xs text-[var(--color-text-muted)]">{selectedMoveIds.size} selected</span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {(assignmentsByGroup[moveAssignmentsGroup.id] ?? []).map(a => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-hover)]"
              >
                <input
                  type="checkbox"
                  checked={selectedMoveIds.has(a.id)}
                  onChange={() => toggleMoveSelection(a.id)}
                  disabled={movingAssignments}
                />
                <span className="flex-1 truncate text-[var(--color-text-body)]">{a.name}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{a.pointsPossible ?? '—'} pts</span>
              </label>
            ))}
          </div>
        </Modal>
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
  isEditing, editForm, onEditFormChange, saving, loadingAssignments, movingId, reordering, sortState,
  onToggleExpand, onMoveUp, onMoveDown,
  onEdit, onSaveEdit, onCancelEdit, onCopy, onCopyTo, onMerge, onDelete, onDeleteAssignments, onMoveAssignments,
  onMoveAssignment, onReorderAssignment, onSortGroup, deleteDisabled, mergeDisabled,
}) {
  const sortLabel = sortState
    ? SORT_OPTIONS.find(o => o.key === sortState.key && o.dir === sortState.dir)?.label
    : null
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
            {reordering && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <Loader size={12} className="animate-spin" aria-hidden="true" />
                Sorting…
              </span>
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
            <ToolbarBtn onClick={onEdit} disabled={reordering} icon={<Edit2 size={12} aria-hidden="true" />} label="Rename" />
            <Menu
              align="left"
              width="14rem"
              trigger={p => (
                <ToolbarBtn
                  {...p}
                  icon={<ArrowUpDown size={12} aria-hidden="true" />}
                  label={sortLabel ?? 'Sort'}
                  disabled={reordering || count < 2}
                  showChevron
                />
              )}
            >
              {SORT_OPTIONS.map(opt => (
                <Menu.Item
                  key={`${opt.key}:${opt.dir}`}
                  icon={sortState?.key === opt.key && sortState?.dir === opt.dir ? Check : undefined}
                  onSelect={() => onSortGroup(opt.key, opt.dir)}
                >
                  {opt.label}
                </Menu.Item>
              ))}
            </Menu>
            <Menu
              trigger={p => (
                <ToolbarBtn {...p} icon={<MoreHorizontal size={12} aria-hidden="true" />} label="Actions" disabled={reordering} showChevron />
              )}
            >
              <Menu.Item icon={Copy} onSelect={onCopy}>Duplicate</Menu.Item>
              <Menu.Item icon={ExternalLink} onSelect={onCopyTo} disabled={!assignments.length}>Copy to</Menu.Item>
              <Menu.Item icon={GitMerge} onSelect={onMerge} disabled={mergeDisabled}>Merge</Menu.Item>
              <Menu.Submenu icon={FolderKanban} label="Manage">
                <Menu.Item icon={FolderInput} onSelect={onMoveAssignments} disabled={!assignments.length || mergeDisabled}>Move assignments</Menu.Item>
                <Menu.Item icon={Trash} onSelect={onDeleteAssignments} disabled={!assignments.length} danger>Delete assignments</Menu.Item>
              </Menu.Submenu>
              <Menu.Item icon={Trash2} onSelect={onDelete} disabled={deleteDisabled} danger>Delete Group</Menu.Item>
            </Menu>
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
          reordering={reordering}
          onMove={onMoveAssignment}
          onReorder={onReorderAssignment}
        />
      )}
    </div>
  )
}

function ToolbarBtn({ onClick, icon, label, disabled, danger, showChevron, ...rest }) {
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
      {...rest}
    >
      {icon}
      <span className="list-row-meta text-xs font-medium">{label}</span>
      {showChevron && <ChevronDown size={10} aria-hidden="true" className="opacity-60" />}
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

function AssignmentList({ assignments, groups, currentGroupId, loading, movingId, reordering, onMove, onReorder }) {
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
        <div className="col-span-1" aria-hidden="true" />
        <div className="col-span-4">Assignment</div>
        <div className="col-span-2 text-right">Points</div>
        <div className="col-span-2">Due</div>
        <div className="col-span-3 text-right">Move to group</div>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {assignments.map((a, i) => (
          <div key={a.id} className="grid grid-cols-12 items-center gap-2 px-2 py-2.5 transition-colors hover:bg-[var(--color-bg-hover)]">
            <div className="col-span-1 flex shrink-0">
              <button
                onClick={() => onReorder(a.id, -1)}
                disabled={reordering || i === 0}
                className="rounded-[var(--radius-control)] p-0.5 text-[var(--color-text-disabled)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)] disabled:opacity-25"
                title="Move up"
                aria-label={`Move ${a.name} up`}
              >
                <ChevronUp size={12} aria-hidden="true" />
              </button>
              <button
                onClick={() => onReorder(a.id, 1)}
                disabled={reordering || i === assignments.length - 1}
                className="rounded-[var(--radius-control)] p-0.5 text-[var(--color-text-disabled)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)] disabled:opacity-25"
                title="Move down"
                aria-label={`Move ${a.name} down`}
              >
                <ChevronDown size={12} aria-hidden="true" />
              </button>
            </div>
            <div className="col-span-4 truncate text-xs text-[var(--color-text-body)]">{a.name}</div>
            <div className="col-span-2 text-right text-xs text-[var(--color-text-secondary)]">{a.pointsPossible ?? '—'}</div>
            <div className="col-span-2 text-xs text-[var(--color-text-secondary)]">{a.dueAt ? formatDate(a.dueAt) : '—'}</div>
            <div className="col-span-3 text-right">
              {movingId === a.id ? (
                <Loader size={12} className="ml-auto animate-spin text-[var(--color-text-muted)]" aria-hidden="true" />
              ) : (
                <select
                  value={currentGroupId}
                  onChange={e => onMove(a.id, e.target.value)}
                  disabled={reordering}
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
