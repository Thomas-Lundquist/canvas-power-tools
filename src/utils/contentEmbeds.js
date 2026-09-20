// Classification for embedded content found in Canvas page/assignment HTML.
//
// Split out from ContentPreview so the rules are testable without a DOM: the
// component's extraction step needs DOMParser, but deciding *what an embed is*
// is pure string work.

// Providers whose embeds need scripts and cookies to render — exactly what the
// preview's sandbox denies. Naming them is more useful than a broken frame.
const PROVIDERS = [
  { test: /(^|\.)docs\.google\.com$/,          label: 'Google Docs / Slides / Sheets' },
  { test: /(^|\.)drive\.google\.com$/,         label: 'Google Drive file' },
  { test: /(^|\.)youtube(-nocookie)?\.com$|(^|\.)youtu\.be$/, label: 'YouTube video' },
  { test: /(^|\.)vimeo\.com$/,                 label: 'Vimeo video' },
  { test: /(^|\.)officeapps\.live\.com$|(^|\.)sharepoint\.com$|(^|\.)onedrive\.live\.com$/, label: 'Office document' },
  { test: /(^|\.)instructure\.com$/,           label: 'Canvas file' },
  { test: /(^|\.)h5p\.com$|(^|\.)edpuzzle\.com$|(^|\.)quizlet\.com$/, label: 'Embedded activity' },
]

/**
 * Describes one embed for display.
 *
 * `stale` marks the cases that are already broken for students, not merely
 * unrenderable in the preview — those are the ones worth flagging visually.
 *
 * @param {string} src       The embed's src/data attribute.
 * @param {string} tagName   'IFRAME' | 'OBJECT' | 'EMBED'.
 * @returns {{ label: string, stale: boolean }}
 */
export function describeEmbed(src, tagName = 'IFRAME') {
  // Flash is worth calling out by name: no browser has run it since 2020, so
  // its presence is a definitive "this content is stale".
  if (/\.swf(\?|#|$)/i.test(src ?? '')) {
    return { label: 'Flash content — no longer supported by any browser', stale: true }
  }
  if (!src) {
    return { label: `Embedded ${String(tagName).toLowerCase()} with no source`, stale: true }
  }

  let host = ''
  let insecure = false
  try {
    // The base only matters for protocol-relative and root-relative sources;
    // an absolute src ignores it.
    const url = new URL(src, 'https://example.invalid')
    host = url.hostname
    insecure = url.protocol === 'http:'
  } catch {
    return { label: 'Embedded content', stale: false }
  }

  const provider = PROVIDERS.find(p => p.test.test(host))
  const label = provider ? provider.label : `Embedded content from ${host || 'an unknown source'}`

  // An http:// embed is blocked as mixed content on Canvas's https pages, so it
  // is already broken for students.
  return {
    label: insecure ? `${label} — loaded over insecure http://` : label,
    stale: insecure,
  }
}
