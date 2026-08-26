import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import QuizAuthoring from '../../modules/content/QuizAuthoring.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../../utils/color.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'
import SetupGuard from '../../components/SetupGuard.jsx'

function App() {
  useEffect(() => {
    getPreferences().then(p => {
      applyPalette(p.palette)
      applyDarkMode(p.themeMode ?? 'system')
      applyTextSize(p.textSize ?? 'medium')
    })
  }, [])

  return (
    <ToolShell
      start={<BrandLogo />}
      end={<><AppNav current="quiz-authoring" /><SettingsButton /></>}
    >
      <div className="overflow-y-auto flex-1">
        <QuizAuthoring />
      </div>
    </ToolShell>
  )
}

createRoot(document.getElementById('root')).render(
  <SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>
)
