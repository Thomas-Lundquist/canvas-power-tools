/**
 * IconButton — a single clickable icon with an accessible label.
 *
 * Tier 1 atom. Canonicalizes the SettingsButton pattern in AppNav and every
 * hand-rolled ghost-icon action (Modal close, Toast dismiss, Rubric edit/trash,
 * row `⋯` triggers) into one component.
 *
 * `label` is required and renders as aria-label + tooltip title — the icon
 * itself is decorative and marked aria-hidden, so an icon-only control still
 * announces meaning to assistive tech. Keyboard focus uses the global
 * :focus-visible ring (3px), so nothing extra is wired here.
 *
 * @param {React.ComponentType<{ size?: number, 'aria-hidden'?: boolean }>} icon  Lucide icon component.
 * @param {string} label       Required. Accessible name + hover tooltip.
 * @param {() => void} [onClick]
 * @param {'ghost'|'danger'} [variant='ghost']
 * @param {'sm'|'md'} [size='md']
 * @param {boolean} [disabled=false]
 * @param {object} [rest]       Passed through to <button> (e.g. aria-haspopup,
 *                              aria-expanded, type, data-*).
 */

// Icon glyph size (px) per control size. px is the sanctioned exception for
// small fixed glyphs; the 2rem hit area below is what actually stays constant.
const ICON_PX = { sm: 16, md: 20 };

// Base: layout + the touch-target floor. min-w/min-h 2rem (= --space-6) keeps
// the tappable area >= 2rem even when size="sm" shrinks the padding/glyph.
const BASE =
  'inline-flex items-center justify-center rounded-lg transition-colors duration-75 ' +
  'min-w-[2rem] min-h-[2rem] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

const SIZE_CLASS = {
  sm: 'p-1.5',
  md: 'p-2',
};

const VARIANT_CLASS = {
  // Transparent → surface-hover on hover; secondary icon that darkens to body.
  ghost:
    'text-[var(--color-text-secondary)] ' +
    'hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-hover)] ' +
    'active:bg-[var(--color-bg-hover)]',
  // Error-colored glyph on a light error wash. color-mix over `transparent`
  // (not white) so the tint sits correctly on any surface it lands on.
  danger:
    'text-[var(--color-error)] ' +
    'hover:bg-[color-mix(in_srgb,var(--color-error)_12%,transparent)] ' +
    'active:bg-[color-mix(in_srgb,var(--color-error)_18%,transparent)]',
};

export default function IconButton({
  icon: Icon,
  label,
  onClick,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  ...rest
}) {
  const className = `${BASE} ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon size={ICON_PX[size]} aria-hidden="true" />
    </button>
  );
}
