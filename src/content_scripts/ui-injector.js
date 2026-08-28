import { findElement } from '../dom/selector-engine.js'

const BULK_BTN_ID = 'cpt-bulk-editor-btn'
const TEMPLATE_BTN_ID = 'cpt-save-template-btn'

function safeMessage(path) {
  try {
    if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'OPEN_PAGE', path })
  } catch {
    // Extension was reloaded; this tab's content script is orphaned — ignore
  }
}

// Injected buttons live in Canvas's page, outside our extension's CSS cascade,
// so they need literal per-palette values rather than CSS custom properties.
// Colors mirror each theme's --cpt-color (Bauhaus red / Default primary-500);
// radius mirrors --radius-control (Bauhaus flat 2px / Default rounded 6px) so an
// injected button reads as the same shape as the tool it opens.
const PALETTE_COLORS = { bauhaus: '#B7102A', default: '#2B54D4' }
const PALETTE_RADIUS = { bauhaus: '2px', default: '6px' }

async function getButtonTheme() {
  try {
    const result = await chrome.storage.local.get('preferences')
    const palette = result.preferences?.palette === 'default' ? 'default' : 'bauhaus'
    return { color: PALETTE_COLORS[palette], radius: PALETTE_RADIUS[palette] }
  } catch {
    return { color: PALETTE_COLORS.bauhaus, radius: PALETTE_RADIUS.bauhaus }
  }
}

function darken(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (n >> 16) - 30)
  const g = Math.max(0, ((n >> 8) & 0xff) - 30)
  const b = Math.max(0, (n & 0xff) - 30)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function makeCptButton(id, label, title, onClick, small = false, theme = { color: '#B7102A', radius: '2px' }) {
  const { color, radius } = theme
  const hoverColor = darken(color)
  const btn = document.createElement('button')
  btn.id = id
  btn.textContent = label
  btn.title = title
  Object.assign(btn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: small ? '4px 10px' : '6px 18px 6px 14px',
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: radius,
    fontSize: small ? '12px' : '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginLeft: '8px',
    marginRight: '8px',
    flexShrink: '0',
    fontFamily: 'inherit',
  })
  btn.addEventListener('mouseenter', () => { btn.style.background = hoverColor })
  btn.addEventListener('mouseleave', () => { btn.style.background = color })
  btn.addEventListener('click', onClick)
  return btn
}

function courseIdFromPath() {
  const m = window.location.pathname.match(/\/courses\/(\d+)/)
  return m ? m[1] : null
}

export async function injectBulkEditorButton() {
  if (document.getElementById(BULK_BTN_ID)) return

  const toolbar = findElement('assignmentListToolbar')
  if (!toolbar) return

  const theme = await getButtonTheme()
  const courseId = courseIdFromPath()
  const path = courseId
    ? `src/pages/bulk-editor/index.html?courseId=${courseId}`
    : 'src/pages/bulk-editor/index.html'

  const btn = makeCptButton(BULK_BTN_ID, 'Power Tools', 'Open Canvas Power Tools Bulk Editor', () => safeMessage(path), false, theme)
  toolbar.appendChild(btn)
}

export async function injectSaveAsTemplateButton() {
  if (document.getElementById(TEMPLATE_BTN_ID)) return

  const match = window.location.pathname.match(/\/courses\/(\d+)\/assignments\/(\d+)/)
  if (!match) return
  const [, courseId, assignmentId] = match

  const actionArea = findElement('assignmentDetailActions')
  const titleEl = findElement('assignmentTitle')
  const anchor = actionArea ?? titleEl
  if (!anchor) return

  const theme = await getButtonTheme()
  const btn = makeCptButton(
    TEMPLATE_BTN_ID,
    'Save as Template',
    'Save this assignment as a Canvas Power Tools template',
    () => safeMessage(`src/pages/templates/index.html?saveFrom=${courseId}/${assignmentId}`),
    false,
    theme,
  )
  anchor.insertAdjacentElement('afterend', btn)
}

export async function injectModuleButtons() {
  const courseId = courseIdFromPath()
  if (!courseId) return

  const theme = await getButtonTheme()

  document.querySelectorAll('.context_module').forEach(moduleEl => {
    const rawId = moduleEl.dataset.moduleId ?? moduleEl.id?.replace('context_module_', '')
    if (!rawId || !/^\d+$/.test(rawId)) return

    const btnId = `cpt-module-btn-${rawId}`
    if (document.getElementById(btnId)) return

    const igHeader = moduleEl.querySelector('.ig-header')
    if (!igHeader) return

    const btn = makeCptButton(
      btnId,
      'Power Tools',
      'Add a Canvas Power Tools template to this module',
      () => safeMessage(`src/pages/templates/index.html?courseId=${courseId}&moduleId=${rawId}`),
      true,
      theme,
    )
    igHeader.appendChild(btn)
  })
}
