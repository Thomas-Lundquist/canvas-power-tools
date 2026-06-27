import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { getPreferences } from '../../storage/preferences.js'
import { applyTheme, applyDarkMode } from '../../utils/color.js'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'

getPreferences().then(p => { applyTheme(p.buttonColor); applyDarkMode(p.themeMode ?? 'system') })
createRoot(document.getElementById('root')).render(
  <ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider>
)
