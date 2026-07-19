import { ArrowLeft } from 'lucide-react'

/**
 * PageHeader — the canonical title + action row at the top of a Tool page.
 *
 * Tier 2 composition. Promotes the 3 divergent page-title styles (text-2xl
 * font-bold in three color spellings, plus the text-xl editors) into one
 * title row. Note the weight: the design language pins the page title at
 * 1.5rem / 600 (font-semibold), deliberately *not* the old 700 (font-bold).
 *
 * Renders exactly one <h1> per page, so EmptyState / section titles below it
 * (<h2>) stay inside a correct heading outline.
 *
 * The optional back link is polymorphic to match the app's two navigation
 * realities: pass `to` as a string for a full-page transition (an <a href>,
 * e.g. chrome.runtime.getURL(...)), or as a function for an in-page view/step
 * swap (a <button onClick>, e.g. Templates editor → library, CopyFlow steps).
 *
 * @param {string} title  The page title — carries meaning, becomes the <h1>.
 * @param {{ label: string, to: string | (() => void) }} [back]  Optional back link.
 * @param {React.ReactNode} [actions]  0–2 right-aligned controls (e.g. <Button>).
 * @param {React.ReactNode} [children]  Optional subtitle / context line.
 * @param {object} [rest]  Passed to the wrapper (aria-*, data-*, etc.).
 */
export default function PageHeader({ title, back, actions, children, ...rest }) {
  return (
    <header className="mb-6" {...rest}>
      {back && <BackLink {...back} />}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[var(--color-text-body)]">
            {title}
          </h1>
          {children && (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {children}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-3">{actions}</div>
        )}
      </div>
    </header>
  )
}

const ICON_PX = 14

/**
 * Renders the back link as an <a> when `to` is an href string, or a <button>
 * when `to` is a click handler — a small polymorphism so one prop serves both
 * cross-page (getURL) and in-page (state swap) navigation.
 */
function BackLink({ label, to }) {
  const className =
    'inline-flex items-center gap-1 mb-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)]'

  const content = (
    <>
      <ArrowLeft size={ICON_PX} aria-hidden="true" />
      {label}
    </>
  )

  if (typeof to === 'function') {
    return (
      <button type="button" onClick={to} className={className}>
        {content}
      </button>
    )
  }

  return (
    <a href={to} className={className}>
      {content}
    </a>
  )
}
