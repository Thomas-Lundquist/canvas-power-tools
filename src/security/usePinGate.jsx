import React, { createContext, useContext, useState } from 'react'
import PinPrompt from '../components/PinPrompt.jsx'
import { isSessionLocked, refreshActivity, getSecuritySettings } from './pin.js'
import { logAuditEntry } from './audit-log.js'

const PinGateContext = createContext(null)

export function PinGateProvider({ children }) {
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(null)

  async function requirePin(auditMeta, action) {
    const settings = await getSecuritySettings()

    if (!settings.pinEnabled || !settings.pinHash) {
      await action()
      await logAuditEntry({ ...auditMeta, pinVerified: 'disabled' })
      await refreshActivity()
      return
    }

    if (!(await isSessionLocked())) {
      await action()
      await logAuditEntry({ ...auditMeta, pinVerified: true })
      await refreshActivity()
      return
    }

    setPending({ auditMeta, action })
    setVisible(true)
  }

  async function handleVerified() {
    setVisible(false)
    if (pending) {
      await pending.action()
      await logAuditEntry({ ...pending.auditMeta, pinVerified: true })
      await refreshActivity()
      setPending(null)
    }
  }

  function handleCancel() {
    setVisible(false)
    setPending(null)
  }

  return (
    <PinGateContext.Provider value={{ requirePin }}>
      {children}
      {visible && <PinPrompt onVerified={handleVerified} onCancel={handleCancel} />}
    </PinGateContext.Provider>
  )
}

export function usePinGate() {
  const ctx = useContext(PinGateContext)
  if (!ctx) throw new Error('usePinGate must be used within PinGateProvider')
  return ctx
}
