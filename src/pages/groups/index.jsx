import React from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton } from '../../components/AppNav.jsx'
import AssignmentGroupManager from '../../features/groups/AssignmentGroupManager.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyTheme } from '../../utils/color.js'
import '../../styles/global.css'

function App() {
  const initialCourseId = new URLSearchParams(window.location.search).get('courseId') ?? null
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--cpt-color)' }}>
              <span className="text-white text-xs font-black">C</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 hidden sm:block">Canvas Power Tools</span>
          </div>
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

getPreferences().then(p => applyTheme(p.buttonColor))
createRoot(document.getElementById('root')).render(<App />)
