import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, AlertCircle, Loader } from 'lucide-react'
import CourseSelector from '../../components/CourseSelector.jsx'
import Modal from '../../components/Modal.jsx'
import { getCourses } from '../../api/courses.js'
import {
  getAssignmentGroups,
  createAssignmentGroup,
  updateAssignmentGroup,
  deleteAssignmentGroup,
} from '../../api/assignmentGroups.js'

export default function AssignmentGroupManager({ initialCourseId }) {
  const [courses, setCourses]             = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]           = useState(null)
  const [groups, setGroups]               = useState([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [editingId, setEditingId]         = useState(null)   // group id | 'new' | null
  const [editForm, setEditForm]           = useState({ name: '', groupWeight: '' })
  const [deleteTarget, setDeleteTarget]   = useState(null)   // group to delete
  const [deleteMoveToId, setDeleteMoveToId] = useState(null)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list)
        const start = initialCourseId && list.find(c => c.id === String(initialCourseId))
          ? String(initialCourseId)
          : list[0]?.id ?? null
        if (start) loadGroups(start)
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  async function loadGroups(cId) {
    setCourseId(cId)
    setGroups([])
    setEditingId(null)
    setError(null)
    setLoadingGroups(true)
    try {
      const data = await getAssignmentGroups(cId)
      setGroups(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingGroups(false)
    }
  }

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
      } else {
        const updated = await updateAssignmentGroup(courseId, editingId, fields)
        setGroups(prev => prev.map(g => g.id === editingId ? updated : g))
      }
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function swapPositions(indexA, indexB) {
    const a = groups[indexA]
    const b = groups[indexB]
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
  }

  function openDeleteModal(group) {
    const fallback = groups.find(g => g.id !== group.id)?.id ?? null
    setDeleteTarget(group)
    setDeleteMoveToId(fallback)
  }

  async function confirmDelete() {
    setSaving(true)
    setError(null)
    try {
      await deleteAssignmentGroup(courseId, deleteTarget.id, deleteMoveToId)
      setGroups(prev => prev.filter(g => g.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalWeight   = groups.reduce((s, g) => s + (g.groupWeight ?? 0), 0)
  const weightDisplay = Math.round(totalWeight * 10) / 10
  const weightOk      = Math.abs(weightDisplay - 100) < 0.1
  const weightNonZero = weightDisplay > 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assignment Groups</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage assignment groups and grade weights. Reorder, rename, or adjust weights for a course.
        </p>
      </div>

      <div className="card p-4 mb-6 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600 shrink-0">Course</span>
        <CourseSelector courses={courses} selectedId={courseId} onChange={loadGroups} loading={loadingCourses} />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className="card overflow-hidden mb-4">
        {loadingGroups ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm p-6">
            <Loader size={14} className="animate-spin" /> Loading groups...
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-16 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Order</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Group Name</th>
                  <th className="w-32 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Weight</th>
                  <th className="w-24 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groups.map((group, index) =>
                  editingId === group.id ? (
                    <EditRow
                      key={group.id}
                      index={index}
                      form={editForm}
                      onChange={setEditForm}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      saving={saving}
                    />
                  ) : (
                    <GroupRow
                      key={group.id}
                      group={group}
                      index={index}
                      total={groups.length}
                      onMoveUp={() => swapPositions(index, index - 1)}
                      onMoveDown={() => swapPositions(index, index + 1)}
                      onEdit={() => startEdit(group)}
                      onDelete={() => openDeleteModal(group)}
                      deleteDisabled={groups.length <= 1}
                    />
                  )
                )}

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
                  />
                )}
              </tbody>
            </table>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Total weight:{' '}
                <span className={`font-semibold ${weightOk ? 'text-green-600' : weightNonZero ? 'text-yellow-600' : 'text-gray-400'}`}>
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
          </>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Grade weighting is enabled or disabled in Canvas Course Settings. Weights set here only affect grades when weighting is active.
      </p>

      {deleteTarget && (
        <Modal
          title={`Delete "${deleteTarget.name}"?`}
          size="sm"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#dc2626' }}
                onClick={confirmDelete}
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete Group'}
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600 mb-4">
            Any assignments in this group will be moved to another group before deletion.
          </p>
          {groups.filter(g => g.id !== deleteTarget.id).length > 0 && (
            <div>
              <label className="label">Move assignments to</label>
              <select
                value={deleteMoveToId ?? ''}
                onChange={e => setDeleteMoveToId(e.target.value)}
                className="input"
              >
                {groups
                  .filter(g => g.id !== deleteTarget.id)
                  .map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function GroupRow({ group, index, total, onMoveUp, onMoveDown, onEdit, onDelete, deleteDisabled }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-3">
        <div className="flex items-center gap-0.5">
          <button
            className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed"
            onClick={onMoveUp} disabled={index === 0} title="Move up"
          >
            <ChevronUp size={13} />
          </button>
          <button
            className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed"
            onClick={onMoveDown} disabled={index === total - 1} title="Move down"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </td>
      <td className="px-3 py-3 font-medium text-gray-900">{group.name}</td>
      <td className="px-3 py-3 text-gray-500 text-sm">
        {group.groupWeight > 0 ? `${group.groupWeight}%` : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" onClick={onEdit} title="Edit">
            <Pencil size={13} />
          </button>
          <button
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={onDelete} disabled={deleteDisabled} title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function EditRow({ index, form, onChange, onSave, onCancel, saving, isNew }) {
  return (
    <tr className={isNew ? 'bg-gray-50' : ''}>
      <td className="px-3 py-2.5 text-xs text-gray-300">{index + 1}</td>
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
          <span className="text-xs text-gray-400">%</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 justify-end">
          <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" onClick={onCancel} title="Cancel">
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
