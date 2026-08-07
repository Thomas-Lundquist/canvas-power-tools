import React, { useState } from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import GradingDashboard from '../../modules/grading/GradingDashboard.jsx'
import MissingWork from '../../modules/grading/MissingWork.jsx'
import GradeAdjustments from '../../modules/grading/GradeAdjustments.jsx'
import LatePolicyTool from '../../modules/grading/LatePolicyTool.jsx'

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'missing-work',  label: 'Missing Work' },
  { id: 'adjustments',   label: 'Adjustments' },
  { id: 'late-policy',   label: 'Late Policy' },
]

export default function App({ initialCourseId }) {
  const [activeTab, setActiveTab] = useState('overview')
  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  return (
    <>
      <SkipLink />
      <ToolShell
        start={<BrandLogo />}
        end={<><AppNav current="grading" /><SettingsButton /></>}
      >
        <div className="overflow-y-auto flex-1">
          <div className="max-w-7xl mx-auto px-6 pt-6">
            <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden w-fit mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-r border-[var(--color-border)] last:border-r-0 transition-colors ${
                activeTab === tab.id ? 'text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]'
              }`}
              style={activeTab === tab.id ? { backgroundColor: 'var(--cpt-color)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

            {activeTab === 'overview'     && <GradingDashboard initialCourseId={initialCourseId} />}
            {activeTab === 'missing-work' && <MissingWork />}
            {activeTab === 'adjustments'  && <GradeAdjustments />}
            {activeTab === 'late-policy'  && <LatePolicyTool />}
          </div>
        </div>
      </ToolShell>
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} />}
    </>
  )
}
