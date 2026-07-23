export function darkenHex(hex, amount = 30) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

// Sets data-theme on <html> so the palette's full token set (colors, shadows,
// radii — see the [data-theme="bauhaus"] block in global.css) applies.
// Persists to localStorage so the inline <head> script can apply it before
// first paint, avoiding a flash of the wrong palette.
export function applyPalette(name = 'bauhaus') {
  document.documentElement.setAttribute('data-theme', name)
  try { localStorage.setItem('cpt_palette', name) } catch { /* storage unavailable */ }
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
