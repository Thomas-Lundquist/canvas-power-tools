import React from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import ThresholdMessenger from '../../modules/communication/ThresholdMessenger.jsx'

export default function App() {
  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <SkipLink />
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex items-center gap-1">
            <AppNav current="grade-outreach" />
            <SettingsButton />
          </div>
        </div>
      </div>

      <div id="main-content" className="max-w-4xl mx-auto px-6 pt-6">
        <ThresholdMessenger />
      </div>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </div>
  )
}
