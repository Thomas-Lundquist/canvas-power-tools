import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { LayoutGrid, List, ChevronRight } from 'lucide-react'
import { SettingsButton } from '../components/AppNav.jsx'
import { TOOLS } from '../config/tools.jsx'
import { getPreferences, setPreference } from '../storage/preferences.js'
import { applyTheme, applyDarkMode } from '../utils/color.js'
import '../styles/global.css'
import { ToastProvider } from '../components/Toast.jsx'

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                 style={{ backgroundColor: 'var(--cpt-color)' }}>
              <span className="text-white text-xs font-black">C</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 hidden sm:block">Canvas Power Tools</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMode}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title={displayMode === 'tiles' ? 'Switch to list view' : 'Switch to tile view'}
            >
              {displayMode === 'tiles' ? <List size={16} /> : <LayoutGrid size={16} />}
            </button>
            <SettingsButton />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Tools</h1>
          <p className="text-sm text-gray-500 mt-1">Select a tool to get started.</p>
        </div>

        {displayMode === 'tiles' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => navigateTo(tool.path)}
                className="card p-6 text-left hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                     style={{ backgroundColor: 'rgba(var(--cpt-color-rgb), 0.1)' }}>
                  <tool.Icon size={20} style={{ color: 'var(--cpt-color)' }} />
                </div>
                <h2 className="text-sm font-semibold text-gray-900 mb-1">{tool.label}</h2>
                <p className="text-xs text-gray-500 leading-relaxed">{tool.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {TOOLS.map((tool, i) => (
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
      </div>
    </div>
  )
}

getPreferences().then(p => { applyTheme(p.buttonColor); applyDarkMode(p.themeMode ?? 'system') })
createRoot(document.getElementById('root')).render(<ToastProvider><App /></ToastProvider>)

