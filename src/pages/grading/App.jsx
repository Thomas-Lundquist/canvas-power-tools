import React, { useState } from 'react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
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

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex items-center gap-1">
            <AppNav current="grading" />
            <SettingsButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden w-fit mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
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
  )
}
