/**
 * ListRow — one line in a browse list: lead · title / meta · trailing actions.
 *
 * Tier 2 composition. Promotes the Templates `TemplateRow` into a reusable
 * browse brick (explicitly *not* AssignmentTable — that stays a separate
 * virtualized component, ledger Decision 2). Reused later by Change Log and
 * Sent Log. Consumes the shared atoms: `lead` is typically a <Badge>,
 * `overflow` a ghost <IconButton>, `primaryAction` a secondary <Button>.
 *
 * Truncate, never wrap: the title/meta column is `min-w-0` with `truncate`, so
 * a long template or folder name is clipped with an ellipsis instead of
 * pushing the actions off the row or growing its height.
 *
 * Optional activation without nesting buttons: when `onActivate` is given the
 * *title* becomes a <button> (a distinct, labeled keyboard target), while
 * `primaryAction` / `overflow` stay separate sibling buttons. The row itself
 * is never a button wrapping other buttons.
 *
 * @param {React.ReactNode} [lead]   Leading element, e.g. a type <Badge>.
 * @param {React.ReactNode} title    The row's primary label (truncates).
 * @param {React.ReactNode} [meta]   Secondary line under the title (muted).
 * @param {React.ReactNode} [primaryAction]  Always-visible action (btn-secondary).
 * @param {React.ReactNode} [overflow]       Low-weight action (ghost IconButton).
 * @param {() => void} [onActivate]  If set, the title activates it (row select/open).
 * @param {boolean} [active=false]   Selected/current row — brand-wash background.
 * @param {boolean} [disabled=false] Dims the row and disables title activation.
 * @param {object} [rest]  Passed to the wrapper (data-*, aria-*, etc.).
 */
export default function ListRow({
  lead,
  title,
  meta,
  primaryAction,
  overflow,
  onActivate,
  active = false,
  disabled = false,
  ...rest
}) {
  const base =
    'flex items-center justify-between gap-4 px-[var(--space-4,1rem)] py-3 transition-colors duration-75'
  const stateClass = disabled
    ? 'opacity-50'
    : active
      ? ''
      : 'hover:bg-[var(--color-bg-hover)]'

  return (
    <div
      className={`${base} ${stateClass}`}
      // Selected/active wash. Reconciles the spec's --primary-50 to the
      // codebase's established brand-tint convention (cf. .filter-active).
      style={active ? { backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)' } : undefined}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      <div className="flex min-w-0 items-center gap-3">
        {lead && <span className="shrink-0">{lead}</span>}

        <div className="min-w-0">
          {onActivate ? (
            <button
              type="button"
              onClick={onActivate}
              disabled={disabled}
              className="block max-w-full truncate text-left text-sm font-medium text-[var(--color-text-body)] hover:underline disabled:no-underline"
            >
              {title}
            </button>
          ) : (
            <p className="truncate text-sm font-medium text-[var(--color-text-body)]">
              {title}
            </p>
          )}

          {meta && (
            <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
              {meta}
            </div>
          )}
        </div>
      </div>

      {(primaryAction || overflow) && (
        <div className="flex shrink-0 items-center gap-2">
          {primaryAction}
          {overflow}
        </div>
      )}
    </div>
  )
}
