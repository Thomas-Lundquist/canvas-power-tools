import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import {
  Plus, FolderPlus, FileText, ClipboardList, Folder, ChevronDown,
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

const SORT_OPTIONS = [
  { key: 'lastUsed', label: 'Last Used' },
  { key: 'name', label: 'Name' },
]

const CARD_SHADOW = '[box-shadow:0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]'
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
  if (t.fields?.points != null) parts.push(`${t.fields.points} pts`)
  const subLabel = SUBMISSION_LABELS[t.fields?.submissionType]
  if (subLabel) parts.push(subLabel)
  parts.push(formatLastUsed(t.lastUsed))
  return parts.join(' · ')
}

export default function TemplateLibrary({
  templates, folders, onUse, onEdit, onNew, onDataChange,
  viewMode = 'list', onViewModeChange,
  skipDeleteConfirm = false, autoExpandFolders = true,
}) {
  const [search, setSearch] = useState('')
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  const [deletingFolder, setDeletingFolder] = useState(null)
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [movingTemplate, setMovingTemplate] = useState(null)
  const [draggedTemplate, setDraggedTemplate] = useState(null)

  const sort = useSort(templates, { key: 'lastUsed', dir: 'desc' })

  const filtered = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return sort.sorted.filter(t => t.name.toLowerCase().includes(q))
  }, [search, sort.sorted])

  const folderedGroups = useMemo(
    () => folders.map(folder => ({
      folder,
      items: sort.sorted.filter(t => t.folderId === folder.id),
    })),
    [sort.sorted, folders],
  )

  const unfiled = useMemo(
    () => sort.sorted.filter(t => !t.folderId),
    [sort.sorted],
  )

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

  async function handleMoveTemplate(folderId) {
    await saveTemplate({ ...movingTemplate, folderId: folderId ?? null })
    setMovingTemplate(null)
    onDataChange()
  }

  async function handleDrop(folderId) {
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
    await saveFolder({ id: newFolderId(), name: newFolderName.trim(), createdAt: new Date().toISOString() })
    setAddingFolder(false)
    setNewFolderName('')
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
            <OverflowMenu onEdit={() => onEdit(t)} onDelete={() => requestDeleteTemplate(t)} onMove={() => setMovingTemplate(t)} />
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
            onNewTemplate={() => onNew(null)}
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

      {/* Flat search results */}
      {filtered && (
        <div
          className={`card domain-accent ${CARD_SHADOW} divide-y divide-[var(--color-border)]`}
          style={{ '--domain-color': 'var(--color-domain-assignments)' }}
        >
          {filtered.length === 0 ? (
            <EmptyState title={`No results for "${search}"`} />
          ) : (
            filtered.map(renderRow)
          )}
        </div>
      )}

      {/* Folder tree */}
      {!filtered && (
        <div className="space-y-4">
          {templates.length === 0 && (
            <EmptyState
              title="No templates yet"
              description="Save an assignment structure once and deploy it to any number of courses."
              action={<Button variant="primary" onClick={() => onNew(null)}>Create your first template</Button>}
            />
          )}

          {templates.length > 0 && (
            <>
              {folderedGroups.map(({ folder, items }) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  items={items}
                  viewMode={viewMode}
                  defaultOpen={autoExpandFolders}
                  onNew={onNew}
                  onRename={f => { setRenamingFolder(f); setRenameName(f.name) }}
                  onDelete={requestDeleteFolder}
                  renderRow={renderRow}
                  renderTile={renderTile}
                  onDrop={handleDrop}
                />
              ))}

              {unfiled.length > 0 && (
                <SectionCard
                  label="Unfiled"
                  count={unfiled.length}
                  items={unfiled}
                  viewMode={viewMode}
                  defaultOpen={autoExpandFolders}
                  renderRow={renderRow}
                  renderTile={renderTile}
                  onDrop={handleDrop}
                />
              )}
            </>
          )}
        </div>
      )}

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
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-md transition-colors duration-75 ${
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
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-md transition-colors duration-75 ${
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
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handle(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button variant="primary" onClick={() => setOpen(v => !v)} aria-haspopup="true" aria-expanded={open}>
        <Plus size={15} aria-hidden="true" /> New <ChevronDown size={13} aria-hidden="true" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md shadow-md py-1 min-w-[10rem]">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onNewTemplate() }}
          >
            <ClipboardList size={14} aria-hidden="true" /> New Template
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onNewFolder() }}
          >
            <FolderPlus size={14} aria-hidden="true" /> New Folder
          </button>
        </div>
      )}
    </div>
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
      className="flex items-center rounded-md border border-[var(--color-border)] p-0.5 gap-0.5"
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

function FolderCard({ folder, items, viewMode, defaultOpen, onNew, onRename, onDelete, renderRow, renderTile, onDrop }) {
  const [open, setOpen] = useState(defaultOpen)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)

  function handleDragEnter() { dragCounter.current++; setDragOver(true) }
  function handleDragLeave() { dragCounter.current--; if (dragCounter.current === 0) setDragOver(false) }
  function handleDrop() { dragCounter.current = 0; setDragOver(false); onDrop(folder.id) }

  return (
    <div
      className={`card domain-accent ${CARD_SHADOW}${dragOver ? ' ring-2 ring-[var(--cpt-color)] ring-inset' : ''}`}
      style={{ '--domain-color': 'var(--color-domain-assignments)' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-t-md ${open ? 'border-b border-[var(--color-border)]' : 'rounded-b-md'}`}
        style={{ backgroundColor: 'rgba(var(--cpt-color-rgb), 0.10)' }}
      >
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <Folder size={16} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-[var(--color-text-body)]">
            {folder.name}
          </span>
          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">({items.length})</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onNew(folder.id)}>
            <Plus size={14} aria-hidden="true" /> New
          </Button>
          <FolderMenu
            folderName={folder.name}
            onRename={() => onRename(folder)}
            onDelete={() => onDelete(folder)}
          />
        </div>
      </div>

      {open && (
        items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--color-text-muted)]">No templates in this folder.</p>
        ) : viewMode === 'tile' ? (
          <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            {items.map(renderTile)}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {items.map(renderRow)}
          </div>
        )
      )}
    </div>
  )
}

function SectionCard({ label, count, items, viewMode, defaultOpen, renderRow, renderTile, onDrop }) {
  const [open, setOpen] = useState(defaultOpen)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)

  function handleDragEnter() { dragCounter.current++; setDragOver(true) }
  function handleDragLeave() { dragCounter.current--; if (dragCounter.current === 0) setDragOver(false) }
  function handleDrop() { dragCounter.current = 0; setDragOver(false); onDrop(null) }

  return (
    <div
      className={`card domain-accent ${CARD_SHADOW}${dragOver ? ' ring-2 ring-[var(--cpt-color)] ring-inset' : ''}`}
      style={{ '--domain-color': 'var(--color-domain-assignments)' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`w-full flex items-center gap-2 px-4 py-3 rounded-t-md text-left ${open ? 'border-b border-[var(--color-border)]' : 'rounded-b-md'}`}
        style={{ backgroundColor: 'rgba(var(--cpt-color-rgb), 0.10)' }}
      >
        <span className="text-sm font-semibold text-[var(--color-text-body)]">{label}</span>
        <span className="text-xs text-[var(--color-text-muted)]">({count})</span>
      </button>

      {open && (
        viewMode === 'tile' ? (
          <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            {items.map(renderTile)}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {items.map(renderRow)}
          </div>
        )
      )}
    </div>
  )
}

function FolderMenu({ folderName, onRename, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handle(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <IconButton
        icon={MoreHorizontal}
        label={`Options for ${folderName}`}
        size="sm"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      />
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md shadow-md py-1 min-w-[9rem]">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onRename() }}
          >
            <Pencil size={13} aria-hidden="true" /> Rename
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onDelete() }}
          >
            <Trash2 size={13} aria-hidden="true" /> Delete Folder
          </button>
        </div>
      )}
    </div>
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
  const [hovered, setHovered] = useState(false)
  const isPage = template.type === 'page'
  const Icon = isPage ? FileText : ClipboardList

  return (
    <div
      draggable="true"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="relative rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-sm flex flex-col cursor-grab"
      style={{ aspectRatio: '3 / 4' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Drag to move to a different folder"
    >
      {/* Type accent strip */}
      <div
        className="rounded-t-md shrink-0"
        style={{
          height: '4px',
          backgroundColor: isPage ? 'var(--color-text-muted)' : 'var(--cpt-color)',
        }}
      />

      {/* Content preview or icon fallback */}
      <DescriptionPreview html={template.fields?.description} Icon={Icon} />

      {/* Hover overlay — visual affordance for mouse users; decorative duplicate of footer Use */}
      {hovered && (
        <div
          className="absolute inset-0 rounded-md bg-black/40 flex items-center justify-center"
          aria-hidden="true"
        >
          <button
            type="button"
            onClick={onUse}
            tabIndex={-1}
            className="btn-primary text-xs px-3 py-1.5 rounded-lg"
            aria-hidden="true"
          >
            Use
          </button>
        </div>
      )}

      {/* Footer — always visible; z-10 + opaque bg paint over the overlay in this region */}
      <div className="relative z-10 px-2 pt-1.5 pb-2 border-t border-[var(--color-border)] shrink-0 bg-[var(--color-bg-surface)]">
        <p className="truncate text-xs font-medium text-[var(--color-text-body)] leading-tight mb-1">
          {template.name}
        </p>
        <div className="flex items-center gap-1">
          <span className="flex-1 truncate text-xs text-[var(--color-text-muted)] leading-tight">
            {template.fields?.points != null ? `${template.fields.points} pts` : ''}
          </span>
          <Button variant="primary" size="sm" onClick={onUse}>Use</Button>
          <TileMenu
            templateName={template.name}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
          />
        </div>
      </div>
    </div>
  )
}

function TileMenu({ templateName, onEdit, onDelete, onMove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handle(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <IconButton
        icon={MoreHorizontal}
        label={`More actions for ${templateName}`}
        size="sm"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      />
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md shadow-md py-1 min-w-[7rem]">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onEdit() }}
          >
            <Pencil size={13} aria-hidden="true" /> Edit
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onMove() }}
          >
            <Folder size={13} aria-hidden="true" /> Move To
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onDelete() }}
          >
            <Trash2 size={13} aria-hidden="true" /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

function OverflowMenu({ onEdit, onDelete, onMove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onOutsideClick(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutsideClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutsideClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <IconButton
        icon={MoreHorizontal}
        label="More actions"
        size="sm"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      />
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md shadow-md py-1 min-w-[7rem]">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onEdit() }}
          >
            <Pencil size={13} aria-hidden="true" /> Edit
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onMove() }}
          >
            <Folder size={13} aria-hidden="true" /> Move To
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
            onClick={() => { setOpen(false); onDelete() }}
          >
            <Trash2 size={13} aria-hidden="true" /> Delete
          </button>
        </div>
      )}
    </div>
  )
}
