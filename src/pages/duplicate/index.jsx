import React from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import CopyFlow from '../../modules/assignments/CopyFlow.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyTheme, applyDarkMode } from '../../utils/color.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'

function App() {
  const initialCourseId = new URLSearchParams(window.location.search).get('courseId') ?? null

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex items-center gap-1">
            <AppNav current="duplicate" />
            <SettingsButton />
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <CopyFlow initialCourseId={initialCourseId} />
      </div>
    </div>
  )
}

getPreferences().then(p => { applyTheme(p.buttonColor); applyDarkMode(p.themeMode ?? 'system') })
createRoot(document.getElementById('root')).render(<ToastProvider><App /></ToastProvider>)



