import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import AssignmentGroupManager from '../../modules/assignments/AssignmentGroupManager.jsx'
import { getPreferences, setLastUsedCourse, resolveInitialCourseId } from '../../storage/preferences.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../../utils/color.js'
import { getCourses } from '../../api/courses.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'
import SetupGuard from '../../components/SetupGuard.jsx'

function App() {
  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(
    new URLSearchParams(window.location.search).get('courseId') ?? null
  )

  useEffect(() => {
    Promise.all([getCourses(), getPreferences()])
      .then(([list, prefs]) => {
        setCourses(list)
        setCourseId(resolveInitialCourseId(list, { override: courseId, prefs }))
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  function handleCourseChange(id) {
    setCourseId(id)
    setLastUsedCourse(id)
  }

  return (
    <ToolShell
      start={<><BrandLogo /><CourseSelector courses={courses} selectedId={courseId} onChange={handleCourseChange} loading={loadingCourses} /></>}
      end={<><AppNav current="groups" /><SettingsButton /></>}
    >
      <div className="overflow-y-auto flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <AssignmentGroupManager courseId={courseId} courses={courses} />
        </div>
      </div>
    </ToolShell>
  )
}

getPreferences().then(p => { applyPalette(p.palette); applyDarkMode(p.themeMode ?? 'system'); applyTextSize(p.textSize ?? 'medium') })
createRoot(document.getElementById('root')).render(<SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>)
