import { findElement } from '../dom/selector-engine.js'
import { openTemplateModal } from './template-modal.js'

const BULK_BTN_ID = 'cpt-bulk-editor-btn'
const TEMPLATE_BTN_ID = 'cpt-save-template-btn'
const PAGE_TEMPLATE_BTN_ID = 'cpt-save-page-template-btn'

function safeMessage(path) {
  try {
    if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'OPEN_PAGE', path })
  } catch {
    // Extension was reloaded; this tab's content script is orphaned — ignore
  }
}

// Injected buttons live in Canvas's page, outside our extension's CSS cascade,
// so they need literal per-palette values rather than CSS custom properties.
// Colors mirror each theme's --cpt-color (Bauhaus red / Modern primary-500);
// radius mirrors --radius-control (Bauhaus flat 2px / Modern rounded 6px) so an
// injected button reads as the same shape as the tool it opens.
// eslint-disable-next-line no-restricted-syntax -- literal by necessity, see above.
const PALETTE_COLORS = { bauhaus: '#B7102A', modern: '#2B54D4' }
const PALETTE_RADIUS = { bauhaus: '2px', modern: '6px' }

async function getButtonTheme() {
  try {
    const result = await chrome.storage.local.get('preferences')
    // 'default' is the pre-rename value for 'modern'; anything else falls back to Bauhaus.
    const stored = result.preferences?.palette
    const palette = (stored === 'modern' || stored === 'default') ? 'modern' : 'bauhaus'
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

// eslint-disable-next-line no-restricted-syntax -- Bauhaus fallback for injected markup.
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
    // eslint-disable-next-line no-restricted-syntax -- injected markup, no tokens available.
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

export async function injectSavePageAsTemplateButton() {
  if (document.getElementById(PAGE_TEMPLATE_BTN_ID)) return

  // The slug may contain hyphens, percent-encoding, and unicode — everything up
  // to the next `/` or query string belongs to it.
  const match = window.location.pathname.match(/\/courses\/(\d+)\/pages\/([^/?#]+)/)
  if (!match) return
  const [, courseId, pageUrl] = match

  const actionArea = findElement('pageDetailActions')
  const titleEl = findElement('pageTitle')
  const anchor = actionArea ?? titleEl
  if (!anchor) return

  const theme = await getButtonTheme()
  const btn = makeCptButton(
    PAGE_TEMPLATE_BTN_ID,
    'Save as Template',
    'Save this page as a Canvas Power Tools template',
    () => safeMessage(`src/pages/templates/index.html?savePageFrom=${courseId}/${encodeURIComponent(pageUrl)}`),
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

    const moduleName = moduleEl.querySelector('.ig-header-title')?.textContent?.trim() ?? ''

    const btn = makeCptButton(
      btnId,
      'Add from Template',
      `Add a Canvas Power Tools template to ${moduleName || 'this module'}`,
      () => openTemplateModal({ courseId, moduleId: rawId, moduleName, theme }),
      true,
      theme,
    )

    // Sit to the left of Canvas's own module controls (publish, +, kebab), which
    // live in .ig-header-admin. Appending to .ig-header instead would land the
    // button after all of them.
    const adminArea = igHeader.querySelector('.ig-header-admin')
    if (adminArea) {
      adminArea.prepend(btn)
    } else {
      igHeader.appendChild(btn)
    }
  })
}
