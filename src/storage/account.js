import { encryptToken } from './encryption.js'

export async function getAccount() {
  const sync = await chrome.storage.sync.get('account')
  return sync.account ?? null
}

export async function getCanvasUrl() {
  const account = await getAccount()
  if (!account?.canvasUrl) throw new Error('Canvas URL not configured. Please complete setup.')
  return account.canvasUrl.replace(/\/$/, '')
}

export async function saveAccount({ canvasUrl, token, userName }) {
  const encryptedToken = await encryptToken(token)
  const account = {
    canvasUrl: canvasUrl.replace(/\/$/, ''),
    apiToken: encryptedToken,
    lastVerified: new Date().toISOString(),
    verificationStatus: 'valid',
    userName,
  }
  await chrome.storage.sync.set({ account })
  await chrome.storage.local.set({ account })
  return account
}

export async function updateVerificationStatus(status) {
  const sync = await chrome.storage.sync.get('account')
  if (!sync.account) return
  const account = { ...sync.account, verificationStatus: status, lastVerified: new Date().toISOString() }
  await chrome.storage.sync.set({ account })
  await chrome.storage.local.set({ account })
}

export async function isSetupComplete() {
  const sync = await chrome.storage.sync.get('meta')
  return sync.meta?.setupComplete === true
}

export async function markSetupComplete() {
  const sync = await chrome.storage.sync.get('meta')
  const meta = { ...(sync.meta ?? {}), setupComplete: true, version: '1.0.0' }
  await chrome.storage.sync.set({ meta })
  await chrome.storage.local.set({ meta })
}
