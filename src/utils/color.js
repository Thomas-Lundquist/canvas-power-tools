export function darkenHex(hex, amount = 30) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}`
}

// Sets CSS custom properties on the document root so all themed elements
// react without component re-renders. Also writes to localStorage so the
// inline <head> script can apply the color before the first paint.
export function applyTheme(hex = '#4f46e5') {
  const root = document.documentElement
  root.style.setProperty('--cpt-color', hex)
  root.style.setProperty('--cpt-color-dark', darkenHex(hex))
  root.style.setProperty('--cpt-color-rgb', hexToRgb(hex))
  try { localStorage.setItem('cpt_color', hex) } catch { /* storage unavailable */ }
}
