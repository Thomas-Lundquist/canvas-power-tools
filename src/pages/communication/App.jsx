import React, { useState } from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import NudgeTool from '../../modules/communication/NudgeTool.jsx'
import ThresholdMessenger from '../../modules/communication/ThresholdMessenger.jsx'
import Announcements from '../../modules/communication/Announcements.jsx'

const TABS = [
  { id: 'nudge',         label: 'Nudge Tool' },
  { id: 'threshold',     label: 'Threshold Messenger' },
  { id: 'announcements', label: 'Announcements' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('nudge')
  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <SkipLink />
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex items-center gap-1">
            <AppNav current="communication" />
            <SettingsButton />
          </div>
        </div>
      </div>

      <div id="main-content" className="max-w-4xl mx-auto px-6 pt-6">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden w-fit mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
              style={activeTab === tab.id ? { backgroundColor: 'var(--cpt-color)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'nudge'         && <NudgeTool />}
        {activeTab === 'threshold'     && <ThresholdMessenger />}
        {activeTab === 'announcements' && <Announcements />}
      </div>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </div>
  )
}
