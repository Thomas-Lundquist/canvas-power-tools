import { useRef } from 'react'

/**
 * SegmentedToggle — pick exactly one option from 2–4 mutually exclusive choices.
 *
 * Tier 1 atom. Canonicalizes the Grade Outreach segmented control (which
 * replaced radio groups) into a reusable, fully-accessible control. Reuses the
 * shared `.segmented-control` class for its visuals and upgrades the semantics
 * from a toggle-button group to a proper WAI-ARIA radiogroup.
 *
 * Keyboard (the control's defining behavior): the group is one Tab stop via
 * roving tabindex; Arrow keys move selection (and focus), wrapping around;
 * Home/End jump to the first/last. Selecting fires `onChange`.
 *
 * Use only for 2–4 options — more than that is a <select>, not a toggle.
 *
 * @param {{ value: string, label: string, icon?: React.ComponentType }[]} options
 * @param {string} value      The currently selected option value.
 * @param {(next: string) => void} onChange
 * @param {string} ariaLabel  Names the group (it has no visible label).
 */
export default function SegmentedToggle({ options, value, onChange, ariaLabel }) {
  const refs = useRef([])
  const selectedIndex = options.findIndex((o) => o.value === value)

  const selectAt = (i) => {
    onChange(options[i].value)
    refs.current[i]?.focus()
  }

  const handleKeyDown = (e, i) => {
    const last = options.length - 1
    let target
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = i === last ? 0 : i + 1
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        target = i === 0 ? last : i - 1
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = last
        break
      default:
        return
    }
    e.preventDefault()
    selectAt(target)
  }

  return (
    <div className="segmented-control" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt, i) => {
        const selected = opt.value === value
        const Icon = opt.icon
        // Roving tabindex: the checked segment is the group's single tab stop.
        // If nothing is selected yet, the first segment holds it, so the group
        // is always reachable by keyboard.
        const tabbable = selected || (selectedIndex === -1 && i === 0)
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="inline-flex items-center gap-1.5"
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
