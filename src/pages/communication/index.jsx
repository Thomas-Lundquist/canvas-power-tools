import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyTheme, applyDarkMode, applyTextSize } from '../../utils/color.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'
import SetupGuard from '../../components/SetupGuard.jsx'

getPreferences().then(p => { applyTheme(p.buttonColor); applyDarkMode(p.themeMode ?? 'system'); applyTextSize(p.textSize ?? 'medium') })
createRoot(document.getElementById('root')).render(
  <SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>
)
