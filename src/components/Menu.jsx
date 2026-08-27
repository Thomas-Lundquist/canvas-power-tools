/**
 * Menu — a reusable dropdown popover: a trigger plus a flat list of actions.
 *
 * Tier 2 composition. Collapses the four near-identical dropdowns that each
 * browse tool used to hand-roll (New, folder options, tile/row overflow) into
 * one brick. Owns the open state, outside-click + Escape dismissal, and the
 * themed popover shell (tokened radius/shadow, so it flattens under Bauhaus).
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
 * @param {number} [z=20]  z-index of the popover (raise inside stacked cards).
 * @param {React.ReactNode} children  A list of <Menu.Item>.
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react'

const MenuCloseContext = createContext(() => {})

export default function Menu({ trigger, align = 'right', width = '10rem', z = 20, children }) {
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
      {trigger({
        onClick: () => setOpen(v => !v),
        'aria-haspopup': 'true',
        'aria-expanded': open,
      })}
      {open && (
        <div
          role="menu"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-md)] py-1`}
          style={{ minWidth: width, zIndex: z }}
        >
          <MenuCloseContext.Provider value={() => setOpen(false)}>
            {children}
          </MenuCloseContext.Provider>
        </div>
      )}
    </div>
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
function MenuItem({ icon: Icon, onSelect, danger = false, children }) {
  const close = useContext(MenuCloseContext)
  return (
    <button
      role="menuitem"
      type="button"
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-body)]'} hover:bg-[var(--color-bg-hover)] transition-colors duration-75`}
      onClick={() => { close(); onSelect() }}
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </button>
  )
}

Menu.Item = MenuItem
