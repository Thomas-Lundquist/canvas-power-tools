import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '../../styles/global.css'
import { ToastProvider } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'

createRoot(document.getElementById('root')).render(<ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider>)

