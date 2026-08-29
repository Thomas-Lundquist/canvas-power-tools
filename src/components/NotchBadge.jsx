/**
 * NotchBadge — a small label that overlaps a card's top border, the signature
 * Bauhaus card marker from the reference screens. Tier-1 brick: pass the
 * module's domain color and the same badge re-tints per module.
 *
 * The parent card must be `position: relative`. `list-row-meta` supplies the
 * monospace treatment under the Bauhaus theme only; colors come from tokens so
 * the badge stays a no-op tint under other themes.
 *
 * @param {React.ReactNode} children  The label text.
 * @param {string} [color]  A domain color token; defaults to Communication.
 */
export default function NotchBadge({ children, color = 'var(--color-domain-communication)' }) {
  return (
    <span
      className="list-row-meta absolute -top-2.5 left-3 z-[1] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider"
      style={{ backgroundColor: color, color: 'var(--primary-contrast)' }}
    >
      {children}
    </span>
  )
}
