import React from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import AccommodationsTool from '../../modules/people/AccommodationsTool.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../../utils/color.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'
import SetupGuard from '../../components/SetupGuard.jsx'

function App() {
  const initialStudentId = new URLSearchParams(window.location.search).get('studentId') ?? null
  return (
    <ToolShell
      start={<BrandLogo />}
      end={<><AppNav current="accommodations" /><SettingsButton /></>}
    >
      <div className="overflow-y-auto flex-1">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <AccommodationsTool initialStudentId={initialStudentId} />
        </div>
      </div>
    </ToolShell>
  )
}

getPreferences().then(p => { applyPalette(p.palette); applyDarkMode(p.themeMode ?? 'system'); applyTextSize(p.textSize ?? 'medium') })
createRoot(document.getElementById('root')).render(
  <SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>
)
