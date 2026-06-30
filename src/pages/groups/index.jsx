import React from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import AssignmentGroupManager from '../../modules/assignments/AssignmentGroupManager.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyTheme, applyDarkMode, applyTextSize } from '../../utils/color.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'
import SetupGuard from '../../components/SetupGuard.jsx'

function App() {
  const initialCourseId = new URLSearchParams(window.location.search).get('courseId') ?? null
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex items-center gap-1">
            <AppNav current="groups" />
            <SettingsButton />
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <AssignmentGroupManager initialCourseId={initialCourseId} />
      </div>
    </div>
  )
}

getPreferences().then(p => { applyTheme(p.buttonColor); applyDarkMode(p.themeMode ?? 'system'); applyTextSize(p.textSize ?? 'medium') })
createRoot(document.getElementById('root')).render(<SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>)



