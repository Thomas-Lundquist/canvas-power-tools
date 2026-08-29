import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import IconButton from './IconButton.jsx'

/**
 * SlideOver — a right-anchored drawer with a scrim, for secondary workflows
 * (e.g. automation rules) that should not take over the whole page. Tier-1
 * brick. Renders inline (no portal) so it inherits the caller's theme tokens,
 * including any scoped `--cpt-color` override.
 *
 * @param {string} title  Accessible name + visible header.
 * @param {() => void} onClose  Called on scrim click, close button, or Escape.
 * @param {string} [width]  Max panel width (default 28rem).
 * @param {React.ReactNode} children  Panel body.
 */
export default function SlideOver({ title, onClose, width = '28rem', children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex h-full w-full flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)] outline-none"
        style={{ maxWidth: width, animation: 'slide-over-in 0.2s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-text-body)]">{title}</h2>
          <IconButton icon={X} label="Close panel" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
