import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Copy,
  GitMerge,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  FileText,
  AlertCircle,
  Calendar,
  Award,
  ArrowRight,
  RotateCcw
} from 'lucide-react';

interface AssignmentGroup {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  title: string;
  points: number;
  dueDate: string;
  groupId: string;
}

export const AssignmentGroupsScreen: React.FC = () => {
  // 1. Initial Default Assignment Groups
  const initialGroups: AssignmentGroup[] = [
    { id: 'grp-assessments', name: 'Assessments' },
    { id: 'grp-assignments', name: 'Assignments' },
    { id: 'grp-starters', name: 'Starters' },
    { id: 'grp-labs', name: 'Labs' }
  ];

  // 2. Initial Sample Assignments
  const initialAssignments: Assignment[] = [
    {
      id: 'asn-101',
      title: 'Unit 1 Comprehensive Exam',
      points: 100,
      dueDate: '2026-08-15',
      groupId: 'grp-assessments'
    },
    {
      id: 'asn-102',
      title: 'Midterm Essay & Thesis Draft',
      points: 75,
      dueDate: '2026-08-20',
      groupId: 'grp-assessments'
    },
    {
      id: 'asn-201',
      title: 'Research Paper Outline & Sources',
      points: 50,
      dueDate: '2026-08-05',
      groupId: 'grp-assignments'
    },
    {
      id: 'asn-202',
      title: 'Weekly Reflection & Peer Review',
      points: 25,
      dueDate: '2026-08-10',
      groupId: 'grp-assignments'
    },
    {
      id: 'asn-203',
      title: 'Case Study Analysis #2',
      points: 40,
      dueDate: '2026-08-18',
      groupId: 'grp-assignments'
    },
    {
      id: 'asn-301',
      title: 'Warm-Up Quiz 1: Syllabus & Policies',
      points: 10,
      dueDate: '2026-08-01',
      groupId: 'grp-starters'
    },
    {
      id: 'asn-302',
      title: 'Vocabulary Exit Ticket 2',
      points: 15,
      dueDate: '2026-08-08',
      groupId: 'grp-starters'
    },
    {
      id: 'asn-401',
      title: 'Lab 1: Cell Microscopy & Staining',
      points: 50,
      dueDate: '2026-08-12',
      groupId: 'grp-labs'
    },
    {
      id: 'asn-402',
      title: 'Lab 2: Enzyme Kinetics & Temperature Rates',
      points: 60,
      dueDate: '2026-08-22',
      groupId: 'grp-labs'
    }
  ];

  const [groups, setGroups] = useState<AssignmentGroup[]>(initialGroups);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);

  // Accordion Expand State (Default all expanded)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'grp-assessments': true,
    'grp-assignments': true,
    'grp-starters': true,
    'grp-labs': true
  });

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Modal / Interaction States
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [sourceMergeGroupId, setSourceMergeGroupId] = useState<string>('');
  const [targetMergeGroupId, setTargetMergeGroupId] = useState<string>('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [groupToDeleteId, setGroupToDeleteId] = useState<string | null>(null);
  const [fallbackGroupId, setFallbackGroupId] = useState<string>('');

  // Expand / Collapse Toggle
  const toggleExpand = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // 1. CREATE GROUP
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGrp: AssignmentGroup = {
      id: `grp-${Date.now()}`,
      name: newGroupName.trim()
    };

    setGroups(prev => [...prev, newGrp]);
    setExpandedGroups(prev => ({ ...prev, [newGrp.id]: true }));
    setNewGroupName('');
    setIsAddingGroup(false);
    showToast(`ASSIGNMENT GROUP "${newGrp.name.toUpperCase()}" CREATED!`);
  };

  // 2. EDIT / RENAME GROUP
  const startEditingGroup = (grp: AssignmentGroup) => {
    setEditingGroupId(grp.id);
    setEditingGroupName(grp.name);
  };

  const saveEditingGroup = (groupId: string) => {
    if (!editingGroupName.trim()) return;
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, name: editingGroupName.trim() } : g)));
    showToast(`GROUP RENAMED TO "${editingGroupName.trim().toUpperCase()}"`);
    setEditingGroupId(null);
  };

  // 3. DUPLICATE GROUP
  const handleDuplicateGroup = (grp: AssignmentGroup) => {
    const duplicatedGrpId = `grp-${Date.now()}`;
    const duplicatedGrpName = `${grp.name} (Copy)`;

    const duplicatedGroup: AssignmentGroup = {
      id: duplicatedGrpId,
      name: duplicatedGrpName
    };

    // Duplicate all assignments in this group
    const sourceAssignments = assignments.filter(a => a.groupId === grp.id);
    const duplicatedAssignments: Assignment[] = sourceAssignments.map((a, idx) => ({
      id: `asn-dup-${Date.now()}-${idx}`,
      title: `${a.title} (Copy)`,
      points: a.points,
      dueDate: a.dueDate,
      groupId: duplicatedGrpId
    }));

    setGroups(prev => [...prev, duplicatedGroup]);
    setAssignments(prev => [...prev, ...duplicatedAssignments]);
    setExpandedGroups(prev => ({ ...prev, [duplicatedGrpId]: true }));
    showToast(`DUPLICATED GROUP "${grp.name.toUpperCase()}" WITH ${duplicatedAssignments.length} ASSIGNMENTS!`);
  };

  // 4. MERGE GROUPS
  const openMergeModal = (defaultSourceId?: string) => {
    if (groups.length < 2) {
      showToast('AT LEAST 2 ASSIGNMENT GROUPS ARE REQUIRED TO MERGE!');
      return;
    }
    const src = defaultSourceId || groups[0].id;
    const tgt = groups.find(g => g.id !== src)?.id || groups[1]?.id || '';
    setSourceMergeGroupId(src);
    setTargetMergeGroupId(tgt);
    setMergeModalOpen(true);
  };

  const handleExecuteMerge = () => {
    if (!sourceMergeGroupId || !targetMergeGroupId || sourceMergeGroupId === targetMergeGroupId) {
      showToast('PLEASE SELECT TWO DIFFERENT GROUPS TO MERGE.');
      return;
    }

    const sourceGroup = groups.find(g => g.id === sourceMergeGroupId);
    const targetGroup = groups.find(g => g.id === targetMergeGroupId);

    if (!sourceGroup || !targetGroup) return;

    // Move all assignments from source group to target group
    setAssignments(prev =>
      prev.map(a => (a.groupId === sourceMergeGroupId ? { ...a, groupId: targetMergeGroupId } : a))
    );

    // Remove source group
    setGroups(prev => prev.filter(g => g.id !== sourceMergeGroupId));

    setMergeModalOpen(false);
    showToast(`MERGED "${sourceGroup.name.toUpperCase()}" INTO "${targetGroup.name.toUpperCase()}"!`);
  };

  // 5. DELETE GROUP
  const openDeleteModal = (groupId: string) => {
    if (groups.length <= 1) {
      showToast('CANNOT DELETE THE ONLY ASSIGNMENT GROUP. ALL ASSIGNMENTS MUST BELONG TO A GROUP.');
      return;
    }

    const groupAsns = assignments.filter(a => a.groupId === groupId);
    const fallback = groups.find(g => g.id !== groupId)?.id || '';

    setGroupToDeleteId(groupId);
    setFallbackGroupId(fallback);

    if (groupAsns.length === 0) {
      // If group is empty, delete immediately
      setGroups(prev => prev.filter(g => g.id !== groupId));
      const deletedGroup = groups.find(g => g.id === groupId);
      showToast(`DELETED EMPTY GROUP "${deletedGroup?.name.toUpperCase() || ''}"`);
    } else {
      // Prompt for moving assignments
      setDeleteModalOpen(true);
    }
  };

  const handleExecuteDelete = () => {
    if (!groupToDeleteId || !fallbackGroupId) return;

    const groupToDelete = groups.find(g => g.id === groupToDeleteId);
    const fallbackGroup = groups.find(g => g.id === fallbackGroupId);

    // Reassign assignments to fallback group
    setAssignments(prev =>
      prev.map(a => (a.groupId === groupToDeleteId ? { ...a, groupId: fallbackGroupId } : a))
    );

    // Delete group
    setGroups(prev => prev.filter(g => g.id !== groupToDeleteId));

    setDeleteModalOpen(false);
    setGroupToDeleteId(null);

    showToast(
      `DELETED "${groupToDelete?.name.toUpperCase()}" & REASSIGNED ASSIGNMENTS TO "${fallbackGroup?.name.toUpperCase()}"`
    );
  };

  // 6. MOVE ASSIGNMENT TO DIFFERENT GROUP
  const handleMoveAssignment = (assignmentId: string, newGroupId: string) => {
    const targetGroup = groups.find(g => g.id === newGroupId);
    setAssignments(prev =>
      prev.map(a => (a.id === assignmentId ? { ...a, groupId: newGroupId } : a))
    );
    if (targetGroup) {
      showToast(`MOVED ASSIGNMENT TO "${targetGroup.name.toUpperCase()}"`);
    }
  };

  // RESET DEMO DATA
  const handleResetDemoData = () => {
    setGroups(initialGroups);
    setAssignments(initialAssignments);
    showToast('RESET ALL ASSIGNMENT GROUPS & ASSIGNMENTS TO DEFAULTS');
  };

  return (
    <div className="space-y-6 animate-fadeIn font-mono text-xs">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="bg-[#FEF08A] border-2 border-[#1B1C1A] p-3 rounded-[2px] font-mono text-xs font-bold text-[#1B1C1A] flex items-center justify-between shadow-xs animate-bounce">
          <div className="flex items-center gap-2 uppercase">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="border-b border-[#1B1C1A] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 bg-[#059669] text-white font-mono font-bold text-[10px] uppercase">
            GRADING MODULE // STRUCTURE MANAGER
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[#1B1C1A] uppercase mt-1">
            ASSIGNMENT GROUP MANAGER
          </h1>
          <p className="text-xs text-gray-600 font-mono mt-0.5">
            Organize, duplicate, merge, and edit assignment sections. Move individual assignments across groups with instant dropdown filing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleResetDemoData}
            className="px-3 py-2 bg-[#FAF9F5] border border-[#1B1C1A] rounded-[2px] text-xs font-mono font-bold uppercase hover:bg-[#EFEEEA] flex items-center gap-1.5"
            title="Reset to default sections"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET DEFAULTS</span>
          </button>

          <button
            onClick={() => openMergeModal()}
            className="px-3 py-2 bg-white border border-[#1B1C1A] text-xs font-mono font-bold uppercase rounded-[2px] hover:bg-gray-100 flex items-center gap-1.5 shadow-xs"
          >
            <GitMerge className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>MERGE GROUPS</span>
          </button>

          <button
            onClick={() => setIsAddingGroup(true)}
            className="px-4 py-2 bg-[#059669] text-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-emerald-700 flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>ADD NEW GROUP</span>
          </button>
        </div>
      </div>

      {/* Top Quick Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#1B1C1A] p-4 rounded-[2px] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-gray-500">
              ACTIVE ASSIGNMENT GROUPS
            </span>
            <div className="text-2xl font-black text-[#1B1C1A] font-mono mt-0.5">
              {groups.length} SECTIONS
            </div>
          </div>
          <FolderKanban className="w-6 h-6 text-[#059669]" />
        </div>

        <div className="bg-white border border-[#1B1C1A] p-4 rounded-[2px] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-gray-500">
              TOTAL FILED ASSIGNMENTS
            </span>
            <div className="text-2xl font-black text-[#2563EB] font-mono mt-0.5">
              {assignments.length} ASSIGNMENTS
            </div>
          </div>
          <FileText className="w-6 h-6 text-[#2563EB]" />
        </div>

        <div className="bg-[#EFEEEA] border border-[#1B1C1A] p-4 rounded-[2px] flex items-center justify-between text-xs font-mono">
          <div>
            <span className="font-bold text-[#1B1C1A] uppercase">ASSIGNMENT FILING RULE</span>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Assignments cannot exist without a group. Use the group dropdown on any assignment card to reassign it instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Inline Form to Add New Group */}
      {isAddingGroup && (
        <form
          onSubmit={handleCreateGroup}
          className="bg-[#FEF08A] border-2 border-[#1B1C1A] p-4 rounded-[2px] space-y-3 animate-fadeIn"
        >
          <div className="font-extrabold uppercase text-[#1B1C1A] text-xs flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>CREATE NEW ASSIGNMENT GROUP</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Starters, Classwork, Projects, Field Work..."
              className="flex-1 p-2 bg-white border border-[#1B1C1A] font-mono font-bold text-xs rounded-[1px] outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#1B1C1A] text-white font-bold uppercase rounded-[1px] hover:bg-gray-800"
            >
              CREATE
            </button>
            <button
              type="button"
              onClick={() => setIsAddingGroup(false)}
              className="px-3 py-2 bg-white border border-[#1B1C1A] font-bold uppercase rounded-[1px] hover:bg-gray-100"
            >
              CANCEL
            </button>
          </div>
        </form>
      )}

      {/* Main Sections Accordion View */}
      <div className="space-y-4">
        {groups.map((group) => {
          const groupAssignments = assignments.filter(a => a.groupId === group.id);
          const totalGroupPoints = groupAssignments.reduce((acc, a) => acc + a.points, 0);
          const isExpanded = expandedGroups[group.id] !== false;

          return (
            <div
              key={group.id}
              className="bg-white border-2 border-[#1B1C1A] rounded-[2px] overflow-hidden shadow-xs transition-all"
            >
              {/* Group Header Card */}
              <div className="p-4 bg-[#FAF9F5] border-b border-[#1B1C1A] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(group.id)}
                    className="p-1.5 bg-white border border-[#1B1C1A] rounded-[1px] hover:bg-gray-100"
                    title="Toggle Expand/Collapse"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {editingGroupId === group.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        className="p-1 bg-white border border-[#1B1C1A] font-bold text-base uppercase rounded-[1px] outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEditingGroup(group.id)}
                        className="p-1.5 bg-[#059669] text-white border border-[#1B1C1A] rounded-[1px]"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-[#1B1C1A] uppercase tracking-tight">
                          {group.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-[#EFEEEA] border border-[#1B1C1A] font-mono text-[10px] font-bold uppercase text-gray-700">
                          {groupAssignments.length} ASSIGNMENTS
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 font-mono text-[10px] font-bold uppercase text-[#059669]">
                          {totalGroupPoints} PTS TOTAL
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Group Operational Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => startEditingGroup(group)}
                    className="px-2.5 py-1.5 bg-white border border-[#1B1C1A] font-mono font-bold text-[11px] uppercase rounded-[2px] hover:bg-gray-100 flex items-center gap-1"
                    title="Rename Group"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-gray-700" />
                    <span>RENAME</span>
                  </button>

                  <button
                    onClick={() => handleDuplicateGroup(group)}
                    className="px-2.5 py-1.5 bg-white border border-[#1B1C1A] font-mono font-bold text-[11px] uppercase rounded-[2px] hover:bg-gray-100 flex items-center gap-1"
                    title="Duplicate Group and its Assignments"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>DUPLICATE</span>
                  </button>

                  <button
                    onClick={() => openMergeModal(group.id)}
                    className="px-2.5 py-1.5 bg-white border border-[#1B1C1A] font-mono font-bold text-[11px] uppercase rounded-[2px] hover:bg-gray-100 flex items-center gap-1"
                    title="Merge into another Group"
                  >
                    <GitMerge className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>MERGE</span>
                  </button>

                  <button
                    onClick={() => openDeleteModal(group.id)}
                    className="px-2.5 py-1.5 bg-white border border-red-700 text-red-700 font-mono font-bold text-[11px] uppercase rounded-[2px] hover:bg-red-50 flex items-center gap-1"
                    title="Delete Group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>DELETE</span>
                  </button>
                </div>
              </div>

              {/* Group Assignments List */}
              {isExpanded && (
                <div className="p-4 bg-white">
                  {groupAssignments.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-gray-300 rounded-[2px] font-mono text-gray-500">
                      NO ASSIGNMENTS FILED UNDER "{group.name.toUpperCase()}". USE THE GROUP DROPDOWN ON ANY ASSIGNMENT TO MOVE IT HERE.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[10px] font-mono font-bold text-gray-500 uppercase px-2 pb-1 border-b border-gray-200">
                        <div className="col-span-5">ASSIGNMENT TITLE</div>
                        <div className="col-span-2 text-center">POINTS</div>
                        <div className="col-span-2 text-center">DUE DATE</div>
                        <div className="col-span-3 text-right">MOVE TO GROUP</div>
                      </div>

                      {groupAssignments.map((asn) => (
                        <div
                          key={asn.id}
                          className="grid grid-cols-12 gap-2 items-center p-3 bg-[#FAF9F5] border border-gray-300 rounded-[2px] hover:border-[#1B1C1A] transition-all"
                        >
                          {/* Title */}
                          <div className="col-span-5 font-bold text-[#1B1C1A] flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
                            <span className="truncate">{asn.title}</span>
                          </div>

                          {/* Points */}
                          <div className="col-span-2 text-center font-bold text-[#059669] flex items-center justify-center gap-1">
                            <Award className="w-3.5 h-3.5" />
                            <span>{asn.points} PTS</span>
                          </div>

                          {/* Due Date */}
                          <div className="col-span-2 text-center text-gray-700 font-mono text-[11px] flex items-center justify-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            <span>{asn.dueDate}</span>
                          </div>

                          {/* Assignment Group Dropdown Selector */}
                          <div className="col-span-3 text-right">
                            <select
                              value={asn.groupId}
                              onChange={(e) => handleMoveAssignment(asn.id, e.target.value)}
                              className="w-full p-1.5 bg-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[1px] outline-none focus:bg-[#FEF08A] cursor-pointer"
                            >
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  FILE UNDER: {g.name.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MERGE GROUPS MODAL */}
      {mergeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border-2 border-[#1B1C1A] max-w-lg w-full p-6 space-y-4 rounded-[2px] shadow-2xl font-mono">
            <div className="border-b border-[#1B1C1A] pb-3 flex items-center justify-between">
              <h3 className="font-black text-base uppercase text-[#1B1C1A] flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-[#7C3AED]" />
                <span>MERGE ASSIGNMENT GROUPS</span>
              </h3>
              <button
                onClick={() => setMergeModalOpen(false)}
                className="font-bold text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Select a source group to merge. All assignments in the source group will be reassigned into the target group, and the source group will be removed.
            </p>

            <div className="space-y-4 bg-[#FAF9F5] p-4 border border-[#1B1C1A] rounded-[2px]">
              <div>
                <label className="block font-bold text-[#1B1C1A] uppercase mb-1">
                  1. SOURCE GROUP (TO BE REMOVED):
                </label>
                <select
                  value={sourceMergeGroupId}
                  onChange={(e) => setSourceMergeGroupId(e.target.value)}
                  className="w-full p-2 bg-white border border-[#1B1C1A] font-bold rounded-[1px] outline-none"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name.toUpperCase()} ({assignments.filter(a => a.groupId === g.id).length} assignments)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center text-gray-500">
                <ArrowRight className="w-5 h-5 rotate-90" />
              </div>

              <div>
                <label className="block font-bold text-[#1B1C1A] uppercase mb-1">
                  2. TARGET DESTINATION GROUP (RECEIVES ASSIGNMENTS):
                </label>
                <select
                  value={targetMergeGroupId}
                  onChange={(e) => setTargetMergeGroupId(e.target.value)}
                  className="w-full p-2 bg-white border border-[#1B1C1A] font-bold rounded-[1px] outline-none"
                >
                  {groups
                    .filter(g => g.id !== sourceMergeGroupId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name.toUpperCase()} ({assignments.filter(a => a.groupId === g.id).length} assignments)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => setMergeModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#1B1C1A] font-bold uppercase rounded-[1px] hover:bg-gray-100"
              >
                CANCEL
              </button>
              <button
                onClick={handleExecuteMerge}
                className="px-5 py-2 bg-[#7C3AED] text-white border border-[#1B1C1A] font-bold uppercase rounded-[1px] hover:bg-purple-800"
              >
                CONFIRM MERGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE GROUP MODAL */}
      {deleteModalOpen && groupToDeleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border-2 border-[#1B1C1A] max-w-lg w-full p-6 space-y-4 rounded-[2px] shadow-2xl font-mono">
            <div className="border-b border-[#1B1C1A] pb-3 flex items-center justify-between">
              <h3 className="font-black text-base uppercase text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>DELETE ASSIGNMENT GROUP</span>
              </h3>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="font-bold text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-700">
              Assignments cannot exist without a group. Select a destination group to move all existing assignments from{' '}
              <strong className="text-black font-extrabold uppercase">
                "{groups.find(g => g.id === groupToDeleteId)?.name}"
              </strong>{' '}
              before deleting.
            </p>

            <div className="bg-red-50 p-4 border border-red-300 rounded-[2px] space-y-2">
              <label className="block font-bold text-red-900 uppercase">
                REASSIGN ASSIGNMENTS TO:
              </label>
              <select
                value={fallbackGroupId}
                onChange={(e) => setFallbackGroupId(e.target.value)}
                className="w-full p-2 bg-white border border-[#1B1C1A] font-bold rounded-[1px] outline-none"
              >
                {groups
                  .filter(g => g.id !== groupToDeleteId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name.toUpperCase()}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#1B1C1A] font-bold uppercase rounded-[1px] hover:bg-gray-100"
              >
                CANCEL
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-5 py-2 bg-red-600 text-white border border-[#1B1C1A] font-bold uppercase rounded-[1px] hover:bg-red-700"
              >
                REASSIGN & DELETE GROUP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
