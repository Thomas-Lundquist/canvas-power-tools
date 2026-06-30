// Custom checkbox — consistent branded styling across the extension.
// API: <Checkbox checked={bool} onChange={fn(bool)} indeterminate? disabled? ariaLabel? />
// Wrap with a <div onClick={same fn}> to make the label text clickable too.

export function Checkbox({ checked, onChange, indeterminate, disabled, ariaLabel }) {
  const active = checked || indeterminate

  function handleClick(e) {
    e.stopPropagation()
    if (!disabled) onChange?.(!checked)
  }

  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={e => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
          e.preventDefault()
          onChange?.(!checked)
        }
      }}
      onClick={handleClick}
      className="inline-flex items-center justify-center w-4 h-4 rounded shrink-0 border-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2"
      style={{
        backgroundColor: active ? 'var(--cpt-color)' : 'white',
        borderColor: active ? 'var(--cpt-color)' : '#d1d5db',
        opacity: disabled ? 0.5 : 1,
        '--tw-ring-color': 'var(--cpt-color)',
      }}
    >
      {indeterminate && (
        <svg width="8" height="2" viewBox="0 0 8 2" fill="none" aria-hidden="true">
          <path d="M0 1h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {!indeterminate && checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}
