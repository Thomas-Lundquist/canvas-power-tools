import { useState, useEffect, useMemo, useRef } from 'react'
import { Loader, Plus, Pencil, Trash2, Users, ChevronRight, Shuffle,
         AlertCircle, Check, Search, X } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import AutoAssignModal from './AutoAssignModal.jsx'
import {
  getGroupCategories, createGroupCategory, updateGroupCategory, deleteGroupCategory,
  getGroupsInCategory, createGroup, updateGroup, deleteGroup,
  getGroupMembers, addGroupMember, removeGroupMember,
} from '../../api/groups.js'
import { getEnrollments } from '../../api/enrollments.js'
import { getCourses } from '../../api/courses.js'

const DRAG_TYPE = 'text/plain'

export default function GroupManager({ initialCourseId }) {
  const toast = useToast()

  const [courses, setCourseList]            = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(initialCourseId ?? null)
  const [categories, setCategories]         = useState([])
  const [loadingCats, setLoadingCats]       = useState(false)
  const [activeCat, setActiveCat]           = useState(null)
  const [groups, setGroups]                 = useState([])
  const [memberships, setMemberships]       = useState({})  // { groupId: [{ id, userId }] }
  const [students, setStudents]             = useState([])  // all enrolled
  const [loadingGroups, setLoadingGroups]   = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [applying, setApplying]             = useState(false)
  const [applyResult, setApplyResult]       = useState(null)

  const [editingCatId, setEditingCatId]     = useState(null)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [creatingCat, setCreatingCat]       = useState(false)
  const [newCatName, setNewCatName]         = useState('')
  const [creatingGroup, setCreatingGroup]   = useState(false)
  const [newGroupName, setNewGroupName]     = useState('')

  const [showAutoAssign, setShowAutoAssign] = useState(false)
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null)

  useEffect(() => {
    getCourses()
      .then(cs => { setCourseList(cs); setLoadingCourses(false) })
      .catch(() => setLoadingCourses(false))
  }, [])

  useEffect(() => {
    if (!courseId) return
    setActiveCat(null)
    setGroups([])
    setMemberships({})
    setStudents([])
    setLoadingCats(true)
    Promise.all([getGroupCategories(courseId), getEnrollments(courseId)])
      .then(([cats, enrollments]) => { setCategories(cats); setStudents(enrollments) })
      .catch(console.error)
      .finally(() => setLoadingCats(false))
  }, [courseId])

  async function openCategory(cat) {
    setActiveCat(cat)
    setApplyResult(null)
    setLoadingGroups(true)
    try {
      const gs = await getGroupsInCategory(cat.id)
      setGroups(gs)
      setLoadingMembers(true)
      const entries = await Promise.all(gs.map(g => getGroupMembers(g.id).then(ms => [g.id, ms])))
      setMemberships(Object.fromEntries(entries))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingGroups(false)
      setLoadingMembers(false)
    }
  }

  async function refreshCategory(cat) {
    const gs = await getGroupsInCategory(cat.id)
    setGroups(gs)
    setLoadingMembers(true)
    const entries = await Promise.all(gs.map(g => getGroupMembers(g.id).then(ms => [g.id, ms])))
    setMemberships(Object.fromEntries(entries))
    setLoadingMembers(false)
  }

  // ── Category CRUD ──────────────────────────────────────────────────────────

  async function handleCreateCat() {
    if (!newCatName.trim()) return
    const cat = await createGroupCategory(courseId, newCatName.trim())
    setCategories(prev => [...prev, cat])
    setNewCatName('')
    setCreatingCat(false)
  }

  async function handleRenameCat(id, name) {
    if (!name) return setEditingCatId(null)
    const updated = await updateGroupCategory(id, name)
    setCategories(prev => prev.map(c => c.id === id ? updated : c))
    if (activeCat?.id === id) setActiveCat(updated)
    setEditingCatId(null)
  }

  async function handleDeleteCat(id) {
    await deleteGroupCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
    if (activeCat?.id === id) setActiveCat(null)
    setConfirmDeleteCat(null)
  }

  // ── Group CRUD ─────────────────────────────────────────────────────────────

  async function handleCreateGroup() {
    if (!newGroupName.trim() || !activeCat) return
    const g = await createGroup(activeCat.id, newGroupName.trim())
    setGroups(prev => [...prev, g])
    setMemberships(prev => ({ ...prev, [g.id]: [] }))
    setNewGroupName('')
    setCreatingGroup(false)
  }

  async function handleRenameGroup(id, name) {
    if (!name) return setEditingGroupId(null)
    const updated = await updateGroup(id, name)
    setGroups(prev => prev.map(g => g.id === id ? updated : g))
    setEditingGroupId(null)
  }

  async function handleDeleteGroup(id) {
    await deleteGroup(id)
    setGroups(prev => prev.filter(g => g.id !== id))
    setMemberships(prev => { const next = { ...prev }; delete next[id]; return next })
    setConfirmDeleteGroup(null)
  }

  // ── Membership ─────────────────────────────────────────────────────────────

  async function handleRemoveMember(groupId, userId) {
    const mem = (memberships[groupId] ?? []).find(m => m.userId === userId)
    if (!mem) return
    await removeGroupMember(groupId, mem.id)
    setMemberships(prev => ({
      ...prev,
      [groupId]: prev[groupId].filter(m => m.id !== mem.id),
    }))
  }

  async function handleAddMember(groupId, userId) {
    try {
      const m = await addGroupMember(groupId, userId)
      setMemberships(prev => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), m],
      }))
    } catch (err) {
      toast('Failed to add student', 'error')
    }
  }

  async function handleMoveMember(fromGroupId, toGroupId, userId) {
    const mem = (memberships[fromGroupId] ?? []).find(m => m.userId === userId)
    if (!mem) return
    try {
      await removeGroupMember(fromGroupId, mem.id)
      const newMem = await addGroupMember(toGroupId, userId)
      setMemberships(prev => ({
        ...prev,
        [fromGroupId]: prev[fromGroupId].filter(m => m.id !== mem.id),
        [toGroupId]:   [...(prev[toGroupId] ?? []), newMem],
      }))
    } catch (err) {
      toast('Failed to move student', 'error')
    }
  }

  // ── Auto-assign ────────────────────────────────────────────────────────────

  async function handleAutoAssign(groupPlan) {
    setApplying(true)
    try {
      for (const planned of groupPlan) {
        const created = await createGroup(activeCat.id, planned.name)
        await Promise.all(planned.students.map(s => addGroupMember(created.id, s.userId)))
      }
      await refreshCategory(activeCat)
      setShowAutoAssign(false)
      setApplyResult({ count: groupPlan.length })
    } catch (e) {
      console.error(e)
    } finally {
      setApplying(false)
    }
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const assignedUserIds = useMemo(
    () => new Set(Object.values(memberships).flat().map(m => m.userId)),
    [memberships]
  )
  const unassigned = useMemo(
    () => students.filter(s => !assignedUserIds.has(s.userId)),
    [students, assignedUserIds]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Groups</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage group sets, create groups, and assign students by dragging or searching by name.
        </p>
      </div>

      <CourseSelector
        courses={courses}
        selectedId={courseId}
        onChange={setCourseId}
        loading={loadingCourses}
      />

      {courseId && (
        loadingCats ? (
          <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
            <Loader size={18} className="animate-spin" /> Loading group sets…
          </div>
        ) : activeCat ? (
          <CategoryView
            cat={activeCat}
            groups={groups}
            memberships={memberships}
            students={students}
            unassigned={unassigned}
            loadingGroups={loadingGroups}
            loadingMembers={loadingMembers}
            applying={applying}
            applyResult={applyResult}
            editingGroupId={editingGroupId}
            setEditingGroupId={setEditingGroupId}
            creatingGroup={creatingGroup}
            setCreatingGroup={setCreatingGroup}
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            showAutoAssign={showAutoAssign}
            setShowAutoAssign={setShowAutoAssign}
            confirmDeleteGroup={confirmDeleteGroup}
            setConfirmDeleteGroup={setConfirmDeleteGroup}
            onBack={() => { setActiveCat(null); setApplyResult(null) }}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onCreateGroup={handleCreateGroup}
            onRemoveMember={handleRemoveMember}
            onAddMember={handleAddMember}
            onMoveMember={handleMoveMember}
            onAutoAssign={handleAutoAssign}
          />
        ) : (
          <SetsView
            categories={categories}
            students={students}
            editingCatId={editingCatId}
            setEditingCatId={setEditingCatId}
            creatingCat={creatingCat}
            setCreatingCat={setCreatingCat}
            newCatName={newCatName}
            setNewCatName={setNewCatName}
            confirmDeleteCat={confirmDeleteCat}
            setConfirmDeleteCat={setConfirmDeleteCat}
            onOpen={openCategory}
            onRenameCat={handleRenameCat}
            onDeleteCat={handleDeleteCat}
            onCreateCat={handleCreateCat}
          />
        )
      )}
    </div>
  )
}

// ── Sets view ──────────────────────────────────────────────────────────────

function SetsView({ categories, students, editingCatId, setEditingCatId, creatingCat, setCreatingCat,
  newCatName, setNewCatName, confirmDeleteCat, setConfirmDeleteCat,
  onOpen, onRenameCat, onDeleteCat, onCreateCat }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">
          Group Sets
          {students.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">· {students.length} students enrolled</span>}
        </h2>
        <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setCreatingCat(true)}>
          <Plus size={15} /> New Group Set
        </button>
      </div>

      {creatingCat && (
        <div className="card p-4 flex items-center gap-3 border-2" style={{ borderColor: 'var(--cpt-color)' }}>
          <input
            autoFocus
            className="input flex-1 text-sm"
            placeholder="Group set name (e.g. Study Groups, Lab Partners…)"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  onCreateCat()
              if (e.key === 'Escape') { setCreatingCat(false); setNewCatName('') }
            }}
          />
          <button className="btn-primary text-sm" onClick={onCreateCat} disabled={!newCatName.trim()}>Create</button>
          <button className="btn-ghost text-sm" onClick={() => { setCreatingCat(false); setNewCatName('') }}>Cancel</button>
        </div>
      )}

      {categories.length === 0 && !creatingCat ? (
        <div className="text-center py-20 space-y-3">
          <Users size={36} className="text-gray-300 mx-auto" />
          <p className="text-gray-500 font-medium">No group sets in this course.</p>
          <p className="text-sm text-gray-400">Create a group set to start organizing students into groups.</p>
          <button className="btn-primary text-sm inline-flex items-center gap-1.5 mx-auto" onClick={() => setCreatingCat(true)}>
            <Plus size={15} /> Create First Group Set
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="card p-4 flex items-center gap-3">
              {editingCatId === cat.id ? (
                <InlineEdit
                  value={cat.name}
                  onSave={name => onRenameCat(cat.id, name)}
                  onCancel={() => setEditingCatId(null)}
                />
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{cat.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cat.groupCount} {cat.groupCount === 1 ? 'group' : 'groups'}
                      {cat.unassignedStudentsCount > 0 && ` · ${cat.unassignedStudentsCount} unassigned`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => onOpen(cat)}>
                      View Groups <ChevronRight size={14} />
                    </button>
                    <button className="btn-ghost p-2" title="Rename" onClick={() => setEditingCatId(cat.id)}>
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button className="btn-ghost p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete" onClick={() => setConfirmDeleteCat(cat.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDeleteCat && (
        <ModalShell onClose={() => setConfirmDeleteCat(null)}>
          <h3 className="font-semibold text-gray-900 mb-1">Delete Group Set?</h3>
          <p className="text-sm text-gray-600 mb-5">All groups and student assignments within this set will be permanently removed from Canvas.</p>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setConfirmDeleteCat(null)}>Cancel</button>
            <button className="btn-danger" onClick={() => onDeleteCat(confirmDeleteCat)}>Delete Set</button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

// ── Category view (groups + members) ──────────────────────────────────────

function CategoryView({ cat, groups, memberships, students, unassigned, loadingGroups, loadingMembers,
  applying, applyResult, editingGroupId, setEditingGroupId, creatingGroup, setCreatingGroup,
  newGroupName, setNewGroupName, showAutoAssign, setShowAutoAssign, confirmDeleteGroup,
  setConfirmDeleteGroup, onBack, onRenameGroup, onDeleteGroup, onCreateGroup,
  onRemoveMember, onAddMember, onMoveMember, onAutoAssign }) {

  const [draggingUserId, setDraggingUserId] = useState(null)
  const assignedCount = students.length - unassigned.length

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button className="btn-ghost text-sm text-gray-500 hover:text-gray-800" onClick={onBack}>
          ← Group Sets
        </button>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{cat.name}</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-gray-500">
          {students.length > 0 && (
            <span>{assignedCount}/{students.length} students assigned</span>
          )}
        </div>
        <div className="flex-1" />
        <button
          className="btn-secondary text-sm flex items-center gap-1.5"
          onClick={() => setShowAutoAssign(true)}
          disabled={students.length === 0}
        >
          <Shuffle size={15} /> Auto-assign
        </button>
        <button
          className="btn-primary text-sm flex items-center gap-1.5"
          onClick={() => setCreatingGroup(true)}
        >
          <Plus size={15} /> Add Group
        </button>
      </div>

      {applyResult && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          <Check size={15} className="shrink-0" />
          {applyResult.count} group{applyResult.count !== 1 ? 's' : ''} created and students assigned successfully.
        </div>
      )}

      {loadingGroups ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader size={18} className="animate-spin" /> Loading groups…
        </div>
      ) : (
        <>
          {creatingGroup && (
            <div className="card p-4 flex items-center gap-3 border-2" style={{ borderColor: 'var(--cpt-color)' }}>
              <input
                autoFocus
                className="input flex-1 text-sm"
                placeholder="Group name"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  onCreateGroup()
                  if (e.key === 'Escape') { setCreatingGroup(false); setNewGroupName('') }
                }}
              />
              <button className="btn-primary text-sm" onClick={onCreateGroup} disabled={!newGroupName.trim()}>Create</button>
              <button className="btn-ghost text-sm" onClick={() => { setCreatingGroup(false); setNewGroupName('') }}>Cancel</button>
            </div>
          )}

          {groups.length === 0 && !creatingGroup ? (
            <div className="text-center py-16 text-gray-400 space-y-3">
              <p>No groups yet. Use Auto-assign or add groups manually.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map(group => {
                const mems = memberships[group.id] ?? []
                const groupStudents = students.filter(s => mems.some(m => m.userId === s.userId))
                return (
                  <GroupCard
                    key={group.id}
                    group={group}
                    groups={groups}
                    students={groupStudents}
                    allStudents={students}
                    memberships={memberships}
                    loadingMembers={loadingMembers}
                    draggingUserId={draggingUserId}
                    isEditing={editingGroupId === group.id}
                    onEdit={() => setEditingGroupId(group.id)}
                    onRename={name => onRenameGroup(group.id, name)}
                    onCancelEdit={() => setEditingGroupId(null)}
                    onDelete={() => setConfirmDeleteGroup(group.id)}
                    onRemoveMember={userId => onRemoveMember(group.id, userId)}
                    onAddMember={userId => onAddMember(group.id, userId)}
                    onMoveMember={(fromGroupId, userId) => onMoveMember(fromGroupId, group.id, userId)}
                  />
                )
              })}
            </div>
          )}

          {/* Unassigned students */}
          {unassigned.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={15} className="text-yellow-500 shrink-0" />
                <p className="text-sm font-semibold text-gray-700">Unassigned ({unassigned.length})</p>
                <span className="text-xs text-gray-400">— drag to a group or use the search in each card</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map(s => (
                  <span
                    key={s.userId}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ userId: s.userId, sourceGroupId: null }))
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggingUserId(s.userId)
                    }}
                    onDragEnd={() => setDraggingUserId(null)}
                    className={`text-xs px-2.5 py-1 rounded-full cursor-grab select-none transition-opacity ${
                      draggingUserId === s.userId
                        ? 'bg-gray-200 text-gray-400 opacity-50'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s.userSortableName ?? s.userName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showAutoAssign && (
        <AutoAssignModal
          students={students}
          categoryName={cat.name}
          existingGroupCount={groups.length}
          applying={applying}
          onAssign={onAutoAssign}
          onClose={() => setShowAutoAssign(false)}
        />
      )}

      {confirmDeleteGroup && (
        <ModalShell onClose={() => setConfirmDeleteGroup(null)}>
          <h3 className="font-semibold text-gray-900 mb-1">Delete Group?</h3>
          <p className="text-sm text-gray-600 mb-5">Students in this group will be unassigned. This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setConfirmDeleteGroup(null)}>Cancel</button>
            <button className="btn-danger" onClick={() => onDeleteGroup(confirmDeleteGroup)}>Delete Group</button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

// ── Group card ─────────────────────────────────────────────────────────────

function GroupCard({ group, groups, students, allStudents, memberships, loadingMembers, draggingUserId,
                     isEditing, onEdit, onRename, onCancelEdit, onDelete,
                     onRemoveMember, onAddMember, onMoveMember }) {
  const [search, setSearch]         = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [addingId, setAddingId]     = useState(null)
  const inputRef = useRef(null)

  // Students that CAN be added to this group (not already in it)
  const memberIds = useMemo(() => new Set(students.map(s => s.userId)), [students])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return allStudents
      .filter(s => !memberIds.has(s.userId) && (s.userSortableName ?? s.userName).toLowerCase().includes(q))
      .slice(0, 8)
  }, [allStudents, memberIds, search])

  // Find which group (if any) a student is currently in
  function getStudentSourceGroupId(userId) {
    for (const [gId, mems] of Object.entries(memberships)) {
      if (gId !== group.id && mems.some(m => m.userId === userId)) return gId
    }
    return null
  }

  async function addStudent(userId) {
    setAddingId(userId)
    setSearch('')
    setShowDropdown(false)
    const fromGroupId = getStudentSourceGroupId(userId)
    if (fromGroupId) {
      await onMoveMember(fromGroupId, userId)
    } else {
      await onAddMember(userId)
    }
    setAddingId(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const { userId, sourceGroupId } = JSON.parse(e.dataTransfer.getData(DRAG_TYPE))
      if (memberIds.has(userId)) return  // already in this group
      if (sourceGroupId && sourceGroupId !== group.id) {
        onMoveMember(sourceGroupId, userId)
      } else if (!sourceGroupId) {
        onAddMember(userId)
      }
    } catch {}
  }

  const isDraggingCompatible = draggingUserId !== null && !memberIds.has(draggingUserId)

  return (
    <div
      className="card overflow-hidden flex flex-col transition-all duration-150"
      style={isDragOver
        ? { borderColor: 'var(--cpt-color)', boxShadow: '0 0 0 2px rgba(var(--cpt-color-rgb), 0.2)', borderWidth: '1px', borderStyle: 'solid' }
        : { borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent' }
      }
      onDragOver={e => { e.preventDefault(); if (isDraggingCompatible) setIsDragOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false) }}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
        {isEditing ? (
          <InlineEdit value={group.name} onSave={onRename} onCancel={onCancelEdit} />
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{group.name}</span>
            <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
              <Users size={11} /> {students.length}
            </span>
            <button className="btn-ghost p-1 text-gray-400 hover:text-gray-700" onClick={onEdit} title="Rename">
              <Pencil size={12} />
            </button>
            <button className="btn-ghost p-1 text-red-400 hover:text-red-600" onClick={onDelete} title="Delete group">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {/* Members list */}
      <div className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto max-h-40 min-h-[3rem]">
        {loadingMembers ? (
          <p className="text-xs text-gray-400 py-2 text-center">Loading…</p>
        ) : students.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center italic">
            {isDragOver ? 'Drop to add' : 'No students — drag or search below'}
          </p>
        ) : (
          <>
            {students.map(s => (
              <div
                key={s.userId}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ userId: s.userId, sourceGroupId: group.id }))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className="flex items-center gap-1 group/mem py-0.5 cursor-grab"
              >
                <span className="flex-1 text-xs text-gray-700 truncate">{s.userSortableName ?? s.userName}</span>
                {addingId === s.userId ? (
                  <Loader size={10} className="animate-spin text-gray-300 shrink-0" />
                ) : (
                  <button
                    onClick={() => onRemoveMember(s.userId)}
                    className="opacity-0 group-hover/mem:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-0.5 shrink-0"
                    title="Remove from group"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
            {isDragOver && (
              <div className="text-xs text-center py-1 rounded-md mt-1" style={{ color: 'var(--cpt-color)', backgroundColor: 'rgba(var(--cpt-color-rgb), 0.08)' }}>
                Drop to add
              </div>
            )}
          </>
        )}
      </div>

      {/* Search-to-add */}
      <div className="px-3 py-2 border-t border-gray-100 relative">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          {addingId && <Loader size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-300 pointer-events-none" />}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Add student by name…"
            className="w-full text-xs pl-7 pr-7 py-1.5 rounded-md border border-gray-200 focus:outline-none bg-white placeholder-gray-300 focus:border-gray-400"
          />
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute left-3 right-3 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
            {searchResults.map(s => {
              const fromGroupId = getStudentSourceGroupId(s.userId)
              const fromGroup = fromGroupId ? groups.find(g => g.id === fromGroupId) : null
              return (
                <button
                  key={s.userId}
                  onMouseDown={e => { e.preventDefault(); addStudent(s.userId) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="truncate text-gray-800">{s.userSortableName ?? s.userName}</span>
                  {fromGroup && (
                    <span className="text-xs text-gray-400 shrink-0 italic">from {fromGroup.name}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {showDropdown && search.trim() && searchResults.length === 0 && (
          <div className="absolute left-3 right-3 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 px-3 py-2 text-xs text-gray-400">
            No students found
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function ModalShell({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        {children}
      </div>
    </div>
  )
}

function InlineEdit({ value, onSave, onCancel }) {
  const [val, setVal] = useState(value)
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        autoFocus
        className="input flex-1 text-sm"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  onSave(val.trim())
          if (e.key === 'Escape') onCancel()
        }}
      />
      <button className="btn-ghost p-1 text-green-600" onClick={() => onSave(val.trim())}>
        <Check size={13} />
      </button>
      <button className="btn-ghost p-1 text-gray-400" onClick={onCancel}>
        <X size={13} />
      </button>
    </div>
  )
}
