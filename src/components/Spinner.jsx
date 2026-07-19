import { Loader2 } from 'lucide-react'

/**
 * Spinner — a busy indicator for in-flight work (loading, saving, fetching).
 *
 * Tier 1 atom. Canonicalizes the 16 hand-rolled `<Loader … className="animate-spin" />`
 * usages scattered across the tools (assignment loads, deploy progress, grading
 * fetches, …) into one accessible component.
 *
 * Accessibility: the wrapper is `role="status"`, which is an implicit
 * `aria-live="polite"` region — screen readers announce `label` when the
 * spinner mounts, and again if it changes. `label` is therefore required (it
 * carries the meaning); pass `showLabel` to also render it visibly beside the
 * glyph, otherwise it stays visually hidden but still announced. The spinning
 * glyph itself is decorative (`aria-hidden`) since the text already conveys state.
 *
 * @param {'sm'|'md'|'lg'} [size='md']  Glyph size; label text tracks it.
 * @param {string} [label='Loading…']   Accessible status text. Announced to SR.
 * @param {boolean} [showLabel=false]    Render `label` visibly next to the glyph.
 * @param {boolean} [inline=false]       Inline flow (in a button/row) vs. centered block.
 * @param {object} [rest]                Passed to the wrapper (className, data-*, …).
 */

// Glyph size in px — an exception to the rem rule (doc 10: px allowed for small
// fixed glyphs). Label text sizes are rem so they track the user's text-size setting.
const SIZE_PX = { sm: 14, md: 18, lg: 24 }
const LABEL_TEXT = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }

export default function Spinner({
  size = 'md',
  label = 'Loading…',
  showLabel = false,
  inline = false,
  ...rest
}) {
  const layout = inline
    ? 'inline-flex items-center gap-2 align-middle'
    : 'flex items-center justify-center gap-2'

  return (
    <span role="status" className={layout} {...rest}>
      <Loader2
        size={SIZE_PX[size]}
        className="animate-spin shrink-0"
        style={{ color: 'var(--cpt-color)' }}
        aria-hidden="true"
      />
      <span
        className={showLabel ? `${LABEL_TEXT[size]} text-[var(--color-text-secondary)]` : 'sr-only'}
      >
        {label}
      </span>
    </span>
  )
}
