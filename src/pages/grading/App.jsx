import React, { useState, useEffect } from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import SegmentedToggle from '../../components/SegmentedToggle.jsx'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import { getCourses } from '../../api/courses.js'
import { getPreferences, setLastUsedCourse, resolveInitialCourseId } from '../../storage/preferences.js'
import GradingDashboard from '../../modules/grading/GradingDashboard.jsx'
import MissingWork from '../../modules/grading/MissingWork.jsx'
import GradeAdjustments from '../../modules/grading/GradeAdjustments.jsx'
import LatePolicyTool from '../../modules/grading/LatePolicyTool.jsx'

const TABS = [
  { value: 'overview',      label: 'Overview' },
  { value: 'missing-work',  label: 'Missing Work' },
  { value: 'adjustments',   label: 'Adjustments' },
  { value: 'late-policy',   label: 'Late Policy' },
]

export default function App({ initialCourseId }) {
  const [activeTab, setActiveTab]           = useState('overview')
  const { showPanel, setShowPanel }         = useKeyboardShortcuts([])

  const [courses, setCourses]               = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId]             = useState(null)

  useEffect(() => {
    Promise.all([getCourses(), getPreferences()])
      .then(([list, prefs]) => {
        setCourses(list)
        setCourseId(resolveInitialCourseId(list, { override: initialCourseId, prefs }))
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  function handleCourseChange(id) {
    setCourseId(id)
    setLastUsedCourse(id)
  }

  const course = courses.find(c => c.id === courseId) ?? null

  return (
    <>
      <SkipLink />
      <ToolShell
        start={<><BrandLogo /><CourseSelector courses={courses} selectedId={courseId} onChange={handleCourseChange} loading={loadingCourses} /></>}
        end={<><AppNav current="grading" /><SettingsButton /></>}
      >
        <div className="overflow-y-auto flex-1">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
            <SegmentedToggle options={TABS} value={activeTab} onChange={setActiveTab} ariaLabel="Grading view" />

            {activeTab === 'overview'     && <GradingDashboard courseId={courseId} courseName={course?.name} loadingCourse={loadingCourses} />}
            {activeTab === 'missing-work' && <MissingWork courseId={courseId} courseName={course?.name} loadingCourse={loadingCourses} />}
            {activeTab === 'adjustments'  && <GradeAdjustments courseId={courseId} courseName={course?.name} loadingCourse={loadingCourses} />}
            {activeTab === 'late-policy'  && <LatePolicyTool courseId={courseId} courseName={course?.name} loadingCourse={loadingCourses} />}
          </div>
        </div>
      </ToolShell>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </>
  )
}
