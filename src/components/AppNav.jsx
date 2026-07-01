import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check, Settings } from 'lucide-react'
import { TOOLS, MODULES } from '../config/tools.jsx'

function navigate(path) {
  if (window.location.href.includes(path)) return
  window.location.href = chrome.runtime.getURL(path)
}

export default function AppNav({ current }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const wasOpen = useRef(false)

  const currentTool = TOOLS.find(t => t.id === current)
  const TriggerIcon = currentTool?.Icon ?? TOOLS[0].Icon

  const close = useCallback(() => setOpen(false), [])

  // Return focus to trigger when dropdown closes
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (!ref.current?.contains(e.target)) close()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  // Group tools by module for the dropdown
  const grouped = MODULES.map(mod => ({
    ...mod,
    tools: TOOLS.filter(t => t.module === mod.id),
  })).filter(g => g.tools.length > 0)

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className="cpt-nav-trigger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <TriggerIcon size={14} />
        {currentTool?.shortLabel ?? 'Tools'}
        <ChevronDown size={12} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="cpt-nav-dropdown absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 max-h-[70vh] overflow-y-auto"
          role="menu"
        >
          {grouped.map((group, gi) => (
            <div key={group.id} role="group" aria-label={group.label}>
              {/* Module header */}
              <p className={`px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 ${gi > 0 ? 'pt-3 border-t border-gray-100 mt-1' : 'pt-2'}`}>
                {group.label}
              </p>
              {group.tools.map(tool => {
                const active = tool.id === current
                return (
                  <button
                    key={tool.id}
                    onClick={() => { navigate(tool.path); setOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                    role="menuitem"
                  >
                    <tool.Icon
                      size={15}
                      style={active ? { color: 'var(--cpt-color)' } : undefined}
                      className={active ? '' : 'text-gray-400'}
                    />
                    <span
                      className={active ? 'font-semibold' : 'text-gray-700'}
                      style={active ? { color: 'var(--cpt-color)' } : undefined}
                    >
                      {tool.label}
                    </span>
                    {active && <Check size={13} className="ml-auto shrink-0" style={{ color: 'var(--cpt-color)' }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SettingsButton() {
  return (
    <button
      onClick={() => navigate('src/settings/index.html')}
      className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      title="Settings"
      aria-label="Settings"
    >
      <Settings size={16} />
    </button>
  )
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
           style={{ backgroundColor: 'var(--cpt-color)' }}>
        <span className="text-white text-xs font-black">C</span>
      </div>
      <span className="text-sm font-semibold text-gray-900 hidden sm:block">Canvas Power Tools</span>
    </div>
  )
}

export function BrandLogo() {
  return (
    <button
      onClick={() => navigate('src/shell/index.html')}
      className="hover:opacity-80 transition-opacity shrink-0"
      aria-label="Canvas Power Tools home"
    >
      <BrandMark />
    </button>
  )
}
