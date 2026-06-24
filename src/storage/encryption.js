// AES-GCM encryption for the API token using a per-install key stored in local storage.
// The key never leaves the device and never goes into sync storage.

const KEY_STORAGE_KEY = 'encryptionKey'
const ALGORITHM = { name: 'AES-GCM', length: 256 }

async function getOrCreateKey() {
  const stored = await chrome.storage.local.get(KEY_STORAGE_KEY)
  if (stored[KEY_STORAGE_KEY]) {
    const keyData = base64ToBytes(stored[KEY_STORAGE_KEY])
    return crypto.subtle.importKey('raw', keyData, ALGORITHM, false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey(ALGORITHM, true, ['encrypt', 'decrypt'])
  const exported = await crypto.subtle.exportKey('raw', key)
  await chrome.storage.local.set({ [KEY_STORAGE_KEY]: bytesToBase64(exported) })
  return key
}

export async function encryptToken(token) {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(token)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)
  return bytesToBase64(combined.buffer)
}

export async function decryptToken(encryptedBase64) {
  const key = await getOrCreateKey()
  const combined = new Uint8Array(base64ToBytes(encryptedBase64))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}

export async function getDecryptedToken() {
  const result = await chrome.storage.sync.get('account')
  const encryptedToken = result.account?.apiToken
  if (!encryptedToken) return null
  try {
    return await decryptToken(encryptedToken)
  } catch {
    return null
  }
}

function bytesToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
