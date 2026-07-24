import React from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import CopyFlow from '../../modules/assignments/CopyFlow.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../../utils/color.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'
import SetupGuard from '../../components/SetupGuard.jsx'

function App() {
  const initialCourseId = new URLSearchParams(window.location.search).get('courseId') ?? null

  return (
    <ToolShell
      start={<BrandLogo />}
      end={<><AppNav current="duplicate" /><SettingsButton /></>}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 flex-1 flex flex-col min-h-0 w-full">
        <CopyFlow initialCourseId={initialCourseId} />
      </div>
    </ToolShell>
  )
}

getPreferences().then(p => { applyPalette(p.palette); applyDarkMode(p.themeMode ?? 'system'); applyTextSize(p.textSize ?? 'medium') })
createRoot(document.getElementById('root')).render(<SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>)



