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

// Primary ramp steps and the fixed lightness curve extracted from the default
// blue ramp in global.css. A themed accent keeps the user's hue + saturation
// and only rides this lightness ladder, so every generated ramp matches the
// hand-tuned default's rhythm and contrast behaviour.
const PRIMARY_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 900]
const PRIMARY_LIGHTNESS = [96, 90, 80, 68, 60, 50, 43, 36, 26]

function hexToHsl(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  const ch = (x) => Math.round(255 * x).toString(16).padStart(2, '0')
  return '#' + ch(f(0)) + ch(f(8)) + ch(f(4))
}

// WCAG relative luminance and contrast ratio — used to pick a label color
// that stays legible on whatever accent fill the user chose.
function luminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const chan = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2]
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// Sets CSS custom properties on the document root so all themed elements
// react without component re-renders. Generates the full --primary-50…900
// ramp from the accent's hue + saturation (greys stay fixed), and sets
// --primary-contrast to the label color with the best measured contrast
// against the fill — an a11y guard so no accent can break AA on button text.
// Also writes to localStorage so the inline <head> script can apply the
// accent before the first paint.
export function applyTheme(hex = '#2B54D4') {
  const root = document.documentElement
  const { h, s } = hexToHsl(hex)

  const ramp = {}
  PRIMARY_STEPS.forEach((step, i) => {
    const value = hslToHex(h, s, PRIMARY_LIGHTNESS[i])
    ramp[step] = value
    root.style.setProperty(`--primary-${step}`, value)
  })

  root.style.setProperty('--cpt-color', ramp[500])
  root.style.setProperty('--cpt-color-dark', ramp[600])
  root.style.setProperty('--cpt-color-rgb', hexToRgb(ramp[500]))

  const contrast = contrastRatio('#FFFFFF', ramp[500]) >= contrastRatio('#221F1C', ramp[500])
    ? '#FFFFFF'
    : '#221F1C'
  root.style.setProperty('--primary-contrast', contrast)

  try { localStorage.setItem('cpt_color', hex) } catch { /* storage unavailable */ }
}

// Applies or removes the 'dark' class on <html> based on mode.
// Persists mode to localStorage so theme-init.js applies it before first paint.
export function applyDarkMode(mode = 'system') {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
  try { localStorage.setItem('cpt_theme', mode) } catch { /* storage unavailable */ }
}

// Sets font-size on <html> so all rem-based sizes scale proportionally.
// Persists to localStorage so theme-init.js can apply it before first paint.
const TEXT_SIZE_MAP = { small: '13px', medium: '15px', large: '17px', 'extra-large': '20px' }

export function applyTextSize(size = 'medium') {
  document.documentElement.setAttribute('data-text-size', TEXT_SIZE_MAP[size] ? size : 'medium')
  try { localStorage.setItem('cpt_text_size', size) } catch { /* storage unavailable */ }
}
