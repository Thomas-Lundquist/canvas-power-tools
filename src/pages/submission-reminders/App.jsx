import React from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import NudgeTool from '../../modules/communication/NudgeTool.jsx'

export default function App() {
  const { showPanel, setShowPanel } = useKeyboardShortcuts([])
  const params = new URLSearchParams(window.location.search)
  const initialCourseId = params.get('courseId') ?? null
  const initialAssignmentId = params.get('assignmentId') ?? null
  const initialStudentIds = params.getAll('studentId')

  return (
    <>
      <SkipLink />
      <ToolShell
        start={<BrandLogo />}
        end={<><AppNav current="submission-reminders" /><SettingsButton /></>}
      >
        <div className="overflow-y-auto flex-1">
          <div className="max-w-4xl mx-auto px-6 pt-6">
            <NudgeTool
              initialCourseId={initialCourseId}
              initialAssignmentId={initialAssignmentId}
              initialStudentIds={initialStudentIds.length > 0 ? initialStudentIds : null}
            />
          </div>
        </div>
      </ToolShell>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </>
  )
}
