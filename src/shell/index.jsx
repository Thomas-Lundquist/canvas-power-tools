import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { LayoutGrid, List, ChevronRight } from 'lucide-react'
import { SettingsButton, BrandMark } from '../components/AppNav.jsx'
import { TOOLS, MODULES } from '../config/tools.jsx'
import { getPreferences, setPreference } from '../storage/preferences.js'
import { applyTheme, applyDarkMode, applyTextSize } from '../utils/color.js'
import '../styles/global.css'
import { ToastProvider } from '../components/Toast.jsx'
import SetupGuard from '../components/SetupGuard.jsx'
import SkipLink from '../components/SkipLink.jsx'
import { useKeyboardShortcuts } from '../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../components/ShortcutsPanel.jsx'

function App() {
  const [displayMode, setDisplayMode] = useState('tiles')

  useEffect(() => {
    getPreferences().then(p => {
      applyTheme(p.buttonColor)
      applyDarkMode(p.themeMode ?? 'system')
      setDisplayMode(p.homepageDisplayMode ?? 'tiles')
    })
  }, [])

  function navigateTo(path) {
    window.location.href = chrome.runtime.getURL(path)
  }

  function toggleMode() {
    const next = displayMode === 'tiles' ? 'list' : 'tiles'
    setDisplayMode(next)
    setPreference('homepageDisplayMode', next)
  }

  // Group tools by module, preserving MODULES order
  const grouped = MODULES.map(mod => ({
    ...mod,
    tools: TOOLS.filter(t => t.module === mod.id),
  })).filter(g => g.tools.length > 0)

  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  return (
    <div className="min-h-screen bg-gray-50">
      <SkipLink />
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMode}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title={displayMode === 'tiles' ? 'Switch to list view' : 'Switch to tile view'}
              aria-label={displayMode === 'tiles' ? 'Switch to list view' : 'Switch to tile view'}
            >
              {displayMode === 'tiles' ? <List size={16} /> : <LayoutGrid size={16} />}
            </button>
            <SettingsButton />
          </div>
        </div>
      </div>

      {/* Content */}
      <div id="main-content" className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {grouped.map(group => (
          <section key={group.id} aria-label={group.label}>
            <h2 className="section-title mb-4">{group.label}</h2>

            {displayMode === 'tiles' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.tools.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => navigateTo(tool.path)}
                    className="card p-6 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                         style={{ backgroundColor: 'rgba(var(--cpt-color-rgb), 0.1)' }}>
                      <tool.Icon size={20} style={{ color: 'var(--cpt-color)' }} />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{tool.label}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{tool.description}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="card overflow-hidden">
                {group.tools.map((tool, i) => (
                  <button
                    key={tool.id}
                    onClick={() => navigateTo(tool.path)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors ${i > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                         style={{ backgroundColor: 'rgba(var(--cpt-color-rgb), 0.1)' }}>
                      <tool.Icon size={18} style={{ color: 'var(--cpt-color)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{tool.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{tool.description}</div>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </div>
  )
}

getPreferences().then(p => { applyTheme(p.buttonColor); applyDarkMode(p.themeMode ?? 'system'); applyTextSize(p.textSize ?? 'medium') })
createRoot(document.getElementById('root')).render(<SetupGuard><ToastProvider><App /></ToastProvider></SetupGuard>)
