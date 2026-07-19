import { ChevronUp, ChevronDown } from 'lucide-react'
import TextField from './TextField.jsx'

/**
 * NumberField — a numeric input with custom, theme-styled increment controls.
 *
 * Tier 1 atom. Promotes the 11 `type="number"` inputs across the tools. Split
 * out from TextField because the browser's native spin buttons are unstyleable
 * and paint as light OS widgets on the app's dark surfaces. Here the native
 * spinners are hidden (`::-webkit-*-spin-button { appearance: none }` — Chromium
 * is MV3's only target) and replaced with a stacked ChevronUp/ChevronDown pair
 * hugging the input's right edge, mirroring the familiar native layout with a
 * paint we control.
 *
 * Composes TextField (so it inherits the `.input` styling and the value-based
 * onChange contract). Keyboard users keep native ↑/↓ increment on the focused
 * input — the chevron buttons are pointer affordances, so they are `tabIndex=-1`
 * (no duplicate tab stops) but keep `aria-label`s for pointer/AT users.
 *
 * @param {string|number} value
 * @param {(next: string) => void} onChange  Handed the next value string.
 * @param {number} [min]  Lower clamp (also disables the down chevron at the floor).
 * @param {number} [max]  Upper clamp (also disables the up chevron at the ceiling).
 * @param {number} [step=1]  Increment; decimal steps keep their precision.
 * @param {boolean} [disabled=false]
 * @param {string} [id]  Wire to a FieldLabel's htmlFor.
 * @param {string} [className='']
 * @param {object} [rest]  Passed through to the input (placeholder, aria-*, …).
 */
export default function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  id,
  className = '',
  ...rest
}) {
  const stepNum = Number(step) || 1
  const decimals = (String(step).split('.')[1] || '').length

  const current = () => {
    const n = parseFloat(value)
    return Number.isNaN(n) ? null : n
  }
  const clamp = (n) => {
    let v = n
    if (min != null && v < Number(min)) v = Number(min)
    if (max != null && v > Number(max)) v = Number(max)
    return v
  }
  const bump = (dir) => {
    if (disabled) return
    const cur = current()
    const base = cur == null ? (min != null ? Number(min) : 0) : cur
    const next = Number(clamp(base + dir * stepNum).toFixed(decimals))
    onChange?.(String(next))
  }

  const cur = current()
  const atMax = max != null && cur != null && cur >= Number(max)
  const atMin = min != null && cur != null && cur <= Number(min)

  const stepBtn =
    'flex-1 flex items-center justify-center px-1 rounded leading-none ' +
    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] ' +
    'hover:bg-[var(--color-bg-hover)] disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div className="relative">
      <TextField
        type="number"
        value={value}
        onChange={onChange}
        disabled={disabled}
        id={id}
        min={min}
        max={max}
        step={step}
        className={`pr-7 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`.trim()}
        {...rest}
      />
      <div className="absolute right-1 top-1 bottom-1 flex flex-col gap-px w-5">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase"
          disabled={disabled || atMax}
          onClick={() => bump(1)}
          className={stepBtn}
        >
          <ChevronUp size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease"
          disabled={disabled || atMin}
          onClick={() => bump(-1)}
          className={stepBtn}
        >
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
