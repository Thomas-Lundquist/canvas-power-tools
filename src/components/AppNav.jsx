import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Settings } from 'lucide-react'
import { TOOLS } from '../config/tools.jsx'

function navigate(path) {
  if (window.location.href.includes(path)) return
  window.location.href = chrome.runtime.getURL(path)
}

export default function AppNav({ current }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const currentTool = TOOLS.find(t => t.id === current)
  const TriggerIcon = currentTool?.Icon ?? TOOLS[0].Icon

  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="cpt-nav-trigger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      >
        <TriggerIcon size={14} />
        {currentTool?.shortLabel ?? 'Tools'}
        <ChevronDown size={12} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="cpt-nav-dropdown absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
          {TOOLS.map(tool => {
            const active = tool.id === current
            return (
              <button
                key={tool.id}
                onClick={() => { navigate(tool.path); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
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
    >
      <Settings size={16} />
    </button>
  )
}

export function BrandLogo() {
  return (
    <button
      onClick={() => navigate('src/shell/index.html')}
      className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
           style={{ backgroundColor: 'var(--cpt-color)' }}>
        <span className="text-white text-xs font-black">C</span>
      </div>
      <span className="text-sm font-semibold text-gray-900 hidden sm:block">Canvas Power Tools</span>
    </button>
  )
}
