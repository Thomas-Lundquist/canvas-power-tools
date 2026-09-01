import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { GROUP_COLOR_TOKENS, cssVar } from '../utils/groupColors.js'

/**
 * GroupColorSwatch — the little filled square shown next to an assignment
 * group's name. Doubles as the picker: clicking it opens a small portaled
 * popover of the 8 categorical colors; picking one calls `onPick(token)`.
 *
 * Display-only preference (never a Canvas write) — no PIN gate.
 *
 * @param {string} token      current '--color-cat-N'
 * @param {string} groupName  for the accessible name
 * @param {(token: string) => void} onPick
 */
export default function GroupColorSwatch({ token, groupName, onPick }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    function onDown(e) {
      if (triggerRef.current?.contains(e.target)) return
      if (e.target.closest?.('[data-group-color-pop]')) return
      close()
    }
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Color for ${groupName}`}
        className="h-3.5 w-3.5 shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] transition-transform hover:scale-110"
        style={{ backgroundColor: token ? cssVar(token) : 'var(--color-text-disabled)' }}
      />
      {open && pos && createPortal(
        <div
          data-group-color-pop
          role="menu"
          aria-label={`Choose a color for ${groupName}`}
          className="fixed z-[1000] grid grid-cols-4 gap-1.5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-2 shadow-[var(--shadow-lg)]"
          style={{ top: pos.top, left: pos.left }}
        >
          {GROUP_COLOR_TOKENS.map(t => {
            const selected = t === token
            return (
              <button
                key={t}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                aria-label={t.replace('--color-cat-', 'Color ')}
                onClick={() => { onPick(t); setOpen(false) }}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)]"
                style={{ backgroundColor: cssVar(t) }}
              >
                {selected && <Check size={14} strokeWidth={3} className="text-white drop-shadow-[0_0_1px_rgba(0,0,0,0.6)]" aria-hidden="true" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
