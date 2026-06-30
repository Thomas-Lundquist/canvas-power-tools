import React, { useState, useEffect } from 'react'
import { isSetupComplete } from '../storage/account.js'

export default function SetupGuard({ children }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    isSetupComplete().then(complete => {
      if (!complete) {
        window.location.href = chrome.runtime.getURL('src/pages/onboarding/index.html')
      } else {
        setReady(true)
      }
    })
  }, [])

  if (!ready) return null

  return children
}
