/**
 * Skeleton — a placeholder shimmer standing in for content that is still loading.
 *
 * Tier 1 atom. Canonicalizes the identical `bg-[var(--color-border)] animate-pulse`
 * placeholder blocks already used in 4 tools (assignment rows, grading dashboard,
 * missing-work list, the virtual table). Those were the only *already* fully
 * token-compliant hand-rolls in the codebase, so this promotion is a lift, not a
 * restyle — the visual output is unchanged.
 *
 * Accessibility: a skeleton is purely decorative — it conveys no information a
 * screen-reader user needs, and the shimmer must not be announced. So it is
 * `aria-hidden`. The *container* that swaps skeletons for real content should
 * carry `aria-busy={true}` while loading; that is the consumer's responsibility,
 * not this atom's (a single bar has no way to know the whole region is busy).
 *
 * @param {string} [width='100%']   Any CSS width (e.g. '8rem', '60%').
 * @param {string} [height='0.875rem']  Any CSS height. rem so it tracks text size.
 * @param {boolean} [circle=false]  Fully round (for avatar/icon placeholders).
 * @param {string} [className='']   Extra utilities (margins, alignment).
 * @param {object} [rest]           Passed to the element (data-*, style overrides).
 */
export default function Skeleton({
  width = '100%',
  height = '0.875rem',
  circle = false,
  className = '',
  ...rest
}) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-[var(--color-border)] ${circle ? 'rounded-full' : 'rounded'} ${className}`.trim()}
      style={{ width, height, ...(circle ? { aspectRatio: '1 / 1' } : null) }}
      {...rest}
    />
  )
}
