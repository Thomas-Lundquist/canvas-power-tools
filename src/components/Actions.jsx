/**
 * Actions — a horizontal row of buttons with consistent gap and alignment.
 *
 * Tier 1 atom. Canonicalizes the 16 tools that hand-roll `flex gap-3 justify-end`
 * footer/action rows (form submits, dialog confirm/cancel, toolbar clusters).
 * It owns only the *layout contract* — the gap (from the space scale) and the
 * alignment — and takes Button/IconButton children, so it composes with the
 * button atoms rather than duplicating them.
 *
 * Wraps on narrow widths (`flex-wrap`) so a crowded action row degrades
 * gracefully instead of overflowing.
 *
 * @param {'start'|'center'|'end'|'between'} [align='end']  Main-axis distribution.
 *   'end' is the default because confirm/cancel rows sit bottom-right.
 * @param {string} [className='']
 * @param {React.ReactNode} children  The buttons.
 * @param {object} [rest]  Passed to the <div> (role, aria-*, …).
 */
const ALIGN = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
}

export default function Actions({ align = 'end', className = '', children, ...rest }) {
  return (
    <div
      className={`flex items-center flex-wrap ${ALIGN[align] ?? ALIGN.end} ${className}`.trim()}
      style={{ gap: 'var(--space-3)' }}
      {...rest}
    >
      {children}
    </div>
  )
}
