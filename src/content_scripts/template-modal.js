// "Add from Template" — the injected single-deploy surface (design doc 03, §4).
//
// Trigger UI only: this file renders a modal and sends one message. Every Canvas
// API call, the PIN gate, and the audit entry live in background/templateDeploy.js.
//
// Rendered into a shadow root so Canvas's stylesheet cannot reach in and our
// styles cannot leak out. That isolation is also why every style here is a
// literal value rather than a CSS custom property from the extension's theme.

import { extractTags } from '../modules/assignments/templateTags.js'

const HOST_ID = 'cpt-template-modal-host'
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome.runtime?.id) return reject(new Error('Extension was reloaded — refresh this page.'))
      chrome.runtime.sendMessage(message, response => {
        const err = chrome.runtime.lastError
        if (err) return reject(new Error(err.message))
        resolve(response)
      })
    } catch (err) {
      reject(err)
    }
  })
}

function tagLabel(name) {
  const words = name.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// The template's own publish default, narrowed to what its type can express.
// A page template saved with 'auto' has always produced a draft, so that is
// what 'auto' maps to here — the behaviour is unchanged, only made visible.
function defaultPublishFor(template) {
  const preferred = template.publishDefault ?? 'auto'
  if (template.type !== 'page') return preferred
  return preferred === 'published' ? 'published' : 'unpublished'
}

// Literal hex by necessity: shadow-DOM styles for markup injected into Canvas,
// and `all: initial` severs inheritance, so no custom property is readable here.
// eslint-disable-next-line no-restricted-syntax -- see above.
const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.45);
    display: flex; align-items: flex-start; justify-content: center;
    z-index: 2147483647; padding: 3rem 1rem 1rem; overflow-y: auto;
  }
  .modal {
    background: #fff; color: #1a1a1a; width: 100%; max-width: 32rem;
    border-radius: var(--cpt-radius, 6px); box-shadow: 0 1rem 3rem rgba(0,0,0,.3);
    display: flex; flex-direction: column; max-height: calc(100vh - 4rem);
  }
  header {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 1rem 1.25rem; border-bottom: 1px solid #e3e3e3;
  }
  h2 { margin: 0; font-size: 1rem; font-weight: 600; }
  .sub { margin: .125rem 0 0; font-size: .8125rem; color: #6b6b6b; font-weight: 400; }
  .body { padding: 1.25rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
  footer {
    display: flex; justify-content: flex-end; gap: .5rem;
    padding: .875rem 1.25rem; border-top: 1px solid #e3e3e3;
  }
  label { display: block; font-size: .8125rem; font-weight: 600; margin-bottom: .25rem; }
  .hint { font-size: .75rem; color: #6b6b6b; margin: .25rem 0 0; }
  input[type="text"], input[type="search"], input[type="date"], input[type="password"], select {
    width: 100%; padding: .4375rem .625rem; font-size: .875rem;
    border: 1px solid #c7c7c7; border-radius: var(--cpt-radius, 6px); background: #fff; color: #1a1a1a;
  }
  input:focus-visible, select:focus-visible, button:focus-visible, li:focus-visible {
    outline: 3px solid var(--cpt-color, #2B54D4); outline-offset: 1px;
  }
  ul { list-style: none; margin: 0; padding: 0; max-height: 13rem; overflow-y: auto;
       border: 1px solid #e3e3e3; border-radius: var(--cpt-radius, 6px); }
  li { padding: .5rem .75rem; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: .875rem; }
  li:last-child { border-bottom: none; }
  li:hover { background: #f5f5f5; }
  li[aria-selected="true"] { background: var(--cpt-color, #2B54D4); color: #fff; }
  li[aria-selected="true"] .meta { color: rgba(255,255,255,.85); }
  .meta { display: block; font-size: .75rem; color: #6b6b6b; margin-top: .0625rem; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
  button {
    padding: .4375rem .875rem; font-size: .8125rem; font-weight: 600; cursor: pointer;
    border-radius: var(--cpt-radius, 6px); border: 1px solid transparent; font-family: inherit;
  }
  .primary { background: var(--cpt-color, #2B54D4); color: #fff; }
  .primary[disabled] { opacity: .5; cursor: not-allowed; }
  .ghost { background: transparent; color: #444; border-color: #c7c7c7; }
  .close { background: transparent; border: none; font-size: 1.25rem; line-height: 1; padding: .25rem .5rem; color: #6b6b6b; }
  .msg { padding: .625rem .75rem; border-radius: var(--cpt-radius, 6px); font-size: .8125rem; }
  .msg.error { background: #fdeaea; color: #8a1220; }
  .msg.success { background: #e9f6ec; color: #17612c; }
  .msg.warn { background: #fdf4e3; color: #7a4f06; }
  .empty { font-size: .875rem; color: #6b6b6b; text-align: center; padding: 1.5rem .75rem; }
  fieldset { border: 1px solid #e3e3e3; border-radius: var(--cpt-radius, 6px); padding: .75rem; margin: 0; }
  legend { font-size: .8125rem; font-weight: 600; padding: 0 .375rem; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
`

export function closeTemplateModal() {
  document.getElementById(HOST_ID)?.remove()
}

export async function openTemplateModal({ courseId, moduleId, moduleName, theme }) {
  closeTemplateModal()

  const previouslyFocused = document.activeElement
  const host = document.createElement('div')
  host.id = HOST_ID
  const root = host.attachShadow({ mode: 'open' })
  document.body.appendChild(host)

  const style = document.createElement('style')
  style.textContent = STYLE
  root.appendChild(style)

  const backdrop = document.createElement('div')
  backdrop.className = 'backdrop'
  // Seeds --cpt-color for markup injected into Canvas's page, which has none of
  // our custom properties to read.
  // eslint-disable-next-line no-restricted-syntax -- see above.
  backdrop.style.setProperty('--cpt-color', theme?.color ?? '#2B54D4')
  backdrop.style.setProperty('--cpt-radius', theme?.radius ?? '6px')
  root.appendChild(backdrop)

  const modal = document.createElement('div')
  modal.className = 'modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-labelledby', 'cpt-modal-title')
  backdrop.appendChild(modal)

  // ── State ────────────────────────────────────────────────────────────────
  let templates = []
  let filtered = []
  let selectedId = null
  let tags = []
  let tagValues = {}
  let needsPin = false
  let busy = false
  let message = null // { tone, text }

  function close() {
    document.removeEventListener('keydown', onKeydown, true)
    host.remove()
    if (previouslyFocused?.focus) previouslyFocused.focus()
  }

  function onKeydown(e) {
    if (!document.getElementById(HOST_ID)) return
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab') return

    // Focus trap: the shadow root's focusable elements are the whole world
    // while this dialog is open.
    const items = [...modal.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = root.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  document.addEventListener('keydown', onKeydown, true)
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close() })

  function selectTemplate(id) {
    selectedId = id
    const t = templates.find(x => x.id === id)
    tags = t ? extractTags([t.itemName, t.instructions]) : []
    tagValues = {}
    render()
  }

  const promptedTags = () => tags.filter(t => !t.auto)
  const missing = () => promptedTags().filter(t => !(tagValues[t.name] ?? '').trim())

  async function submit() {
    const pinInput = modal.querySelector('#cpt-pin')
    const dueInput = modal.querySelector('#cpt-due')
    const publishInput = modal.querySelector('#cpt-publish')

    busy = true
    message = null
    render()

    try {
      const response = await sendMessage({
        type: 'TEMPLATE_DEPLOY_TO_MODULE',
        payload: {
          templateId: selectedId,
          courseId,
          moduleId,
          dueAt: dueInput?.value ?? '',
          publish: publishInput?.value ?? 'auto',
          tagValues,
          pin: pinInput?.value || undefined,
        },
      })

      busy = false

      if (response?.needsPin) {
        needsPin = true
        message = response.error ? { tone: 'error', text: response.error } : null
        render()
        modal.querySelector('#cpt-pin')?.focus()
        return
      }

      if (!response?.ok) {
        message = { tone: 'error', text: response?.error ?? 'Could not create the item.' }
        render()
        return
      }

      const warnings = [response.warning, response.moduleWarning].filter(Boolean).join(' ')
      message = {
        tone: warnings ? 'warn' : 'success',
        text: `Created "${response.name}". ${warnings || 'Reloading the page to show it…'}`.trim(),
      }
      render()

      // Canvas renders module items server-side, so a reload is the honest way
      // to show the new item in place.
      if (!response.moduleWarning) setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      busy = false
      message = { tone: 'error', text: err.message }
      render()
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    const selected = templates.find(t => t.id === selectedId)
    const blocked = busy || !selectedId || missing().length > 0

    modal.innerHTML = ''

    const header = document.createElement('header')
    const titleWrap = document.createElement('div')
    const h2 = document.createElement('h2')
    h2.id = 'cpt-modal-title'
    h2.textContent = 'Add from Template'
    const sub = document.createElement('p')
    sub.className = 'sub'
    sub.textContent = moduleName ? `Into module: ${moduleName}` : 'Into this module'
    titleWrap.append(h2, sub)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'close'
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', close)
    header.append(titleWrap, closeBtn)

    const body = document.createElement('div')
    body.className = 'body'

    // Live region so screen readers hear results and errors.
    const live = document.createElement('div')
    live.setAttribute('role', 'status')
    live.setAttribute('aria-live', 'polite')
    if (message) {
      live.className = `msg ${message.tone}`
      live.textContent = message.text
    } else {
      live.className = 'sr-only'
    }
    body.appendChild(live)

    if (templates.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'empty'
      empty.textContent = 'No templates yet. Create one in Canvas Power Tools → Assignments → Templates.'
      body.appendChild(empty)
    } else {
      // Search
      const searchWrap = document.createElement('div')
      const searchLabel = document.createElement('label')
      searchLabel.setAttribute('for', 'cpt-search')
      searchLabel.textContent = 'Template'
      const search = document.createElement('input')
      search.type = 'search'
      search.id = 'cpt-search'
      search.placeholder = 'Search templates…'
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase()
        filtered = q ? templates.filter(t => t.name.toLowerCase().includes(q)) : templates
        renderList()
        search.focus()
        search.setSelectionRange(search.value.length, search.value.length)
      })
      searchWrap.append(searchLabel, search)
      body.appendChild(searchWrap)

      const list = document.createElement('ul')
      list.setAttribute('role', 'listbox')
      list.setAttribute('aria-label', 'Templates')
      body.appendChild(list)

      function renderList() {
        list.innerHTML = ''
        for (const t of filtered) {
          const li = document.createElement('li')
          li.setAttribute('role', 'option')
          li.setAttribute('tabindex', '0')
          li.setAttribute('aria-selected', String(t.id === selectedId))
          const name = document.createElement('span')
          name.textContent = t.name
          const meta = document.createElement('span')
          meta.className = 'meta'
          const bits = [t.type === 'page' ? 'Page' : 'Assignment']
          if (t.points != null) bits.push(`${t.points} pts`)
          if (t.assignmentGroup) bits.push(t.assignmentGroup)
          meta.textContent = bits.join(' · ')
          li.append(name, meta)
          li.addEventListener('click', () => selectTemplate(t.id))
          li.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              selectTemplate(t.id)
            }
          })
          list.appendChild(li)
        }
        if (filtered.length === 0) {
          const li = document.createElement('li')
          li.textContent = 'No templates match that search.'
          list.appendChild(li)
        }
      }
      renderList()
    }

    // Tag fill-in
    if (selected && tags.length > 0) {
      const fs = document.createElement('fieldset')
      const legend = document.createElement('legend')
      legend.textContent = 'Fill in template tags'
      fs.appendChild(legend)

      for (const tag of promptedTags()) {
        const wrap = document.createElement('div')
        wrap.style.marginBottom = '.5rem'
        const label = document.createElement('label')
        label.setAttribute('for', `cpt-tag-${tag.name}`)
        label.textContent = tagLabel(tag.name)
        const input = document.createElement('input')
        input.type = 'text'
        input.id = `cpt-tag-${tag.name}`
        input.value = tagValues[tag.name] ?? ''
        input.placeholder = `Value for {${tag.name}}`
        input.addEventListener('input', () => {
          tagValues[tag.name] = input.value
          // Only the submit button's enabled state depends on this, so update it
          // directly rather than re-rendering and stealing focus mid-typing.
          const btn = modal.querySelector('#cpt-submit')
          if (btn) btn.disabled = busy || !selectedId || missing().length > 0
        })
        wrap.append(label, input)
        fs.appendChild(wrap)
      }

      const autoTags = tags.filter(t => t.auto)
      if (autoTags.length > 0) {
        const hint = document.createElement('p')
        hint.className = 'hint'
        hint.textContent = `Filled in automatically: ${autoTags.map(t => `{${t.name}}`).join(', ')}`
        fs.appendChild(hint)
      }
      body.appendChild(fs)
    }

    // Deploy options. A page and an assignment are different things in Canvas,
    // so they get different forms — a disabled control still reads as "this
    // should work and doesn't".
    if (selected) {
      const isPage = selected.type === 'page'

      const pubWrap = document.createElement('div')
      const pubLabel = document.createElement('label')
      pubLabel.setAttribute('for', 'cpt-publish')
      pubLabel.textContent = 'Publish'
      const publish = document.createElement('select')
      publish.id = 'cpt-publish'

      // 'Auto' means "published if a due date is set". A page has no due date,
      // so on a page it would always resolve to Unpublished — three options
      // with two outcomes. Offer the two real ones instead.
      const publishOptions = isPage
        ? [['unpublished', 'Unpublished (draft)'], ['published', 'Published']]
        : [['auto', 'Auto'], ['published', 'Published'], ['unpublished', 'Unpublished']]

      for (const [value, text] of publishOptions) {
        const opt = document.createElement('option')
        opt.value = value
        opt.textContent = text
        publish.appendChild(opt)
      }
      publish.value = defaultPublishFor(selected)
      pubWrap.append(pubLabel, publish)

      if (isPage) {
        // Full width — there is no date field to sit beside.
        body.appendChild(pubWrap)

        const pageHint = document.createElement('p')
        pageHint.className = 'hint'
        pageHint.textContent =
          'Pages have no due date in Canvas. To release this page on a schedule, set an unlock date on the module.'
        body.appendChild(pageHint)

        // {due_date} resolves to an empty string rather than being left in
        // place, so on a page it silently disappears from the content.
        if (tags.some(t => t.name === 'due_date')) {
          const warn = document.createElement('p')
          warn.className = 'msg warn'
          warn.textContent =
            'This template uses {due_date}. A page has no due date, so that tag will come out blank.'
          body.appendChild(warn)
        }
      } else {
        const row = document.createElement('div')
        row.className = 'row'

        const dueWrap = document.createElement('div')
        const dueLabel = document.createElement('label')
        dueLabel.setAttribute('for', 'cpt-due')
        dueLabel.textContent = 'Due date (optional)'
        const due = document.createElement('input')
        due.type = 'date'
        due.id = 'cpt-due'
        dueWrap.append(dueLabel, due)

        row.append(dueWrap, pubWrap)
        body.appendChild(row)

        const autoHint = document.createElement('p')
        autoHint.className = 'hint'
        autoHint.textContent = 'Auto publishes if a due date is set, otherwise creates a draft.'
        body.appendChild(autoHint)
      }
    }

    // PIN, only once the background says the session is locked
    if (needsPin) {
      const wrap = document.createElement('div')
      const label = document.createElement('label')
      label.setAttribute('for', 'cpt-pin')
      label.textContent = 'PIN'
      const pin = document.createElement('input')
      pin.type = 'password'
      pin.id = 'cpt-pin'
      pin.inputMode = 'numeric'
      pin.autocomplete = 'off'
      const hint = document.createElement('p')
      hint.className = 'hint'
      hint.textContent = 'Your session is locked. Enter your PIN to write to Canvas.'
      wrap.append(label, pin, hint)
      body.appendChild(wrap)
    }

    const footer = document.createElement('footer')
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'ghost'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', close)

    const submitBtn = document.createElement('button')
    submitBtn.type = 'button'
    submitBtn.id = 'cpt-submit'
    submitBtn.className = 'primary'
    submitBtn.textContent = busy
      ? 'Creating…'
      : selected ? (selected.type === 'page' ? 'Create Page' : 'Create Assignment') : 'Create'
    submitBtn.disabled = blocked
    submitBtn.addEventListener('click', submit)

    footer.append(cancel, submitBtn)
    modal.append(header, body, footer)
  }

  render()
  modal.querySelector('#cpt-search')?.focus() ?? modal.querySelector('button')?.focus()

  try {
    const response = await sendMessage({ type: 'TEMPLATE_LIST' })
    templates = (response?.templates ?? []).sort(byLastUsed)
    filtered = templates
    if (response?.error) message = { tone: 'error', text: response.error }
    render()
    modal.querySelector('#cpt-search')?.focus()
  } catch (err) {
    message = { tone: 'error', text: err.message }
    render()
  }
}

// Most-recently-used first; never-used last (design doc 03, §1 sort rule).
function byLastUsed(a, b) {
  if (!a.lastUsed && !b.lastUsed) return a.name.localeCompare(b.name)
  if (!a.lastUsed) return 1
  if (!b.lastUsed) return -1
  return new Date(b.lastUsed) - new Date(a.lastUsed)
}
