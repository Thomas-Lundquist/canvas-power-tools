import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/**
 * ListGroup — a labeled, collapsible section header for a browse list.
 *
 * Tier 2 composition. Promotes the Templates `FolderSection` header into a
 * reusable browse brick; pairs with ListRow, which supplies its children.
 * Later reused by Change Log and Sent Log.
 *
 * Accessibility note — no nested interactive elements: the source made the
 * whole header row clickable and stopped propagation on the buttons inside it.
 * Here, only the chevron + label is the toggle <button> (Enter/Space toggle,
 * aria-expanded). The optional `action` (e.g. a "+ New" Button) is a *sibling*
 * of that button, never a descendant — so we never nest a button in a button.
 *
 * Uncontrolled by design: the ledger API is `defaultOpen`, so the group owns
 * its own open state. A screen that must drive expansion externally (e.g. an
 * "expand all") reconciles that at adoption time, not here.
 *
 * @param {string} label   The group's name — rendered in the section-label
 *                         treatment (micro, uppercase, muted).
 * @param {number} [count] Optional item count, shown as "(N)" beside the label.
 * @param {React.ReactNode} [action]  Optional trailing control (e.g. "+ New").
 * @param {boolean} [defaultOpen=true]  Whether the group starts expanded.
 * @param {React.ReactNode} children  The rows, shown only while open.
 * @param {object} [rest]  Passed to the wrapper (data-*, etc.).
 */
export default function ListGroup({
  label,
  count,
  action,
  defaultOpen = true,
  children,
  ...rest
}) {
  const [open, setOpen] = useState(defaultOpen)
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div {...rest}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 py-2 text-left text-[color:var(--color-text-muted)] hover:text-[var(--color-text-body)]"
        >
          <Chevron size={14} aria-hidden="true" className="shrink-0" />
          {/* section-label typography inline (the .section-label class carries
              a block/margin unsuited to this flex header). */}
          <span className="truncate text-xs font-medium uppercase tracking-[0.08em]">
            {label}
          </span>
          {count != null && (
            <span className="shrink-0 text-xs font-medium tabular-nums">
              ({count})
            </span>
          )}
        </button>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}
