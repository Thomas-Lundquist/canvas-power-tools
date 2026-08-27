import { useState, useLayoutEffect, useRef, useMemo } from 'react'
import {
  Plus, FolderPlus, FileText, ClipboardList, Folder, Layers, ChevronDown,
  MoreHorizontal, Pencil, Trash2, LayoutList, LayoutGrid,
} from 'lucide-react'
import { saveFolder, deleteFolder, deleteTemplate, newFolderId, saveTemplate } from '../../storage/templates.js'
import useSort from '../../utils/useSort.js'
import PageHeader from '../../components/PageHeader.jsx'
import Toolbar from '../../components/Toolbar.jsx'
import SearchInput from '../../components/SearchInput.jsx'
import SortControl from '../../components/SortControl.jsx'
import ListRow from '../../components/ListRow.jsx'
import Badge from '../../components/Badge.jsx'
import Button from '../../components/Button.jsx'
import IconButton from '../../components/IconButton.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import Modal from '../../components/Modal.jsx'
import Menu from '../../components/Menu.jsx'

const SORT_OPTIONS = [
  { key: 'lastUsed', label: 'Last Used' },
  { key: 'name', label: 'Name' },
]

const PREVIEW_RENDER_WIDTH = 900

const SUBMISSION_LABELS = {
  online: 'Online',
  on_paper: 'On Paper',
  no_submission: 'No Submission',
  external_tool: 'External Tool',
}

function formatLastUsed(lastUsed) {
  if (!lastUsed) return 'Never used'
  return `Last used ${new Date(lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function formatMeta(t) {
  const parts = []
  if (t.type !== 'page' && t.fields?.points != null) parts.push(`${t.fields.points} pts`)
  const subLabel = SUBMISSION_LABELS[t.fields?.submissionType]
  if (t.type !== 'page' && subLabel) parts.push(subLabel)
  parts.push(formatLastUsed(t.lastUsed))
  return parts.join(' · ')
}

export default function TemplateLibrary({
  templates, folders, onUse, onEdit, onNew, onDataChange,
  viewMode = 'list', onViewModeChange,
  skipDeleteConfirm = false,
}) {
  const [search, setSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('all')
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  const [deletingFolder, setDeletingFolder] = useState(null)
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [movingTemplate, setMovingTemplate] = useState(null)
  const [draggedTemplate, setDraggedTemplate] = useState(null)

  const sort = useSort(templates, { key: 'lastUsed', dir: 'desc' })
  const isSearching = search.trim().length > 0

  const sidebarFolders = useMemo(() => {
    const unfiledCount = templates.filter(t => !t.folderId).length
    return [
      { id: 'all', name: 'All Templates', count: templates.length, icon: Layers, droppable: false },
      ...folders.map(f => ({
        id: f.id, name: f.name,
        count: templates.filter(t => t.folderId === f.id).length,
        icon: Folder, droppable: true, editable: true,
      })),
      { id: 'unfiled', name: 'Unfiled', count: unfiledCount, icon: Folder, droppable: true },
    ]
  }, [templates, folders])

  const visibleTemplates = useMemo(() => {
    if (isSearching) {
      const q = search.toLowerCase()
      return sort.sorted.filter(t => t.name.toLowerCase().includes(q))
    }
    if (selectedFolder === 'all') return sort.sorted
    if (selectedFolder === 'unfiled') return sort.sorted.filter(t => !t.folderId)
    return sort.sorted.filter(t => t.folderId === selectedFolder)
  }, [isSearching, search, selectedFolder, sort.sorted])

  async function handleDeleteTemplate(template) {
    await deleteTemplate(template.id)
    setDeletingTemplate(null)
    onDataChange()
  }

  async function handleDeleteFolder(folder) {
    await deleteFolder(folder.id)
    setDeletingFolder(null)
    if (selectedFolder === folder.id) setSelectedFolder('all')
    onDataChange()
  }

  async function handleMoveTemplate(folderId) {
    await saveTemplate({ ...movingTemplate, folderId: folderId ?? null })
    setMovingTemplate(null)
    onDataChange()
  }

  async function handleDropOnFolder(folderId) {
    if (!draggedTemplate) return
    if ((folderId ?? null) === (draggedTemplate.folderId ?? null)) return
    await saveTemplate({ ...draggedTemplate, folderId: folderId ?? null })
    setDraggedTemplate(null)
    onDataChange()
  }

  async function handleRenameFolder() {
    if (!renameName.trim()) return
    await saveFolder({ ...renamingFolder, name: renameName.trim() })
    setRenamingFolder(null)
    setRenameName('')
    onDataChange()
  }

  async function handleAddFolder() {
    if (!newFolderName.trim()) return
    const id = newFolderId()
    await saveFolder({ id, name: newFolderName.trim(), createdAt: new Date().toISOString() })
    setAddingFolder(false)
    setNewFolderName('')
    setSelectedFolder(id)
    onDataChange()
  }

  function requestDeleteTemplate(template) {
    if (skipDeleteConfirm) handleDeleteTemplate(template)
    else setDeletingTemplate(template)
  }

  function requestDeleteFolder(folder) {
    if (skipDeleteConfirm) handleDeleteFolder(folder)
    else setDeletingFolder(folder)
  }

  function handleNewTemplate() {
    const folderId = selectedFolder === 'all' || selectedFolder === 'unfiled' ? null : selectedFolder
    onNew(folderId)
  }

  function renderRow(t) {
    return (
      <div
        key={t.id}
        draggable="true"
        onDragStart={() => setDraggedTemplate(t)}
        onDragEnd={() => setDraggedTemplate(null)}
        title="Drag to move to a different folder"
      >
        <ListRow
          lead={
            <Badge tone="muted" icon={t.type === 'page' ? FileText : ClipboardList}>
              {t.type === 'page' ? 'Page' : 'Assignment'}
            </Badge>
          }
          title={t.name}
          meta={formatMeta(t)}
          primaryAction={
            <Button variant="primary" size="sm" onClick={() => onUse(t)}>Use</Button>
          }
          overflow={
            <TemplateActionsMenu onEdit={() => onEdit(t)} onMove={() => setMovingTemplate(t)} onDelete={() => requestDeleteTemplate(t)} />
          }
        />
      </div>
    )
  }

  function renderTile(t) {
    return (
      <TemplateTile
        key={t.id}
        template={t}
        onUse={() => onUse(t)}
        onEdit={() => onEdit(t)}
        onDelete={() => requestDeleteTemplate(t)}
        onMove={() => setMovingTemplate(t)}
        onDragStart={() => setDraggedTemplate(t)}
        onDragEnd={() => setDraggedTemplate(null)}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Assignment Templates"
        actions={
          <NewDropdown
            onNewTemplate={handleNewTemplate}
            onNewFolder={() => setAddingFolder(true)}
          />
        }
      >
        Save assignment structures and deploy them to one or more courses instantly.
      </PageHeader>

      <Toolbar className="table-toolbar">
        <Toolbar.Start>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search templates…"
            ariaLabel="Search templates"
          />
        </Toolbar.Start>
        <Toolbar.End>
          <ViewToggle value={viewMode} onChange={onViewModeChange} />
          <SortControl
            options={SORT_OPTIONS}
            value={sort.value}
            onChange={sort.setSort}
          />
        </Toolbar.End>
      </Toolbar>

      <div className="grid grid-cols-[minmax(0,14rem)_1fr] gap-4 items-start">
        {/* Folder sidebar */}
        <nav
          aria-label="Template folders"
          className="card domain-accent shadow-[var(--shadow-sm)] overflow-hidden"
          style={{ '--domain-color': 'var(--color-domain-assignments)' }}
        >
          <div className="card-titlebar">
            <span>Folders</span>
            <span className="tabular-nums text-[var(--color-text-muted)]">{folders.length}</span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {sidebarFolders.map(f => (
              <SidebarFolderRow
                key={f.id}
                folder={f}
                selected={!isSearching && selectedFolder === f.id}
                onSelect={() => setSelectedFolder(f.id)}
                onRename={f.editable ? () => { setRenamingFolder(f); setRenameName(f.name) } : undefined}
                onDelete={f.editable ? () => requestDeleteFolder(f) : undefined}
                onDrop={f.droppable ? () => handleDropOnFolder(f.id === 'unfiled' ? null : f.id) : undefined}
              />
            ))}
          </div>
        </nav>

        {/* Main viewport */}
        <div>
          {templates.length === 0 && folders.length === 0 ? (
            <EmptyState
              title="No templates yet"
              description="Save an assignment structure once and deploy it to any number of courses."
              action={<Button variant="primary" onClick={() => onNew(null)}>Create your first template</Button>}
            />
          ) : visibleTemplates.length === 0 ? (
            <EmptyState
              title={isSearching ? `No results for "${search}"` : 'No templates in this folder'}
            />
          ) : viewMode === 'tile' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
              {visibleTemplates.map(renderTile)}
            </div>
          ) : (
            <div
              className="card domain-accent shadow-[var(--shadow-md)]"
              style={{ '--domain-color': 'var(--color-domain-assignments)' }}
            >
              <div className="card-titlebar">
                <span>{isSearching ? 'Results' : 'Templates'}</span>
                <span className="tabular-nums text-[var(--color-text-muted)]">{visibleTemplates.length}</span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {visibleTemplates.map(renderRow)}
              </div>
            </div>
          )}
        </div>
      </div>

      {addingFolder && (
        <Modal onClose={() => { setAddingFolder(false); setNewFolderName('') }} title="New Folder">
          <div className="space-y-4">
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddFolder()
                if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName('') }
              }}
              placeholder="Folder name"
              className="input w-full"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setAddingFolder(false); setNewFolderName('') }}>Cancel</Button>
              <Button variant="primary" onClick={handleAddFolder}>Create Folder</Button>
            </div>
          </div>
        </Modal>
      )}

      {renamingFolder && (
        <Modal onClose={() => { setRenamingFolder(null); setRenameName('') }} title="Rename Folder">
          <div className="space-y-4">
            <input
              type="text"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder() }}
              className="input w-full"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setRenamingFolder(null); setRenameName('') }}>Cancel</Button>
              <Button variant="primary" onClick={handleRenameFolder}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {deletingTemplate && (
        <Modal onClose={() => setDeletingTemplate(null)} title="Delete Template">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-body)]">
              Delete "{deletingTemplate.name}"? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingTemplate(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDeleteTemplate(deletingTemplate)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {deletingFolder && (
        <Modal onClose={() => setDeletingFolder(null)} title="Delete Folder">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-body)]">
              Delete folder "{deletingFolder.name}"? Templates inside will be moved to Unfiled.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingFolder(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDeleteFolder(deletingFolder)}>Delete Folder</Button>
            </div>
          </div>
        </Modal>
      )}

      {movingTemplate && (
        <Modal onClose={() => setMovingTemplate(null)} title={`Move "${movingTemplate.name}"`}>
          <div className="space-y-1">
            <button
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[var(--radius-control)] transition-colors duration-75 ${
                !movingTemplate.folderId
                  ? 'bg-[rgba(var(--cpt-color-rgb),0.08)] text-[var(--color-text-body)]'
                  : 'text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)]'
              }`}
              onClick={() => handleMoveTemplate(null)}
            >
              <Folder size={14} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
              Unfiled
              {!movingTemplate.folderId && <span className="ml-auto text-xs text-[var(--color-text-muted)]">Current</span>}
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[var(--radius-control)] transition-colors duration-75 ${
                  movingTemplate.folderId === f.id
                    ? 'bg-[rgba(var(--cpt-color-rgb),0.08)] text-[var(--color-text-body)]'
                    : 'text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)]'
                }`}
                onClick={() => handleMoveTemplate(f.id)}
              >
                <Folder size={14} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
                {f.name}
                {movingTemplate.folderId === f.id && <span className="ml-auto text-xs text-[var(--color-text-muted)]">Current</span>}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => setMovingTemplate(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NewDropdown({ onNewTemplate, onNewFolder }) {
  return (
    <Menu
      width="10rem"
      trigger={p => (
        <Button variant="primary" {...p}>
          <Plus size={15} aria-hidden="true" /> New <ChevronDown size={13} aria-hidden="true" />
        </Button>
      )}
    >
      <Menu.Item icon={ClipboardList} onSelect={onNewTemplate}>New Template</Menu.Item>
      <Menu.Item icon={FolderPlus} onSelect={onNewFolder}>New Folder</Menu.Item>
    </Menu>
  )
}

function ViewToggle({ value, onChange }) {
  const btnBase =
    'inline-flex items-center justify-center p-1.5 transition-colors duration-75 rounded'
  const active = 'bg-[var(--color-bg-input)] text-[var(--color-text-body)]'
  const inactive =
    'text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)]'

  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center rounded-[var(--radius-control)] border border-[var(--color-border)] p-0.5 gap-0.5"
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        aria-label="List view"
        title="List view"
        className={`${btnBase} ${value === 'list' ? active : inactive}`}
      >
        <LayoutList size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange('tile')}
        aria-pressed={value === 'tile'}
        aria-label="Tile view"
        title="Tile view"
        className={`${btnBase} ${value === 'tile' ? active : inactive}`}
      >
        <LayoutGrid size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

// A single row in the folder sidebar — selectable, and (for real folders and
// Unfiled) a drag-and-drop target for moving a template. "All Templates" is
// not droppable (it isn't a real bucket a template can belong to).
function SidebarFolderRow({ folder, selected, onSelect, onRename, onDelete, onDrop }) {
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)
  const Icon = folder.icon

  function handleDragEnter() { if (onDrop) { dragCounter.current++; setDragOver(true) } }
  function handleDragLeave() { if (onDrop) { dragCounter.current--; if (dragCounter.current === 0) setDragOver(false) } }
  function handleDrop() { if (!onDrop) return; dragCounter.current = 0; setDragOver(false); onDrop() }

  return (
    <div
      className={`group relative rounded-[var(--radius-control)] ${dragOver ? 'ring-2 ring-[var(--cpt-color)] ring-inset' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={e => { if (onDrop) e.preventDefault() }}
      onDrop={handleDrop}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-control)] text-sm text-left transition-colors duration-75 ${
          selected
            ? 'bg-[var(--cpt-color)] text-white font-medium'
            : 'text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)]'
        }`}
      >
        <Icon size={14} className={`shrink-0 ${selected ? 'text-white' : 'text-[var(--color-text-muted)]'}`} aria-hidden="true" />
        <span className="truncate flex-1">{folder.name}</span>
        <span className={`shrink-0 text-xs ${selected ? 'text-white/80' : 'text-[var(--color-text-muted)]'} ${onRename ? 'group-hover:opacity-0 group-focus-within:opacity-0' : ''}`}>
          {folder.count}
        </span>
      </button>
      {onRename && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <FolderMenu folderName={folder.name} onRename={onRename} onDelete={onDelete} light={selected} />
        </div>
      )}
    </div>
  )
}

function FolderMenu({ folderName, onRename, onDelete, light = false }) {
  return (
    <Menu
      width="9rem"
      trigger={p => (
        <IconButton
          icon={MoreHorizontal}
          label={`Options for ${folderName}`}
          size="sm"
          className={light ? 'text-white hover:bg-white/20' : ''}
          {...p}
        />
      )}
    >
      <Menu.Item icon={Pencil} onSelect={onRename}>Rename</Menu.Item>
      <Menu.Item icon={Trash2} danger onSelect={onDelete}>Delete Folder</Menu.Item>
    </Menu>
  )
}

function stripImages(html) {
  return html ? html.replace(/<img[^>]*>/gi, '') : ''
}

function DescriptionPreview({ html, Icon }) {
  const outerRef = useRef(null)
  const [scale, setScale] = useState(null)
  const hasContent = Boolean(html && html.replace(/<[^>]*>/g, '').trim())

  useLayoutEffect(() => {
    if (!outerRef.current || !hasContent) return
    const { width } = outerRef.current.getBoundingClientRect()
    if (width > 0) setScale(width / PREVIEW_RENDER_WIDTH)
  }, [hasContent])

  if (!hasContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Icon size={36} className="text-[var(--color-text-muted)] opacity-25" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div ref={outerRef} className="flex-1 relative overflow-hidden">
      {scale !== null && (
        <>
          <div
            className="absolute top-0 left-0 p-3"
            style={{
              width: `${PREVIEW_RENDER_WIDTH}px`,
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
              pointerEvents: 'none',
              userSelect: 'none',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              color: 'var(--color-text-body)',
            }}
            dangerouslySetInnerHTML={{ __html: stripImages(html) }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--color-bg-surface))' }}
          />
        </>
      )}
    </div>
  )
}

function TemplateTile({ template, onUse, onEdit, onDelete, onMove, onDragStart, onDragEnd }) {
  const isPage = template.type === 'page'
  const Icon = isPage ? FileText : ClipboardList

  return (
    <div
      draggable="true"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="card overflow-hidden flex flex-col cursor-grab transition-colors hover:border-[var(--cpt-color)]"
      title="Drag to move to a different folder"
    >
      {/* Header — type badge + name + actions */}
      <div className="card-titlebar">
        <span className="flex min-w-0 items-center gap-2">
          <Badge tone="muted" icon={Icon}>{isPage ? 'Page' : 'Assignment'}</Badge>
          <span
            className="truncate normal-case font-medium text-[var(--color-text-body)]"
            title={template.name}
          >
            {template.name}
          </span>
        </span>
        <TemplateActionsMenu
          templateName={template.name}
          onEdit={onEdit}
          onMove={onMove}
          onDelete={onDelete}
          z={30}
        />
      </div>

      {/* Scaled, sanitized instructions thumbnail (icon fallback when empty) */}
      <div className="flex h-32 overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg-page)]">
        <DescriptionPreview html={template.fields?.description} Icon={Icon} />
      </div>

      {/* Footer — metadata + primary Use action */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="truncate text-xs text-[var(--color-text-muted)]">
          {formatMeta(template)}
        </span>
        <Button variant="primary" size="sm" onClick={onUse}>Use</Button>
      </div>
    </div>
  )
}

function TemplateActionsMenu({ templateName, onEdit, onMove, onDelete, z = 20 }) {
  return (
    <Menu
      width="7rem"
      z={z}
      trigger={p => (
        <IconButton
          icon={MoreHorizontal}
          label={templateName ? `More actions for ${templateName}` : 'More actions'}
          size="sm"
          {...p}
        />
      )}
    >
      <Menu.Item icon={Pencil} onSelect={onEdit}>Edit</Menu.Item>
      <Menu.Item icon={Folder} onSelect={onMove}>Move To</Menu.Item>
      <Menu.Item icon={Trash2} danger onSelect={onDelete}>Delete</Menu.Item>
    </Menu>
  )
}
