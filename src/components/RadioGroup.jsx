/**
 * RadioGroup — a set of mutually-exclusive options.
 *
 * Tier 1 atom. Canonicalizes the hand-rolled `<input type="radio">` groups in 4
 * tools (Announcements schedule-mode, ScheduleForm direction, GradeAdjustments
 * apply-to, Accommodations) into one component.
 *
 * Native radios on purpose: within a shared `name`, the browser gives you
 * arrow-key navigation, roving tabindex, and correct screen-reader semantics for
 * free. The wrapper is `role="radiogroup"` with `aria-label` so the set is
 * announced as one labelled group. Each radio uses `accent-color` (the
 * `--cpt-color` brand) rather than a custom-drawn control, keeping it native and
 * accessible.
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
        return (
          <label
            key={o.value}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-body)]"
            style={{ cursor: optDisabled ? 'not-allowed' : 'pointer', opacity: optDisabled ? 0.5 : 1 }}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange?.(o.value)}
              disabled={optDisabled}
              className="accent-[var(--cpt-color)] shrink-0"
            />
            {o.label}
          </label>
        )
      })}
    </div>
  )
}
