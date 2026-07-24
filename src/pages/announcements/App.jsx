import React from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import Announcements from '../../modules/communication/Announcements.jsx'

export default function App() {
  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  return (
    <>
      <SkipLink />
      <ToolShell
        start={<BrandLogo />}
        end={<><AppNav current="announcements" /><SettingsButton /></>}
      >
        <div className="overflow-y-auto flex-1">
          <div className="max-w-4xl mx-auto px-6 pt-6">
            <Announcements />
          </div>
        </div>
      </ToolShell>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </>
  )
}
