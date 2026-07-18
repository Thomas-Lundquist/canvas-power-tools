/**
 * Badge — a small, non-interactive status/label pill.
 *
 * Tier 1 atom. Canonicalizes two hand-rolled patterns into one component:
 *   - the "Published / Unpublished" pill in AssignmentTable
 *   - the 📝/📄 type tags in Templates
 *
 * Static by design: no hover, no focus, not interactive. Color is never the
 * sole carrier of meaning — the label text always states what the badge means
 * (WCAG 1.4.1). Any icon is decorative and marked aria-hidden.
 *
 * @param {'neutral'|'success'|'warning'|'danger'|'muted'|'accent'} [tone='neutral']
 * @param {React.ComponentType<{ size?: number, 'aria-hidden'?: boolean }>} [icon]
 *   Optional Lucide icon component, rendered before the label.
 * @param {React.ReactNode} children  The label. Required — carries the meaning.
 */

// Micro type scale from the design language (doc 10). rem so it tracks the
// user's text-size preference (:root font-size), unlike a px value.
const MICRO_TEXT = '0.75rem';

// Icon size in px — an exception to the rem rule (doc: px is allowed for
// borders and small fixed glyphs). 12px optically matches 0.75rem text.
const ICON_PX = 12;

/**
 * tint() — derive a light pill background from a solid semantic token.
 *
 * The status tokens (--color-success etc.) are dark, tuned to read as *text*.
 * A pill wants a pale wash of that same hue behind dark text. color-mix lets
 * us compute "N% of the token, rest white" at paint time, so we keep one
 * source of truth: when bead 1yr.1 re-themes --color-success, every success
 * badge re-tints itself. Chromium (MV3's only target) supports color-mix.
 */
const tint = (token, pct) => `color-mix(in srgb, var(${token}) ${pct}%, white)`;

/**
 * TONE_STYLES — maps each tone to the inline CSS it paints: a tinted
 * background, an accessible (>=4.5:1) text color, and optionally a border.
 *
 * Reconciliations vs. the doc-10 spec (which assumed a token scale not yet
 * built): danger -> --color-error (that's the real token name); muted ->
 * grey surface/text tokens; accent uses --cpt-color-dark for its label as
 * the spec's contrast guard, since brand-on-brand-tint can fail 4.5:1.
 */
const TONE_STYLES = {
  // Quiet default: an outlined pill, no fill — recedes next to a colored one.
  neutral: {
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-body)',
    border: '1px solid var(--color-border)',
  },
  success: {
    background: tint('--color-success', 12),
    color: 'var(--color-success)',
  },
  // Amber reads lighter than the others, so it needs a slightly heavier wash.
  warning: {
    background: tint('--color-warning', 15),
    color: 'var(--color-warning)',
  },
  danger: {
    background: tint('--color-error', 12),
    color: 'var(--color-error)',
  },
  // The grey world — for de-emphasized labels (e.g. Templates type tags).
  muted: {
    background: 'var(--color-bg-hover)',
    color: 'var(--color-text-muted)',
  },
  // Brand tint behind the darker brand shade to stay above 4.5:1 contrast.
  accent: {
    background: tint('--cpt-color', 12),
    color: 'var(--cpt-color-dark)',
  },
};

export default function Badge({ tone = 'neutral', icon: Icon, children }) {
  const style = TONE_STYLES[tone] ?? TONE_STYLES.neutral ?? {};

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-medium leading-none whitespace-nowrap"
      style={{
        fontSize: MICRO_TEXT,
        // var(--token, fallback): uses the literal today, auto-upgrades to the
        // spacing scale the moment bead 1yr.1 lands the real --space-* tokens.
        paddingInline: 'var(--space-2, 0.5rem)',
        paddingBlock: 'var(--space-1, 0.125rem)',
        ...style,
      }}
    >
      {Icon && <Icon size={ICON_PX} aria-hidden="true" />}
      {children}
    </span>
  );
}
