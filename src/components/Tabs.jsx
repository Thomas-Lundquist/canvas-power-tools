// Tabs({ tabs, activeTab, onChange })
// tabs: [{ id: string, label: string }]
// Renders an accessible tab list. Wrap tab panel content in <TabPanel tabId="..." activeTab={...}>.
export function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Tool sections"
      className="flex rounded-lg border border-gray-200 bg-white overflow-hidden w-fit"
    >
      {tabs.map(tab => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-r border-gray-200 last:border-r-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${
              active ? 'text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
            style={active ? { backgroundColor: 'var(--cpt-color)' } : undefined}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ tabId, activeTab, children }) {
  const active = tabId === activeTab
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      hidden={!active}
    >
      {active && children}
    </div>
  )
}
