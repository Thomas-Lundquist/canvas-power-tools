import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import AppNav from '../../components/AppNav.jsx'
import { TOOLS } from '../../config/tools.jsx'
import { getAccount, saveAccount, updateVerificationStatus } from '../../storage/account.js'
import { getPreferences, setPreference } from '../../storage/preferences.js'
import { applyTheme } from '../../utils/color.js'
import { clearAllChangeLogs } from '../../storage/changeLogs.js'
import { verifyToken } from '../../api/auth.js'
import { getDecryptedToken } from '../../storage/encryption.js'
import '../../styles/global.css'

const BRAND_COLORS = [
  { name: 'Indigo',  hex: '#4f46e5' },
  { name: 'Blue',    hex: '#2563eb' },
  { name: 'Sky',     hex: '#0284c7' },
  { name: 'Teal',    hex: '#0d9488' },
  { name: 'Green',   hex: '#16a34a' },
  { name: 'Amber',   hex: '#d97706' },
  { name: 'Orange',  hex: '#ea580c' },
  { name: 'Red',     hex: '#dc2626' },
  { name: 'Pink',    hex: '#db2777' },
  { name: 'Purple',  hex: '#9333ea' },
  { name: 'Slate',   hex: '#475569' },
  { name: 'Dark',    hex: '#1e293b' },
]

const SORT_FIELDS = [
  { value: 'position',       label: 'Canvas order' },
  { value: 'name',           label: 'Name (A–Z)' },
  { value: 'dueAt',          label: 'Due Date' },
  { value: 'pointsPossible', label: 'Points' },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? '' : 'bg-gray-300'}`}
      style={checked ? { backgroundColor: 'var(--cpt-color)' } : undefined}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function PrefRow({ title, description, children }) {
  return (
    <div className="flex items-center justify-between py-2 gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function App() {
  const [account, setAccount] = useState(null)
  const [prefs, setPrefs] = useState(null)
  const [showToken, setShowToken] = useState(false)
  const [decryptedToken, setDecryptedToken] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [confirmClearLogs, setConfirmClearLogs] = useState(false)

  useEffect(() => {
    Promise.all([getAccount(), getPreferences()]).then(([acc, p]) => {
      setAccount(acc)
      setPrefs(p)
      applyTheme(p.buttonColor)
    })
  }, [])

  async function revealToken() {
    if (!showToken) setDecryptedToken(await getDecryptedToken())
    setShowToken(!showToken)
  }

  async function verifyNow() {
    setVerifying(true)
    setVerifyStatus(null)
    try {
      const token = await getDecryptedToken()
      await verifyToken(account.canvasUrl, token)
      await updateVerificationStatus('valid')
      setVerifyStatus('valid')
      setAccount(await getAccount())
    } catch {
      await updateVerificationStatus('failed')
      setVerifyStatus('failed')
    } finally {
      setVerifying(false)
    }
  }

  async function setPref(key, value) {
    const updated = await setPreference(key, value)
    setPrefs(updated)
    if (key === 'buttonColor') applyTheme(value)
  }

  async function clearLogs() {
    await clearAllChangeLogs()
    setConfirmClearLogs(false)
  }

  function openOnboarding() {
    chrome.runtime.sendMessage({ type: 'OPEN_PAGE', path: 'src/pages/onboarding/index.html' })
  }

  if (!account || !prefs) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader size={32} className="animate-spin text-indigo-400" /></div>
  }

  const statusColor = account.verificationStatus === 'valid' ? 'text-green-600' : 'text-red-600'
  const StatusIcon = account.verificationStatus === 'valid' ? CheckCircle : AlertCircle

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: prefs.buttonColor ?? '#4f46e5' }}>
              <span className="text-white text-xs font-black">C</span>
            </div>
            <span className="text-sm font-bold text-gray-900 hidden sm:block">Canvas Power Tools</span>
          </div>
          <AppNav current={null} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Account */}
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Account</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Canvas URL</label>
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{account.canvasUrl}</p>
            </div>
            <div>
              <label className="label">API Token</label>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 font-mono tracking-wider overflow-hidden text-ellipsis">
                  {showToken && decryptedToken ? decryptedToken : '••••••••••••••••••••••••'}
                </p>
                <button className="btn-secondary" onClick={revealToken}>
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 text-sm font-medium ${statusColor}`}>
                <StatusIcon size={14} />
                {account.verificationStatus === 'valid' ? 'Connected' : 'Connection failed'}
                {account.lastVerified && (
                  <span className="text-gray-400 font-normal ml-1 text-xs">
                    — verified {new Date(account.lastVerified).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={verifyNow} disabled={verifying}>
                  {verifying ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Verify Now
                </button>
                <button className="btn-secondary text-sm" onClick={openOnboarding}>Redo Setup</button>
              </div>
            </div>
            {verifyStatus === 'valid' && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Token verified successfully.</p>}
            {verifyStatus === 'failed' && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> Token is invalid or expired.</p>}
          </div>
        </section>

        {/* Appearance */}
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Appearance</h2>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Power Tools button color</p>
            <p className="text-xs text-gray-500 mb-3">Applied to all Canvas Power Tools buttons injected on Canvas pages.</p>
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.name}
                  onClick={() => setPref('buttonColor', c.hex)}
                  className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                  style={{
                    background: c.hex,
                    borderColor: prefs.buttonColor === c.hex ? '#fff' : c.hex,
                    boxShadow: prefs.buttonColor === c.hex ? `0 0 0 3px ${c.hex}` : 'none',
                  }}
                >
                  {prefs.buttonColor === c.hex && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">Reload any open Canvas tabs after changing color.</p>
          </div>
        </section>

        {/* General */}
        <section className="card p-6 space-y-1 divide-y divide-gray-100">
          <h2 className="section-title pb-3">General</h2>
          <PrefRow title="Default course" description="Which course to open when launching the Bulk Editor.">
            <select value={prefs.defaultCourse} onChange={e => setPref('defaultCourse', e.target.value)} className="input w-40 text-sm">
              <option value="last_used">Last used course</option>
              <option value="ask">Always ask</option>
            </select>
          </PrefRow>
          <PrefRow title="Auto-add to module after deploy" description="When deploying a template from a module's Power Tools button, automatically add the new assignment to that module.">
            <Toggle checked={prefs.autoAddToModule} onChange={v => setPref('autoAddToModule', v)} />
          </PrefRow>
        </section>

        {/* Bulk Editor */}
        <section className="card p-6 space-y-1 divide-y divide-gray-100">
          <h2 className="section-title pb-3">Bulk Editor</h2>
          <PrefRow title="Shift all date fields together" description="When shifting dates, mirror the same shift to Due Date, Available From, and Available Until simultaneously.">
            <Toggle checked={prefs.shiftAllDatesTogether} onChange={v => setPref('shiftAllDatesTogether', v)} />
          </PrefRow>
          <PrefRow title="Default sort" description="Initial sort order when opening the Bulk Editor.">
            <div className="flex items-center gap-2">
              <select value={prefs.bulkEditorDefaultSort} onChange={e => setPref('bulkEditorDefaultSort', e.target.value)} className="input text-sm w-36">
                {SORT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select value={prefs.bulkEditorDefaultSortDir} onChange={e => setPref('bulkEditorDefaultSortDir', e.target.value)} className="input text-sm w-24">
                <option value="asc">A → Z</option>
                <option value="desc">Z → A</option>
              </select>
            </div>
          </PrefRow>
        </section>

        {/* Templates */}
        <section className="card p-6 space-y-1 divide-y divide-gray-100">
          <h2 className="section-title pb-3">Templates</h2>
          <PrefRow title="Auto-expand all folders" description="Open all template folders automatically when the Templates page loads.">
            <Toggle checked={prefs.templateAutoExpandFolders} onChange={v => setPref('templateAutoExpandFolders', v)} />
          </PrefRow>
          <PrefRow title="Skip delete confirmation" description="Delete templates and folders immediately without the confirmation prompt. Cannot be undone.">
            <Toggle checked={prefs.templateSkipDeleteConfirm} onChange={v => setPref('templateSkipDeleteConfirm', v)} />
          </PrefRow>
        </section>

        {/* Popup */}
        <section className="card p-6 space-y-4">
          <div>
            <h2 className="section-title">Popup</h2>
            <p className="text-xs text-gray-500 mt-1">Choose which tools appear in the browser popup. Deselecting all will show all tools.</p>
          </div>
          <div className="space-y-1">
            {TOOLS.map(tool => {
              const pinnedIds   = prefs.popupPinnedTools
              const allShown    = pinnedIds == null
              const isChecked   = allShown || pinnedIds.includes(tool.id)
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    const current = prefs.popupPinnedTools ?? TOOLS.map(t => t.id)
                    const next = current.includes(tool.id)
                      ? current.filter(id => id !== tool.id)
                      : [...current, tool.id]
                    // null means "show all" — if the user re-checks everything, go back to null
                    setPref('popupPinnedTools', next.length === TOOLS.length ? null : next)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0"
                    style={isChecked
                      ? { backgroundColor: 'var(--cpt-color)', borderColor: 'var(--cpt-color)' }
                      : { backgroundColor: 'white', borderColor: '#d1d5db' }}
                  >
                    {isChecked && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <tool.Icon size={15} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700">{tool.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Data */}
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Data</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Change Logs</p>
              <p className="text-xs text-gray-500 mt-0.5">Records of all bulk edits and reverts.</p>
            </div>
            {confirmClearLogs ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Are you sure?</span>
                <button className="btn-danger text-xs px-2 py-1" onClick={clearLogs}>Clear All</button>
                <button className="btn-ghost text-xs" onClick={() => setConfirmClearLogs(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmClearLogs(true)}>
                Clear All Logs
              </button>
            )}
          </div>
        </section>

        {/* About */}
        <section className="card p-6 space-y-3">
          <h2 className="section-title">About</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between"><span>Version</span><span className="text-gray-900 font-medium">1.5.0</span></div>
            <div className="flex justify-between"><span>License</span><span className="text-gray-900">MIT Open Source</span></div>
          </div>
        </section>

      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
