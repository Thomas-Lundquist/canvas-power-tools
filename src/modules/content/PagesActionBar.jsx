import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Eye, EyeOff, X, Trash2, PencilLine, CalendarOff } from 'lucide-react'
import IconButton from '../../components/IconButton.jsx'
import Button from '../../components/Button.jsx'
import { EDITING_ROLE_PRESETS, INITIAL_ACTIONS, countActiveFields } from './pagesHelpers.js'

export { INITIAL_ACTIONS }

export default function PagesActionBar({
  selectedCount, actions, onActionsChange, onPreview, onClearAll, onDelete,
}) {
  const [collapsed, setCollapsed] = useState(false)

  const fieldCount = countActiveFields(actions)
  const totalChanges = fieldCount * selectedCount

  useEffect(() => {
    if (fieldCount > 0 && collapsed) setCollapsed(false)
  }, [fieldCount])

  function handleStatusToggle(intent) {
    onActionsChange({ ...actions, status: actions.status === intent ? null : intent })
  }

  // Absolute inside the table column, not fixed to the viewport: the column is
  // already the space left of the preview pane, so the bar centres itself there
  // without being told the pane's width. The wrapper stretches the full column
  // and is invisible, so it must not swallow clicks in the gutters either side
  // of the card — only the card itself takes them.
  //
  // Stowed, the bar is only translated off-screen, so without inert its controls
  // stay tabbable inside an aria-hidden subtree — invalid ARIA, and focus would
  // land somewhere invisible that the column's overflow-hidden has clipped.
  // React 18 needs the string form: undefined removes the attribute, whereas
  // inert={false} would still render it and keep the subtree inert.
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      aria-hidden={selectedCount === 0 ? 'true' : undefined}
      inert={selectedCount === 0 ? '' : undefined}
      className={`absolute bottom-0 left-0 right-0 z-20 px-4 pointer-events-none transition-transform duration-300 ease-out ${
        selectedCount === 0 ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className={`mx-auto w-full max-w-[61.5rem] bg-[var(--color-bg-surface)] border border-b-0 border-[var(--color-border)] rounded-t-[var(--radius-card)] shadow-[var(--shadow-lg)] ${
        selectedCount === 0 ? '' : 'pointer-events-auto'
      }`}>

        {/* Header strip */}
        <div
          className={`flex items-center justify-between px-4 h-11 bg-[var(--color-bg-hover)] rounded-t-[var(--radius-card)] border-b-2 border-[var(--cpt-color)] ${collapsed ? 'cursor-pointer' : ''}`}
          onClick={() => { if (collapsed) setCollapsed(false) }}
        >
          <span className="text-sm font-medium text-[var(--color-text-body)]">
            {selectedCount} selected
            {fieldCount > 0 && (
              <>
                <span className="text-[var(--color-text-secondary)] font-normal"> · </span>
                <span
                  className="text-[var(--color-text-secondary)] font-normal"
                  title={`${fieldCount} field${fieldCount !== 1 ? 's' : ''} × ${selectedCount} page${selectedCount !== 1 ? 's' : ''}`}
                >
                  up to {totalChanges} field change{totalChanges !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </span>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {/* Row-acting controls are hidden while collapsed — the collapsed
                bar is just a summary + re-expand affordance. */}
            {!collapsed && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[color-mix(in_srgb,var(--color-error)_14%,var(--color-bg-surface))] hover:text-[var(--color-error)] transition-colors duration-75"
                aria-label={`Delete ${selectedCount} selected page${selectedCount !== 1 ? 's' : ''} from Canvas`}
              >
                <Trash2 size={12} aria-hidden="true" />
                Delete
              </button>
            )}
            <IconButton
              icon={collapsed ? ChevronUp : ChevronDown}
              label={collapsed ? 'Expand action bar' : 'Collapse action bar'}
              size="sm"
              onClick={() => setCollapsed(c => !c)}
            />
            <IconButton
              icon={X}
              label="Clear selection and close"
              size="sm"
              onClick={onClearAll}
            />
          </div>
        </div>

        <div className={`overflow-hidden transition-[height,opacity] duration-300 ease-out ${
          collapsed ? 'h-0 opacity-0' : 'h-[13rem] opacity-100'
        }`}>
          <div className="flex h-full">

            {/* Status + editing roles column */}
            <div className="flex-1 p-4 flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <Eye size={12} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
                  <span className="section-label !mb-0">Status</span>
                </div>
                <div className="flex items-center gap-2 mt-2 max-w-xs">
                  <StatusButton
                    icon={Eye}
                    label="Publish"
                    active={actions.status === 'publish'}
                    onClick={() => handleStatusToggle('publish')}
                  />
                  <StatusButton
                    icon={EyeOff}
                    label="Unpublish"
                    active={actions.status === 'unpublish'}
                    onClick={() => handleStatusToggle('unpublish')}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <PencilLine size={12} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
                  <label htmlFor="pages-editing-roles" className="section-label !mb-0">Who Can Edit</label>
                </div>
                <select
                  id="pages-editing-roles"
                  value={actions.editingRoles}
                  onChange={e => onActionsChange({ ...actions, editingRoles: e.target.value })}
                  className="input mt-2 w-full max-w-xs text-sm"
                >
                  <option value="">No change</option>
                  {EDITING_ROLE_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-px bg-[var(--color-border)] shrink-0" />

            {/* Explanation + preview column */}
            <div className="w-72 shrink-0 p-4 flex flex-col">
              {/* Teachers look for dates here because the Bulk Editor has them.
                  Canvas gives pages no availability window at all, so saying
                  nothing would read as a missing feature (doc 21, Decision 1). */}
              <div className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
                <CalendarOff size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <p>
                  Pages have no availability dates in Canvas. To release pages on a
                  schedule, put them in a Module and set the module&apos;s unlock date.
                </p>
              </div>

              <div className="mt-auto pt-3 border-t border-[var(--color-border-subtle)]">
                <Button
                  variant="primary"
                  onClick={onPreview}
                  disabled={fieldCount === 0}
                  style={{ width: '100%' }}
                >
                  Preview Changes →
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

function StatusButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-[var(--radius-control)] text-xs font-medium transition-colors
        ${active
          ? 'bg-[rgba(var(--cpt-color-rgb),0.1)] text-[var(--cpt-color)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-body)]'
        }`}
    >
      <Icon size={18} aria-hidden="true" />
      {label}
    </button>
  )
}
