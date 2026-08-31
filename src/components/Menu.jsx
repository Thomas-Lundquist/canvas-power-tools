/**
 * Menu — a reusable dropdown popover: a trigger plus a flat list of actions.
 *
 * Tier 2 composition. Collapses the four near-identical dropdowns that each
 * browse tool used to hand-roll (New, folder options, tile/row overflow) into
 * one brick. Owns the open state, outside-click + Escape dismissal, and the
 * themed popover shell (tokened radius/shadow, so it flattens under Bauhaus).
 *
 * The popover is rendered via a portal into document.body as `position:
 * fixed`, positioned from the trigger's live bounding rect. This is
 * deliberate, not decorative: a plain `position: absolute` popover is
 * clipped by any ancestor with `overflow: hidden` (e.g. a rounded card that
 * clips its header background) and can't escape a low ancestor stacking
 * context. Portaling sidesteps both.
 *
 * The trigger is a render prop so callers keep their own button atom (Button,
 * IconButton) — Menu just hands it the wiring:
 *
 *   <Menu label="Options" trigger={p => <IconButton {...p} icon={MoreHorizontal} />}>
 *     <Menu.Item icon={Pencil} onSelect={onEdit}>Edit</Menu.Item>
 *     <Menu.Item icon={Trash2} danger onSelect={onDelete}>Delete</Menu.Item>
 *   </Menu>
 *
 * @param {(triggerProps) => React.ReactNode} trigger  Renders the trigger; is
 *        given { onClick, 'aria-haspopup', 'aria-expanded' } to spread.
 * @param {'right'|'left'} [align='right']  Which edge the popover aligns to.
 * @param {string} [width='10rem']  Minimum popover width.
 * @param {number} [z=1000]  z-index of the popover (portaled, so this only
 *        needs to beat other portaled overlays, not in-page content).
 * @param {React.ReactNode} children  A list of <Menu.Item>.
 *
 * Menu.Item accepts an optional `disabled` prop — renders inert and dimmed,
 * does not fire `onSelect` or close the menu.
 *
 * Menu.Submenu — a flyout nested one level inside a Menu, for grouping a
 * handful of related actions under one label instead of widening the flat
 * list:
 *
 *   <Menu.Submenu icon={Settings} label="Manage">
 *     <Menu.Item onSelect={onMove}>Move assignments</Menu.Item>
 *     <Menu.Item onSelect={onDelete} danger>Delete assignments</Menu.Item>
 *   </Menu.Submenu>
 *
 * Selecting an item inside a Submenu closes the whole Menu tree, same as a
 * top-level Menu.Item. Like the top-level popover, the flyout is portaled
 * and self-positioned from its trigger row's bounding rect.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'

const MenuCloseContext = createContext(() => {})

// Shared by Menu and Menu.Submenu: tracks a trigger's live position while
// open, and wires outside-click / Escape / scroll dismissal. Scroll closes
// rather than re-tracks — cheaper and avoids a stale-looking popover
// trailing the trigger during a scroll gesture.
//
// Outside-click detection uses `closest('[data-menu-popover]')` rather than
// `ref.contains()`. Each popover (Menu's own, and any Menu.Submenu flyout
// nested inside it) is its OWN portal at document.body — a Submenu's flyout
// is a DOM *sibling* of its parent Menu's popover, not a descendant of it.
// A plain containment check on the parent's own ref would therefore treat a
// click inside the submenu flyout as "outside" and close the parent first
// (mousedown fires before click), unmounting the item before its onSelect
// ever runs. Checking for ANY open menu popover fixes that for the whole
// nested tree at once.
function usePopoverPlacement(open, onClose, place) {
  const triggerRef = useRef(null)
  const [style, setStyle] = useState(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setStyle(null)
      return
    }
    setStyle(place(triggerRef.current.getBoundingClientRect()))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    function onOutsideClick(e) {
      if (triggerRef.current?.contains(e.target)) return
      if (e.target.closest?.('[data-menu-popover]')) return
      onClose()
    }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    function onScroll() { onClose() }
    document.addEventListener('mousedown', onOutsideClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onOutsideClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return { triggerRef, style }
}

export default function Menu({ trigger, align = 'right', width = '10rem', z = 1000, children }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const { triggerRef, style } = usePopoverPlacement(open, close, rect => (
    align === 'right'
      ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      : { top: rect.bottom + 4, left: rect.left }
  ))

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        {trigger({
          onClick: () => setOpen(v => !v),
          'aria-haspopup': 'true',
          'aria-expanded': open,
        })}
      </span>
      {open && style && createPortal(
        <div
          data-menu-popover
          role="menu"
          className="fixed bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-md)] py-1"
          style={{ ...style, minWidth: width, zIndex: z }}
        >
          <MenuCloseContext.Provider value={close}>
            {children}
          </MenuCloseContext.Provider>
        </div>,
        document.body,
      )}
    </>
  )
}

/**
 * Menu.Item — one action in a Menu. Runs `onSelect` and closes the menu.
 *
 * @param {React.ComponentType} [icon]  Leading Lucide icon.
 * @param {() => void} onSelect  Action to run on activation.
 * @param {boolean} [danger=false]  Renders in the danger color.
 * @param {React.ReactNode} children  The item label.
 */
function MenuItem({ icon: Icon, onSelect, danger = false, disabled = false, children }) {
  const close = useContext(MenuCloseContext)
  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-75 ${
        disabled
          ? 'text-[var(--color-text-disabled)] cursor-not-allowed opacity-40'
          : `hover:bg-[var(--color-bg-hover)] ${danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-body)]'}`
      }`}
      onClick={() => { if (disabled) return; close(); onSelect() }}
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </button>
  )
}

Menu.Item = MenuItem

/**
 * Menu.Submenu — a labeled trigger row that flies out a nested list of
 * Menu.Item to the side. Shares the parent's close context, so picking a
 * nested item dismisses the entire menu, not just the flyout.
 *
 * @param {React.ComponentType} [icon]  Leading Lucide icon on the trigger row.
 * @param {string} label  The trigger row's label.
 * @param {React.ReactNode} children  A list of <Menu.Item>.
 */
function MenuSubmenu({ icon: Icon, label, children }) {
  const [open, setOpen] = useState(false)
  const closeAll = useContext(MenuCloseContext)
  const close = () => setOpen(false)

  const { triggerRef, style } = usePopoverPlacement(open, close, rect => ({
    top: rect.top,
    left: rect.right + 4,
  }))

  return (
    <div ref={triggerRef}>
      <button
        role="menuitem"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] transition-colors duration-75"
      >
        {Icon && <Icon size={13} aria-hidden="true" />}
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight size={13} aria-hidden="true" className="text-[var(--color-text-muted)]" />
      </button>
      {open && style && createPortal(
        <div
          data-menu-popover
          role="menu"
          className="fixed bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-md)] py-1"
          style={{ ...style, minWidth: '10rem', zIndex: 1001 }}
        >
          <MenuCloseContext.Provider value={closeAll}>
            {children}
          </MenuCloseContext.Provider>
        </div>,
        document.body,
      )}
    </div>
  )
}

Menu.Submenu = MenuSubmenu
