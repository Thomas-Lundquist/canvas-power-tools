import React, { useState } from 'react';
import {
  Grid,
  Plus,
  Copy,
  Trash2,
  Check,
  Folder,
  Layers,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Edit2,
  Save,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface RubricCriterion {
  id: string;
  description: string;
  longDescription: string;
  points: number;
  ratings: { id: string; description: string; points: number }[];
}

interface Rubric {
  id: string;
  name: string;
  category: string;
  lastUsed: string;
  pointsPossible: number;
  criteria: RubricCriterion[];
}

export const RubricManagerScreen: React.FC = () => {
  const [rubrics, setRubrics] = useState<Rubric[]>([
    {
      id: 'rub-1',
      name: 'Analytical Essay Evaluation',
      category: 'Essays & Papers',
      lastUsed: '2026-07-20',
      pointsPossible: 100,
      criteria: [
        {
          id: 'c-1',
          description: 'Thesis & Argumentation',
          longDescription: 'Clear, defensible thesis with compelling evidence and logical progression.',
          points: 40,
          ratings: [
            { id: 'r-1', description: 'Exceptional thesis & flawless evidence', points: 40 },
            { id: 'r-2', description: 'Clear thesis with good support', points: 30 },
            { id: 'r-3', description: 'Weak thesis or partial support', points: 20 },
            { id: 'r-4', description: 'Missing thesis', points: 0 }
          ]
        },
        {
          id: 'c-2',
          description: 'Organization & Structure',
          longDescription: 'Logical paragraph transitions and coherent structural framework.',
          points: 30,
          ratings: [
            { id: 'r-5', description: 'Seamless flow and structure', points: 30 },
            { id: 'r-6', description: 'Minor structural flaws', points: 20 },
            { id: 'r-7', description: 'Disorganized thoughts', points: 10 }
          ]
        },
        {
          id: 'c-3',
          description: 'Grammar & Mechanics',
          longDescription: 'Adherence to standard written English, syntax, and citation format.',
          points: 30,
          ratings: [
            { id: 'r-8', description: 'Fewer than 2 minor errors', points: 30 },
            { id: 'r-9', description: 'Several errors, readable', points: 20 },
            { id: 'r-10', description: 'Severe mechanics errors', points: 10 }
          ]
        }
      ]
    },
    {
      id: 'rub-2',
      name: 'STEM Lab Report Rubric',
      category: 'Science Labs',
      lastUsed: '2026-07-15',
      pointsPossible: 50,
      criteria: [
        {
          id: 'c-4',
          description: 'Data & Calculations',
          longDescription: 'Accurate data tables, correct units, and error analysis.',
          points: 25,
          ratings: [
            { id: 'r-11', description: '100% accurate calculations', points: 25 },
            { id: 'r-12', description: 'Minor calculation error', points: 15 },
            { id: 'r-13', description: 'Incomplete data', points: 5 }
          ]
        },
        {
          id: 'c-5',
          description: 'Discussion & Conclusion',
          longDescription: 'Thorough synthesis of experiment results with theoretical models.',
          points: 25,
          ratings: [
            { id: 'r-14', description: 'Deep insight and synthesis', points: 25 },
            { id: 'r-15', description: 'Basic conclusion', points: 15 }
          ]
        }
      ]
    }
  ]);

  const [selectedRubric, setSelectedRubric] = useState<Rubric>(rubrics[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Rubric | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Start Editing Existing Rubric
  const handleStartEditing = (rubricToEdit: Rubric) => {
    setEditForm(JSON.parse(JSON.stringify(rubricToEdit)));
    setIsEditing(true);
  };

  // Start Building New Rubric
  const handleBuildNew = () => {
    const newR: Rubric = {
      id: `rub-${Date.now()}`,
      name: 'Untitled New Rubric',
      category: 'General',
      lastUsed: 'Draft',
      pointsPossible: 20,
      criteria: [
        {
          id: `c-${Date.now()}-1`,
          description: 'General Criterion',
          longDescription: 'Description of expectation for this criteria.',
          points: 20,
          ratings: [
            { id: `r-${Date.now()}-1`, description: 'Exceeds Expectations', points: 20 },
            { id: `r-${Date.now()}-2`, description: 'Meets Expectations', points: 10 },
            { id: `r-${Date.now()}-3`, description: 'Does Not Meet', points: 0 }
          ]
        }
      ]
    };
    setEditForm(newR);
    setIsEditing(true);
  };

  // Duplicate as Editable New
  const handleDuplicateAsNew = (rubric: Rubric) => {
    const duplicated: Rubric = {
      ...JSON.parse(JSON.stringify(rubric)),
      id: `rub-${Date.now()}`,
      name: `${rubric.name} (Editable Copy)`,
      lastUsed: 'Just now'
    };
    setRubrics([duplicated, ...rubrics]);
    setSelectedRubric(duplicated);
    setCopiedId(duplicated.id);
    showToast(`DUPLICATED AS "${duplicated.name.toUpperCase()}"!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Save Rubric Edits
  const handleSaveRubric = () => {
    if (!editForm) return;

    if (!editForm.name.trim()) {
      showToast('PLEASE ENTER A RUBRIC TITLE.');
      return;
    }

    // Recalculate max points per criterion and total rubric points
    const updatedCriteria = editForm.criteria.map(c => {
      const maxPts = c.ratings.length > 0 ? Math.max(...c.ratings.map(r => Number(r.points) || 0)) : 0;
      return {
        ...c,
        points: maxPts
      };
    });

    const totalPts = updatedCriteria.reduce((sum, c) => sum + c.points, 0);

    const savedRubric: Rubric = {
      ...editForm,
      pointsPossible: totalPts,
      criteria: updatedCriteria
    };

    const exists = rubrics.some(r => r.id === savedRubric.id);
    if (exists) {
      setRubrics(rubrics.map(r => r.id === savedRubric.id ? savedRubric : r));
    } else {
      setRubrics([savedRubric, ...rubrics]);
    }

    setSelectedRubric(savedRubric);
    setIsEditing(false);
    setEditForm(null);
    showToast(`RUBRIC "${savedRubric.name.toUpperCase()}" SAVED SUCCESSFULLY!`);
  };

  // Delete Rubric
  const handleDeleteRubric = (id: string) => {
    if (rubrics.length <= 1) {
      showToast('CANNOT DELETE THE ONLY RUBRIC IN THE LIBRARY.');
      return;
    }
    const target = rubrics.find(r => r.id === id);
    if (window.confirm(`Are you sure you want to delete rubric "${target?.name}"?`)) {
      const remaining = rubrics.filter(r => r.id !== id);
      setRubrics(remaining);
      setSelectedRubric(remaining[0]);
      setIsEditing(false);
      setEditForm(null);
      showToast(`DELETED RUBRIC "${target?.name.toUpperCase()}"`);
    }
  };

  // --- Edit Form Helper Actions ---
  const handleAddCriterion = () => {
    if (!editForm) return;
    const newCriterion: RubricCriterion = {
      id: `c-${Date.now()}`,
      description: 'New Assessment Criterion',
      longDescription: 'Describe what students must demonstrate for this criterion.',
      points: 10,
      ratings: [
        { id: `r-${Date.now()}-1`, description: 'Full Marks', points: 10 },
        { id: `r-${Date.now()}-2`, description: 'Partial Marks', points: 5 },
        { id: `r-${Date.now()}-3`, description: 'No Marks', points: 0 }
      ]
    };
    setEditForm({
      ...editForm,
      criteria: [...editForm.criteria, newCriterion]
    });
  };

  const handleRemoveCriterion = (criterionId: string) => {
    if (!editForm) return;
    if (editForm.criteria.length <= 1) {
      showToast('RUBRIC MUST CONTAIN AT LEAST ONE CRITERION.');
      return;
    }
    setEditForm({
      ...editForm,
      criteria: editForm.criteria.filter(c => c.id !== criterionId)
    });
  };

  const handleUpdateCriterionField = (criterionId: string, field: 'description' | 'longDescription', value: string) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      criteria: editForm.criteria.map(c => c.id === criterionId ? { ...c, [field]: value } : c)
    });
  };

  const handleAddRating = (criterionId: string) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      criteria: editForm.criteria.map(c => {
        if (c.id === criterionId) {
          const newRating = {
            id: `r-${Date.now()}`,
            description: 'New Rating Description',
            points: 5
          };
          return { ...c, ratings: [...c.ratings, newRating] };
        }
        return c;
      })
    });
  };

  const handleRemoveRating = (criterionId: string, ratingId: string) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      criteria: editForm.criteria.map(c => {
        if (c.id === criterionId) {
          if (c.ratings.length <= 1) return c;
          return { ...c, ratings: c.ratings.filter(r => r.id !== ratingId) };
        }
        return c;
      })
    });
  };

  const handleUpdateRating = (criterionId: string, ratingId: string, field: 'description' | 'points', value: any) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      criteria: editForm.criteria.map(c => {
        if (c.id === criterionId) {
          return {
            ...c,
            ratings: c.ratings.map(r => r.id === ratingId ? { ...r, [field]: value } : r)
          };
        }
        return c;
      })
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn font-mono text-xs">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="bg-[#FEF08A] border-2 border-[#1B1C1A] p-3 rounded-[2px] font-mono text-xs font-bold text-[#1B1C1A] flex items-center justify-between shadow-xs animate-bounce">
          <div className="flex items-center gap-2 uppercase">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#1B1C1A] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#1B1C1A] uppercase">
            RUBRIC MANAGER & LIBRARY
          </h1>
          <p className="text-xs text-gray-600 font-mono mt-0.5">
            Build, edit, duplicate, and attach rubrics across Canvas courses. Custom edits recalculate totals dynamically.
          </p>
        </div>

        <button
          onClick={handleBuildNew}
          className="px-4 py-2 bg-[#059669] text-white font-mono font-bold text-xs uppercase border border-[#1B1C1A] rounded-[2px] flex items-center gap-2 hover:bg-emerald-700 shadow-none"
        >
          <Plus className="w-4 h-4" />
          <span>BUILD NEW RUBRIC</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-[#EFEEEA] border border-[#1B1C1A] p-3 text-xs font-mono font-bold uppercase flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-[#059669]" />
              <span>SAVED RUBRICS ({rubrics.length})</span>
            </span>
          </div>

          <div className="space-y-2">
            {rubrics.map((r) => {
              const isSelected = selectedRubric.id === r.id && !isEditing;
              const isEditingThis = isEditing && editForm?.id === r.id;

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    if (isEditing) setIsEditing(false);
                    setSelectedRubric(r);
                  }}
                  className={`p-4 border rounded-[2px] cursor-pointer transition-all ${
                    isSelected || isEditingThis
                      ? 'bg-white border-[#1B1C1A] border-l-4 border-l-[#059669] shadow-sm'
                      : 'bg-[#FAF9F5] border-gray-300 hover:border-[#1B1C1A]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#059669] bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
                      {r.category}
                    </span>
                    <span className="text-[10px] font-mono text-gray-500 font-bold">
                      {r.pointsPossible} PTS
                    </span>
                  </div>

                  <h4 className="font-bold text-[#1B1C1A] text-sm mb-1">{r.name}</h4>

                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 mt-2 pt-2 border-t border-gray-100">
                    <span>{r.criteria.length} Criteria</span>
                    <span>Used: {r.lastUsed}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail / Edit Panel */}
        <div className="lg:col-span-8 bg-white border-2 border-[#1B1C1A] rounded-[2px] p-6 space-y-6">

          {/* ========================================= */}
          {/* VIEW MODE                                 */}
          {/* ========================================= */}
          {!isEditing && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold uppercase text-white bg-[#1B1C1A] px-2 py-0.5">
                      {selectedRubric.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-600">
                      TOTAL: {selectedRubric.pointsPossible} POINTS
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-[#1B1C1A] uppercase tracking-tight">
                    {selectedRubric.name}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEditing(selectedRubric)}
                    className="px-3 py-2 bg-[#059669] text-white border border-[#1B1C1A] text-xs font-mono font-bold uppercase rounded-[2px] hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>EDIT RUBRIC</span>
                  </button>

                  <button
                    onClick={() => handleDuplicateAsNew(selectedRubric)}
                    className="px-3 py-2 bg-[#FAF9F5] border border-[#1B1C1A] text-xs font-mono font-bold uppercase rounded-[2px] hover:bg-[#EFEEEA] flex items-center gap-1.5"
                  >
                    {copiedId === selectedRubric.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#059669]" />
                        <span>COPIED!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#1B1C1A]" />
                        <span>COPY AS NEW</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteRubric(selectedRubric.id)}
                    className="px-3 py-2 bg-white border border-red-700 text-red-700 text-xs font-mono font-bold uppercase rounded-[2px] hover:bg-red-50 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>DELETE</span>
                  </button>
                </div>
              </div>

              {/* Criteria Matrix Breakdown */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#2563EB]" />
                  <span>CRITERIA & RATING BREAKDOWN ({selectedRubric.criteria.length} ITEMS)</span>
                </h3>

                {selectedRubric.criteria.map((c, cIdx) => (
                  <div key={c.id} className="border border-[#1B1C1A] rounded-[2px] overflow-hidden">
                    <div className="bg-[#EFEEEA] p-3 border-b border-[#1B1C1A] flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-[#1B1C1A]">
                        {cIdx + 1}. {c.description}
                      </span>
                      <span className="font-bold text-[#2563EB] bg-white px-2 py-0.5 border border-[#1B1C1A]">
                        MAX {c.points} PTS
                      </span>
                    </div>

                    <div className="p-3 bg-white space-y-2">
                      <p className="text-xs text-gray-600 mb-3">{c.longDescription}</p>

                      <div className="border border-gray-300 rounded-[2px] divide-y divide-gray-200 overflow-hidden bg-[#FAF9F5]">
                        {[...c.ratings]
                          .sort((a, b) => b.points - a.points)
                          .map((rt) => (
                            <div
                              key={rt.id}
                              className="p-3 flex items-start gap-4 hover:bg-white transition-colors"
                            >
                              <div className="w-24 shrink-0">
                                <span className="inline-block px-2.5 py-1 bg-white border border-[#1B1C1A] text-xs font-black text-[#1B1C1A] text-center w-full rounded-[1px]">
                                  {rt.points} PTS
                                </span>
                              </div>
                              <div className="flex-1 text-xs text-gray-800 pt-0.5 leading-relaxed font-sans font-medium">
                                {rt.description}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[#FEF08A]/30 border border-[#1B1C1A] rounded-[2px] text-xs font-mono flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-[#7A5500] shrink-0 mt-0.5" />
                <span>
                  <strong>Canvas Lock Bypass Note:</strong> Canvas locks rubrics once graded on any assignment. Clicking <strong>"Edit Rubric"</strong> or <strong>"Copy As New"</strong> creates editable versions that can be modified and reassigned without disturbing past graded records.
                </span>
              </div>
            </>
          )}

          {/* ========================================= */}
          {/* EDIT MODE FORM                            */}
          {/* ========================================= */}
          {isEditing && editForm && (
            <div className="space-y-6 animate-fadeIn">
              {/* Edit Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1B1C1A] pb-4 bg-[#FEF08A]/40 -m-6 p-6 mb-2 rounded-t-[2px]">
                <div>
                  <span className="px-2 py-0.5 bg-[#1B1C1A] text-[#FEF08A] font-bold text-[10px] uppercase">
                    EDIT MODE ACTIVE
                  </span>
                  <h2 className="text-2xl font-black text-[#1B1C1A] uppercase tracking-tight mt-1">
                    EDITING: {editForm.name || 'UNTITLED RUBRIC'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm(null);
                    }}
                    className="px-3 py-2 bg-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-gray-100 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>CANCEL</span>
                  </button>

                  <button
                    onClick={handleSaveRubric}
                    className="px-5 py-2 bg-[#059669] text-white border border-[#1B1C1A] font-mono font-bold text-xs uppercase rounded-[2px] hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>SAVE RUBRIC</span>
                  </button>
                </div>
              </div>

              {/* Rubric General Properties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF9F5] p-4 border border-[#1B1C1A] rounded-[2px]">
                <div>
                  <label className="block font-bold text-[#1B1C1A] uppercase mb-1">Rubric Title:</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full p-2 bg-white border border-[#1B1C1A] font-bold text-xs rounded-[1px] outline-none"
                    placeholder="e.g. Lab Report Rubric, Argumentative Essay..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1B1C1A] uppercase mb-1">Category / Grouping:</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full p-2 bg-white border border-[#1B1C1A] font-bold text-xs rounded-[1px] outline-none"
                  >
                    <option value="Essays & Papers">Essays & Papers</option>
                    <option value="Science Labs">Science Labs</option>
                    <option value="Discussions">Discussions</option>
                    <option value="Projects">Projects</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              {/* Criteria Editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1B1C1A] pb-2">
                  <h3 className="font-extrabold uppercase text-[#1B1C1A] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#059669]" />
                    <span>CRITERIA & RATING LEVELS ({editForm.criteria.length})</span>
                  </h3>

                  <button
                    onClick={handleAddCriterion}
                    className="px-3 py-1.5 bg-[#2563EB] text-white border border-[#1B1C1A] font-bold text-xs uppercase rounded-[2px] hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ADD CRITERION</span>
                  </button>
                </div>

                {editForm.criteria.map((c, cIdx) => (
                  <div key={c.id} className="border-2 border-[#1B1C1A] rounded-[2px] p-4 bg-white space-y-3">
                    {/* Criterion Title & Delete */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="px-2 py-0.5 bg-[#1B1C1A] text-white font-bold text-[10px] uppercase">
                        CRITERION #{cIdx + 1}
                      </span>

                      <button
                        onClick={() => handleRemoveCriterion(c.id)}
                        className="text-red-700 hover:text-red-900 font-bold uppercase text-[11px] flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>REMOVE CRITERION</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={c.description}
                        onChange={(e) => handleUpdateCriterionField(c.id, 'description', e.target.value)}
                        placeholder="Criterion Title (e.g. Thesis & Evidence)"
                        className="w-full p-2 bg-[#FAF9F5] border border-[#1B1C1A] font-bold text-xs rounded-[1px] outline-none"
                      />

                      <textarea
                        value={c.longDescription}
                        onChange={(e) => handleUpdateCriterionField(c.id, 'longDescription', e.target.value)}
                        placeholder="Long Description / Grading expectations..."
                        rows={2}
                        className="w-full p-2 bg-[#FAF9F5] border border-[#1B1C1A] text-xs rounded-[1px] outline-none"
                      />
                    </div>

                    {/* Ratings Breakdown Editor */}
                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase text-gray-700">
                        <span>RATING LEVELS FOR THIS CRITERION:</span>
                        <button
                          onClick={() => handleAddRating(c.id)}
                          className="text-[#059669] hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>ADD RATING LEVEL</span>
                        </button>
                      </div>

                      <div className="border border-[#1B1C1A] rounded-[2px] divide-y divide-[#1B1C1A] overflow-hidden bg-white">
                        {[...c.ratings]
                          .sort((a, b) => b.points - a.points)
                          .map((rt) => (
                            <div
                              key={rt.id}
                              className="p-2.5 bg-[#FAF9F5] flex items-center gap-3 hover:bg-white transition-colors"
                            >
                              {/* Point Value Input on Left */}
                              <div className="w-28 shrink-0 flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase text-gray-500 font-mono">PTS:</span>
                                <input
                                  type="number"
                                  value={rt.points}
                                  onChange={(e) => handleUpdateRating(c.id, rt.id, 'points', Number(e.target.value))}
                                  className="w-full p-1.5 bg-white border border-[#1B1C1A] font-extrabold text-xs rounded-[1px] text-[#059669] text-center outline-none focus:ring-1 focus:ring-[#059669]"
                                />
                              </div>

                              {/* Rating Description Input on Right */}
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={rt.description}
                                  onChange={(e) => handleUpdateRating(c.id, rt.id, 'description', e.target.value)}
                                  className="w-full p-1.5 bg-white border border-gray-300 font-mono text-xs text-[#1B1C1A] rounded-[1px] outline-none focus:border-[#1B1C1A]"
                                  placeholder="Rating level description..."
                                />
                              </div>

                              {/* Remove Rating Level */}
                              <button
                                onClick={() => handleRemoveRating(c.id, rt.id)}
                                className="p-1.5 text-gray-400 hover:text-red-700 font-bold transition-colors"
                                title="Remove rating level"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t-2 border-[#1B1C1A]">
                <button
                  onClick={() => handleDeleteRubric(editForm.id)}
                  className="px-3 py-2 bg-white border border-red-700 text-red-700 font-bold uppercase text-xs rounded-[2px] hover:bg-red-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>DELETE THIS RUBRIC</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm(null);
                    }}
                    className="px-4 py-2 bg-white border border-[#1B1C1A] font-bold text-xs uppercase rounded-[2px] hover:bg-gray-100"
                  >
                    CANCEL
                  </button>

                  <button
                    onClick={handleSaveRubric}
                    className="px-6 py-2 bg-[#059669] text-white border border-[#1B1C1A] font-extrabold text-xs uppercase rounded-[2px] hover:bg-emerald-700 flex items-center gap-2 shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>SAVE RUBRIC</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
