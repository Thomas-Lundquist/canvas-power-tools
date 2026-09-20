import { useMemo, useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import IconButton from './IconButton.jsx'
import Callout from './Callout.jsx'
import Spinner from './Spinner.jsx'
import Badge from './Badge.jsx'
import { describeEmbed } from '../utils/contentEmbeds.js'

/**
 * ContentPreview — shows what a page or assignment actually looks like, in a
 * pane docked to the right of the table.
 *
 * Deliberately **not** a modal, and deliberately not built on SlideOver: both
 * lay a scrim over the page and set `aria-modal`, which makes the table inert
 * and costs exactly the context this pane exists to keep. Here the table stays
 * live, so hitting Preview on the next row swaps the pane's content in place
 * and you can walk a course a row at a time without anything closing.
 *
 * Layout contract: render this as a **flex child beside the table**, not as an
 * overlay — it shrinks the content area rather than covering it:
 *
 *     <div className="flex-1 flex min-h-0">
 *       <div className="flex-1 flex flex-col min-h-0">{table}</div>
 *       {preview && <ContentPreview … />}
 *     </div>
 *
 * The content itself renders in a sandboxed iframe. Two reasons:
 *
 *  1. Safety. `sandbox=""` grants no permissions at all — no scripts, no forms,
 *     no same-origin access, no navigation — so the HTML cannot touch the
 *     extension page around it. Images and styles still load, which is the
 *     whole point of a visual preview.
 *  2. Fidelity. An iframe gets its own document and stylesheet, so the app's
 *     design tokens don't bleed in and repaint old content to look current.
 *
 * The content surface stays white in dark mode on purpose: course content is
 * authored against Canvas's white background, and "does this look dated?" is
 * only answerable against the background students actually see.
 *
 * Embeds are not rendered — see `extractEmbeds`.
 */

/**
 * The pane's docked width, for callers that need to reserve the same space —
 * the fixed bulk action bars re-centre against it.
 *
 * The value itself lives in global.css (`--cpt-pane-width` / `--cpt-pane-inset`)
 * because the right answer is a layout mode, not a number: past a breakpoint
 * there is no width at which a usable pane and a readable table both fit, so the
 * pane switches from docking to overlaying. Only a media query can make that
 * call, and the inset has to go to zero in the same breath.
 */
export const PREVIEW_PANE_INSET = 'var(--cpt-pane-inset)'

// A deliberately plain stylesheet, close to Canvas's own content defaults.
// Anything more opinionated would flatter old content and defeat the purpose.
const FRAME_STYLES = `
  html { background: #ffffff; }
  body {
    margin: 0;
    padding: 1.25rem;
    background: #ffffff;
    color: #2d3b45;
    font-family: "Lato", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
    overflow-wrap: break-word;
  }
  img, video, table { max-width: 100%; }
  img, video { height: auto; }
  table { border-collapse: collapse; }
  a { color: #0374b5; }
  .cpt-embed {
    border: 2px dashed #c7cdd1;
    border-radius: 6px;
    background: #f5f5f5;
    color: #556572;
    padding: 1rem;
    margin: 0.75rem 0;
    font-size: 0.875rem;
  }
  .cpt-embed-label { font-weight: 700; display: block; margin-bottom: 0.25rem; }
  .cpt-embed-src {
    display: block; font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.75rem; color: #6b7780; overflow-wrap: anywhere;
  }
`

/**
 * Replaces every iframe/object/embed with a labelled placeholder and returns
 * the list separately.
 *
 * A nested iframe inherits its parent's sandbox flags, so a Drive or Office
 * viewer inside our sandboxed frame gets neither scripts nor cookies and
 * renders as the browser's broken-frame box. Loosening the sandbox is not an
 * option — `allow-scripts` together with `allow-same-origin` lets framed
 * content strip its own sandbox attribute — so the embed is described rather
 * than attempted. Its position in the layout is still shown, and the links are
 * rendered outside the frame where they can actually be clicked.
 *
 * DOMParser is inert: it runs no scripts and fetches no subresources.
 */
function extractEmbeds(html) {
  if (!html) return { html: '', embeds: [] }

  let doc
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return { html, embeds: [] }
  }

  const embeds = []
  for (const node of doc.querySelectorAll('iframe, object, embed')) {
    const src = node.getAttribute('src') || node.getAttribute('data') || ''
    const { label, stale } = describeEmbed(src, node.tagName)
    embeds.push({ id: embeds.length, src, label, stale })

    const card = doc.createElement('div')
    card.className = 'cpt-embed'
    const labelEl = doc.createElement('span')
    labelEl.className = 'cpt-embed-label'
    labelEl.textContent = label
    card.appendChild(labelEl)
    if (src) {
      const srcEl = doc.createElement('span')
      srcEl.className = 'cpt-embed-src'
      srcEl.textContent = src
      card.appendChild(srcEl)
    }
    node.replaceWith(card)
  }

  return { html: doc.body.innerHTML, embeds }
}

function buildSrcDoc(html) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${FRAME_STYLES}</style>
</head>
<body>${html}</body>
</html>`
}

function hasVisibleContent(html, embeds) {
  if (embeds.length > 0) return true
  if (!html) return false
  // Text, or any embedded media — a page that is only an image still has
  // something to look at.
  if (html.replace(/<[^>]*>/g, '').trim()) return true
  return /<(img|video|table|hr)\b/i.test(html)
}

/**
 * @param {string} title       What is being previewed — shown in the pane header.
 * @param {string} [subtitle]  Optional context line (e.g. published state).
 * @param {string} [html]      The content HTML. Ignored while `loading`.
 * @param {boolean} [loading]  Content is still being fetched.
 * @param {string} [error]     Fetch failed; shown instead of the frame.
 * @param {string} [emptyNote] Replaces the default text when there is nothing to show.
 * @param {string} [width]     Overrides the stylesheet's --cpt-pane-width.
 * @param {() => void} onClose
 */
export default function ContentPreview({
  title, subtitle, html, loading = false, error = null, emptyNote, width, onClose,
}) {
  const { html: safeHtml, embeds } = useMemo(() => extractEmbeds(html), [html])
  const showFrame = !loading && !error && hasVisibleContent(safeHtml, embeds)

  // Escape closes, as it would for a dialog. Focus is deliberately *not*
  // trapped or stolen: the pane is non-modal, and pulling focus out of the
  // table would undo the point of keeping the table live.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      role="complementary"
      aria-label="Content preview"
      className="cpt-preview-pane shrink-0 flex flex-col min-h-0 mt-4 mb-4 mr-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-md)] overflow-hidden"
      style={{ ...(width ? { width } : null), animation: 'slide-over-in 0.2s ease-out' }}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--color-text-body)] truncate" title={title}>
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>
        <IconButton icon={X} label="Close preview" onClick={onClose} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3" aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="py-12">
            <Spinner label="Loading preview…" showLabel />
          </div>
        )}

        {!loading && error && (
          <Callout tone="error" title="Could not load this content">{error}</Callout>
        )}

        {!loading && !error && !showFrame && (
          <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            {emptyNote ?? 'There is no content here to preview.'}
          </p>
        )}

        {showFrame && (
          <>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] overflow-hidden">
              <iframe
                title={`Preview of ${title}`}
                srcDoc={buildSrcDoc(safeHtml)}
                sandbox=""
                referrerPolicy="no-referrer"
                className="block w-full h-[65vh] min-h-[26rem] bg-white"
              />
            </div>

            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Shown on a white background, as students see it. Interactive elements are disabled.
            </p>

            {embeds.length > 0 && <EmbedList embeds={embeds} />}
          </>
        )}
      </div>
    </aside>
  )
}

function EmbedList({ embeds }) {
  return (
    <section className="mt-4 pt-4 border-t border-[var(--color-border)]">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-body)]">
        Embedded content
        <Badge tone="neutral">{embeds.length}</Badge>
      </h3>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        Embeds can&apos;t run inside the preview. Open one to check it still works.
      </p>
      <ul className="mt-2 space-y-2">
        {embeds.map(embed => (
          <li
            key={embed.id}
            className="rounded-[var(--radius-card)] border px-3 py-2"
            style={{
              borderColor: embed.stale ? 'var(--color-warning)' : 'var(--color-border)',
              background: embed.stale
                ? 'color-mix(in srgb, var(--color-warning) 8%, transparent)'
                : 'transparent',
            }}
          >
            <p className="text-sm text-[var(--color-text-body)]">{embed.label}</p>
            {embed.src && (
              <a
                href={embed.src}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-xs underline break-all"
                style={{ color: 'var(--cpt-color)' }}
              >
                {embed.src}
                <ExternalLink size={11} aria-hidden="true" className="shrink-0" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
