import Card from './Card.jsx'

/**
 * StatCard — a single labelled metric (label + prominent value), for dashboards.
 *
 * Tier 2 composition (built on the Card atom). Canonicalizes the metric tiles
 * the tools lay out in `grid grid-cols-3 gap-4` blocks (GradingDashboard,
 * GradeAdjustments, Template stats, …). StatCard renders *one* tile; the grid
 * itself stays the consumer's layout choice — LEGO over a baked-in grid, so the
 * same tile works in a 2-, 3-, or 4-column layout.
 *
 * The label reuses the shared `.section-label` class; the value uses a rem
 * font-size so it scales with the user's text-size setting.
 *
 * @param {React.ReactNode} label  Short metric name (e.g. "Ungraded").
 * @param {React.ReactNode} value  The number/figure — the prominent element.
 * @param {React.ComponentType<{ size?: number }>} [icon]  Optional decorative Lucide icon.
 * @param {React.ReactNode} [hint]  Optional sub-line (e.g. "of 128 total").
 * @param {string} [className='']
 * @param {object} [rest]  Passed to the underlying Card.
 */
const VALUE_TEXT = '1.5rem' // ~24px, prominent but tracks text-size

export default function StatCard({ label, value, icon: Icon, hint, className = '', ...rest }) {
  return (
    <Card padding="md" className={className} {...rest}>
      <div className="flex items-center gap-3">
        {Icon && (
          <span
            className="shrink-0 flex items-center justify-center rounded-md"
            style={{
              width: '2.25rem',
              height: '2.25rem',
              background: 'color-mix(in srgb, var(--cpt-color) 12%, white)',
              color: 'var(--cpt-color-dark)',
            }}
          >
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <div className="section-label" style={{ marginBottom: '0.125rem' }}>
            {label}
          </div>
          <div
            className="font-semibold leading-none text-[var(--color-text-body)] truncate"
            style={{ fontSize: VALUE_TEXT }}
          >
            {value}
          </div>
          {hint && (
            <div className="text-xs text-[var(--color-text-muted)]" style={{ marginTop: '0.25rem' }}>
              {hint}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
