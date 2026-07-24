import React from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import ThresholdMessenger from '../../modules/communication/ThresholdMessenger.jsx'

export default function App() {
  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  return (
    <>
      <SkipLink />
      <ToolShell
        start={<BrandLogo />}
        end={<><AppNav current="grade-outreach" /><SettingsButton /></>}
      >
        <div className="overflow-y-auto flex-1">
          <div className="max-w-4xl mx-auto px-6 pt-6">
            <ThresholdMessenger />
          </div>
        </div>
      </ToolShell>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </>
  )
}
