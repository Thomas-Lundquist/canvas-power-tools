import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react'
import { verifyToken } from '../../api/auth.js'
import { saveAccount, markSetupComplete } from '../../storage/account.js'

const STEPS = ['welcome', 'url', 'token', 'verifying', 'success']

export default function App() {
  const [step, setStep] = useState('welcome')
  const [canvasUrl, setCanvasUrl] = useState('https://')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [urlError, setUrlError] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [verifiedUser, setVerifiedUser] = useState(null)

  async function handleVerify() {
    setVerifyError(null)
    setStep('verifying')
    try {
      const user = await verifyToken(canvasUrl, token)
      await saveAccount({ canvasUrl, token, userName: user.name })
      await markSetupComplete()
      setVerifiedUser(user)
      setStep('success')
    } catch (err) {
      setVerifyError(err.message)
      setStep('token')
    }
  }

  async function pasteToken() {
    try {
      const text = await navigator.clipboard.readText()
      setToken(text.trim())
    } catch {
      // Clipboard access denied — user can paste manually
    }
  }

  function validateUrl() {
    if (!canvasUrl.startsWith('https://')) {
      setUrlError('URL must start with https://')
      return false
    }
    try {
      new URL(canvasUrl)
      setUrlError(null)
      return true
    } catch {
      setUrlError('Please enter a valid URL.')
      return false
    }
  }

  function openBulkEditor() {
    chrome.runtime.sendMessage({ type: 'OPEN_PAGE', path: 'src/pages/bulk-editor/index.html' })
    window.close()
  }

  function openSettings() {
    chrome.runtime.sendMessage({ type: 'OPEN_PAGE', path: 'src/pages/settings/index.html' })
    window.close()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {step === 'welcome' && <WelcomeScreen onStart={() => setStep('url')} />}

        {step === 'url' && (
          <StepCard step={1} title="Where is your Canvas?">
            <p className="text-sm text-gray-600 mb-4">
              Enter your institution's Canvas URL. You'll find it in your browser's address bar when logged into Canvas.
            </p>
            <label className="label">Canvas URL</label>
            <input
              type="url"
              value={canvasUrl}
              onChange={e => { setCanvasUrl(e.target.value); setUrlError(null) }}
              placeholder="https://yourschool.instructure.com"
              className="input"
              autoFocus
            />
            {urlError && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{urlError}</p>}
            <p className="mt-3 text-xs text-gray-500">
              Examples: https://yourschool.instructure.com &nbsp;|&nbsp; https://canvas.yourschool.edu
            </p>
            <div className="mt-6 flex justify-end">
              <button
                className="btn-primary"
                onClick={() => { if (validateUrl()) setStep('token') }}
              >
                Continue
              </button>
            </div>
          </StepCard>
        )}

        {step === 'token' && (
          <StepCard step={2} title="Connect your Canvas account">
            <p className="text-sm text-gray-600 mb-4">
              Canvas Power Tools needs an API token to interact with your courses.
              This token is stored only on your device and is never shared with anyone.
            </p>

            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 mb-4 font-medium"
            >
              {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              How to generate your token
            </button>

            {showInstructions && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-1">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Open Canvas and go to <strong>Account &gt; Settings</strong></li>
                  <li>Scroll down to <strong>Approved Integrations</strong></li>
                  <li>Click <strong>New Access Token</strong></li>
                  <li>Enter <strong>Canvas Power Tools</strong> as the purpose</li>
                  <li>Set expiry to the end of your school year (recommended)</li>
                  <li>Click <strong>Generate Token</strong></li>
                  <li>Copy the token — it is only shown once</li>
                </ol>
                <p className="mt-3 text-xs text-gray-500">
                  Tip: Setting an expiry date limits risk if your token is ever compromised. You can regenerate it each school year in under a minute.
                </p>
              </div>
            )}

            {verifyError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Could not verify your token</p>
                  <p className="mt-1 text-red-600">{verifyError}</p>
                  <p className="mt-2 text-xs text-gray-500">Common causes: token not copied completely, token expired, or incorrect Canvas URL.</p>
                </div>
              </div>
            )}

            <label className="label">Paste your token here</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Paste your API token"
                  className="input pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button className="btn-secondary" onClick={pasteToken}>Paste</button>
            </div>

            <div className="mt-6 flex justify-between items-center">
              <button className="btn-ghost" onClick={() => setStep('url')}>Back</button>
              <button
                className="btn-primary"
                disabled={!token.trim()}
                onClick={handleVerify}
              >
                Verify Token
              </button>
            </div>
          </StepCard>
        )}

        {step === 'verifying' && (
          <div className="card p-12 text-center">
            <Loader size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Verifying your token...</h2>
            <p className="text-sm text-gray-500 mt-2">Connecting to Canvas</p>
          </div>
        )}

        {step === 'success' && (
          <div className="card p-10 text-center space-y-6">
            <div>
              <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">
                You are all set{verifiedUser?.shortName ? `, ${verifiedUser.shortName.split(' ')[0]}` : ''}.
              </h2>
              <p className="text-gray-500 mt-2">Canvas Power Tools is ready to use.</p>
            </div>

            {verifiedUser && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-left space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Logged in as</span>
                  <span className="font-medium text-gray-900">{verifiedUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Canvas URL</span>
                  <span className="font-medium text-gray-900 text-xs">{canvasUrl}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button className="btn-primary w-full justify-center" onClick={openBulkEditor}>
                Open Bulk Assignment Editor
              </button>
              <button className="btn-secondary w-full justify-center" onClick={openSettings}>
                Go to Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WelcomeScreen({ onStart }) {
  return (
    <div className="card p-12 text-center space-y-8">
      <div>
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
          <span className="text-white text-2xl font-black">C</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Canvas Power Tools</h1>
        <p className="text-gray-500 mt-3 text-lg">A faster way to manage your Canvas courses.</p>
      </div>
      <div className="space-y-3 text-sm text-gray-600 text-left bg-gray-50 rounded-lg p-5">
        <p>Bulk edit assignments, manage templates, and more — all in one place, without the Canvas runaround.</p>
        <p className="font-medium text-indigo-700">Your data never leaves your browser.</p>
      </div>
      <div>
        <button className="btn-primary text-base px-8 py-3" onClick={onStart}>Get Started</button>
        <p className="text-xs text-gray-400 mt-3">Takes about 2 minutes</p>
      </div>
    </div>
  )
}

function StepCard({ step, title, children }) {
  return (
    <div className="card p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Step {step} of 3</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  )
}
