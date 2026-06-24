import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Settings, AlertCircle } from 'lucide-react'
import { TOOLS } from '../config/tools.jsx'
import { isSetupComplete, getAccount } from '../storage/account.js'
import { getPreferences } from '../storage/preferences.js'
import { applyTheme } from '../utils/color.js'
import '../styles/global.css'

function open(path) {
  chrome.runtime.sendMessage({ type: 'OPEN_PAGE', path })
}

function Popup() {
  const [ready, setReady]     = useState(null)
  const [account, setAccount] = useState(null)
  const [prefs, setPrefs]     = useState(null)

  useEffect(() => {
    async function load() {
      const [complete, acc, p] = await Promise.all([isSetupComplete(), getAccount(), getPreferences()])
      applyTheme(p.buttonColor)
      setReady(complete)
      setAccount(acc)
      setPrefs(p)
    }
    load()
  }, [])

  if (ready === null) return <div className="p-4 text-sm text-gray-400">Loading...</div>

  if (!ready) {
    return (
      <div className="p-4 space-y-3">
        <Header />
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          Setup required. Connect your Canvas account to get started.
        </div>
        <button
          className="btn-primary w-full justify-center text-sm"
          onClick={() => open('src/pages/onboarding/index.html')}
        >
          Complete Setup
        </button>
      </div>
    )
  }

  // null means show all; array means only show those ids
  const pinnedIds   = prefs?.popupPinnedTools
  const visibleTools = pinnedIds == null
    ? TOOLS
    : TOOLS.filter(t => pinnedIds.includes(t.id))

  return (
    <div className="p-4 space-y-3">
      <Header />
      {account?.userName && (
        <p className="text-xs text-gray-500 truncate">{account.userName}</p>
      )}
      <div className="space-y-1">
        {visibleTools.map(tool => (
          <NavItem
            key={tool.id}
            icon={<tool.Icon size={16} />}
            label={tool.label}
            onClick={() => open(tool.path)}
          />
        ))}
      </div>
      <div className="border-t border-gray-100 pt-2">
        <NavItem
          icon={<Settings size={16} />}
          label="Settings"
          onClick={() => open('src/pages/settings/index.html')}
          subtle
        />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--cpt-color)' }}>
        <span className="text-white text-xs font-black">C</span>
      </div>
      <span className="text-sm font-bold text-gray-900">Canvas Power Tools</span>
    </div>
  )
}

function NavItem({ icon, label, onClick, subtle }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors
        ${subtle ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-700' : 'text-gray-800 hover:bg-gray-100 font-medium'}`}
    >
      <span style={subtle ? undefined : { color: 'var(--cpt-color)' }}
            className={subtle ? 'text-gray-400' : ''}>
        {icon}
      </span>
      {label}
    </button>
  )
}

createRoot(document.getElementById('root')).render(<Popup />)
