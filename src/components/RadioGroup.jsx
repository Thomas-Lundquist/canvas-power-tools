/**
 * RadioGroup — a set of mutually-exclusive options with a custom-drawn control.
 *
 * Tier 1 atom. Canonicalizes the hand-rolled `<input type="radio">` groups in 4
 * tools (Announcements schedule-mode, ScheduleForm direction, GradeAdjustments
 * apply-to, Accommodations).
 *
 * Custom-drawn to match the branded `Checkbox` atom (same 1rem box, 2px border,
 * `--cpt-color` fill) — a native accent-color radio looked inconsistent beside
 * the hand-drawn checkbox. The trick: a **visually-hidden real `<input
 * type="radio">`** stays in the DOM (so the browser still gives us arrow-key
 * navigation, roving tabindex, and correct screen-reader semantics for free),
 * and the visible circle is a decorative sibling styled off the input's state.
 * Zero accessibility is traded for the custom look.
 *
 * Controlled contract: `onChange` receives the selected option's value.
 *
 * @param {string} name   Shared radio group name (required for exclusivity + arrow-nav).
 * @param {string} value  Currently selected value.
 * @param {(next: string) => void} onChange
 * @param {Array<{ value: string, label: React.ReactNode, disabled?: boolean }>} options
 * @param {string} ariaLabel  Accessible name for the group (no visible legend).
 * @param {boolean} [disabled=false]  Disable every option.
 * @param {string} [className='']
 */
export default function RadioGroup({
  name,
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  className = '',
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex flex-col gap-2 ${className}`.trim()}>
      {options.map((o) => {
        const optDisabled = disabled || o.disabled
        const checked = value === o.value
        return (
          <label
            key={o.value}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-body)]"
            style={{ cursor: optDisabled ? 'not-allowed' : 'pointer', opacity: optDisabled ? 0.5 : 1 }}
          >
            {/* Real radio, visually hidden — keeps native keyboard/group a11y. `peer`
                lets the visual sibling react to its focus-visible state. */}
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange?.(o.value)}
              disabled={optDisabled}
              className="sr-only peer"
            />
            {/* Custom visual — mirrors Checkbox's box (w-4 h-4, border-2) as a circle
                with a filled center dot when selected. */}
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full border-2 shrink-0 transition-all peer-focus-visible:ring-2"
              style={{
                borderColor: checked ? 'var(--cpt-color)' : '#d1d5db',
                backgroundColor: 'white',
                '--tw-ring-color': 'var(--cpt-color)',
              }}
            >
              {checked && (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--cpt-color)' }} />
              )}
            </span>
            {o.label}
          </label>
        )
      })}
    </div>
  )
}
