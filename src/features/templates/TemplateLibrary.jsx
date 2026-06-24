import { useState, useMemo } from 'react'
import { Search, Plus, ChevronRight, ChevronDown, Pencil, Trash2, Play, FolderPlus, Folder, X } from 'lucide-react'
import { saveFolder, deleteFolder, deleteTemplate, newFolderId } from '../../storage/templates.js'

export default function TemplateLibrary({ templates, folders, onUse, onEdit, onNew, onDataChange, skipDeleteConfirm = false, autoExpandFolders = true }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(new Set(autoExpandFolders ? folders.map(f => f.id).concat(['unfiled']) : []))
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  const [deletingFolder, setDeletingFolder] = useState(null)
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return templates.filter(t => t.name.toLowerCase().includes(q))
  }, [search, templates])

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDeleteTemplate(template) {
    await deleteTemplate(template.id)
    setDeletingTemplate(null)
    onDataChange()
  }

  async function handleDeleteFolder(folder) {
    await deleteFolder(folder.id)
    setDeletingFolder(null)
    onDataChange()
  }

  function requestDeleteTemplate(template) {
    if (skipDeleteConfirm) { handleDeleteTemplate(template) } else { setDeletingTemplate(template) }
  }

  function requestDeleteFolder(folder) {
    if (skipDeleteConfirm) { handleDeleteFolder(folder) } else { setDeletingFolder(folder) }
  }

  async function handleRenameFolder(folder) {
    if (!renameName.trim()) return
    await saveFolder({ ...folder, name: renameName.trim() })
    setRenamingFolder(null)
    setRenameName('')
    onDataChange()
  }

  async function handleAddFolder() {
    if (!newFolderName.trim()) return
    await saveFolder({ id: newFolderId(), name: newFolderName.trim(), createdAt: new Date().toISOString() })
    setAddingFolder(false)
    setNewFolderName('')
    onDataChange()
  }

  const folderedGroups = useMemo(() => {
    return folders.map(folder => ({
      folder,
      items: templates.filter(t => t.folderId === folder.id)
        .sort((a, b) => {
          if (!a.lastUsed && !b.lastUsed) return 0
          if (!a.lastUsed) return 1
          if (!b.lastUsed) return -1
          return new Date(b.lastUsed) - new Date(a.lastUsed)
        }),
    }))
  }, [templates, folders])

  const unfiled = useMemo(
    () => templates.filter(t => !t.folderId)
      .sort((a, b) => {
        if (!a.lastUsed && !b.lastUsed) return 0
        if (!a.lastUsed) return 1
        if (!b.lastUsed) return -1
        return new Date(b.lastUsed) - new Date(a.lastUsed)
      }),
    [templates],
  )

  return (
    <div className="space-y-4">
      {/* Search + New button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="input pl-9"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={onNew}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {/* Flat search results */}
      {filtered && (
        <div className="card divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-gray-400 text-center">No templates match "{search}"</p>
          )}
          {filtered.map(t => (
            <TemplateRow key={t.id} template={t} onUse={onUse} onEdit={onEdit}
              onDelete={() => requestDeleteTemplate(t)} />
          ))}
        </div>
      )}

      {/* Folder tree */}
      {!filtered && (
        <>
          {folderedGroups.map(({ folder, items }) => (
            <FolderSection
              key={folder.id}
              folder={folder}
              items={items}
              expanded={expanded.has(folder.id)}
              onToggle={() => toggleExpand(folder.id)}
              onUse={onUse}
              onEdit={onEdit}
              onDeleteTemplate={t => requestDeleteTemplate(t)}
              onRenameFolder={() => { setRenamingFolder(folder); setRenameName(folder.name) }}
              onDeleteFolder={() => requestDeleteFolder(folder)}
              onNewInFolder={() => onNew(folder.id)}
              isRenaming={renamingFolder?.id === folder.id}
              renameName={renameName}
              onRenameNameChange={setRenameName}
              onRenameConfirm={() => handleRenameFolder(folder)}
              onRenameCancel={() => { setRenamingFolder(null); setRenameName('') }}
            />
          ))}

          {/* Unfiled */}
          {unfiled.length > 0 && (
            <FolderSection
              folder={{ id: 'unfiled', name: 'Unfiled' }}
              items={unfiled}
              expanded={expanded.has('unfiled')}
              onToggle={() => toggleExpand('unfiled')}
              onUse={onUse}
              onEdit={onEdit}
              onDeleteTemplate={t => requestDeleteTemplate(t)}
              isSystemFolder
            />
          )}

          {/* New folder row */}
          <div className="pt-2">
            {addingFolder ? (
              <div className="flex items-center gap-2">
                <FolderPlus size={15} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddFolder(); if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName('') } }}
                  placeholder="Folder name"
                  className="input text-sm flex-1"
                  autoFocus
                />
                <button className="btn-primary text-sm px-3 py-1.5" onClick={handleAddFolder}>Add</button>
                <button className="btn-ghost text-sm" onClick={() => { setAddingFolder(false); setNewFolderName('') }}>Cancel</button>
              </div>
            ) : (
              <button
                className="btn-ghost text-sm text-gray-500 flex items-center gap-1.5"
                onClick={() => setAddingFolder(true)}
              >
                <FolderPlus size={15} /> New Folder
              </button>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!filtered && templates.length === 0 && (
        <div className="card p-12 text-center space-y-3">
          <p className="text-gray-500 text-sm">No templates yet.</p>
          <button className="btn-primary" onClick={() => onNew(null)}>Create your first template</button>
        </div>
      )}

      {/* Delete template confirm */}
      {deletingTemplate && (
        <ConfirmDialog
          message={`Delete "${deletingTemplate.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteTemplate(deletingTemplate)}
          onCancel={() => setDeletingTemplate(null)}
          danger
        />
      )}

      {/* Delete folder confirm */}
      {deletingFolder && (
        <ConfirmDialog
          message={`Delete folder "${deletingFolder.name}"? Templates inside will be moved to Unfiled.`}
          confirmLabel="Delete Folder"
          onConfirm={() => handleDeleteFolder(deletingFolder)}
          onCancel={() => setDeletingFolder(null)}
          danger
        />
      )}
    </div>
  )
}

function FolderSection({
  folder, items, expanded, onToggle, onUse, onEdit, onDeleteTemplate,
  onRenameFolder, onDeleteFolder, onNewInFolder, isSystemFolder,
  isRenaming, renameName, onRenameNameChange, onRenameConfirm, onRenameCancel,
}) {
  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
          <Folder size={15} className="shrink-0" style={{ color: 'var(--cpt-color)' }} />
          {isRenaming ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={renameName}
                onChange={e => onRenameNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onRenameConfirm(); if (e.key === 'Escape') onRenameCancel() }}
                className="input text-sm w-40"
                autoFocus
              />
              <button className="btn-primary text-xs px-2 py-1" onClick={onRenameConfirm}>Save</button>
              <button className="btn-ghost text-xs" onClick={onRenameCancel}>Cancel</button>
            </div>
          ) : (
            <span className="text-sm font-semibold text-gray-700 truncate">{folder.name}</span>
          )}
          <span className="text-xs text-gray-400 shrink-0">({items.length})</span>
        </div>
        {!isSystemFolder && !isRenaming && (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              className="btn-ghost text-xs px-2 py-1 text-gray-500 flex items-center gap-1"
              onClick={onNewInFolder}
            >
              <Plus size={13} /> New
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded" onClick={onRenameFolder} title="Rename folder">
              <Pencil size={13} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded" onClick={onDeleteFolder} title="Delete folder">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="divide-y divide-gray-100">
          {items.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No templates in this folder.</p>
          )}
          {items.map(t => (
            <TemplateRow key={t.id} template={t} onUse={onUse} onEdit={onEdit} onDelete={() => onDeleteTemplate(t)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateRow({ template, onUse, onEdit, onDelete }) {
  const lastUsedText = template.lastUsed
    ? `Last used ${new Date(template.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Never used'

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 group">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{template.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{lastUsedText}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          onClick={() => onUse(template)}
        >
          <Play size={12} /> Use
        </button>
        <button
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          onClick={() => onEdit(template)}
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDelete(template)}
          title="Delete template"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <p className="text-sm text-gray-700">{message}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
