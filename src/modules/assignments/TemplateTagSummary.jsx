import { useState } from 'react'
import { Sparkles, HelpCircle, PenLine } from 'lucide-react'
import { AUTO_TAGS } from './templateTags.js'

// A chip carries its meaning in its icon and label text, not its color alone
// (CLAUDE.md accessibility: never color as the sole indicator).
function TagChip({ name, auto }) {
  const Icon = auto ? Sparkles : PenLine
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border px-1.5 py-0.5 font-mono text-xs"
      style={{
        borderColor: auto ? 'var(--color-border)' : 'var(--cpt-color)',
        color: auto ? 'var(--color-text-secondary)' : 'var(--cpt-color)',
      }}
    >
      <Icon size={11} aria-hidden="true" />
      {`{${name}}`}
      <span className="sr-only">{auto ? ' — filled in automatically' : ' — you fill this in at deploy'}</span>
    </span>
  )
}

// Live summary of the tags a template uses, shown as the teacher types.
// tags: [{ name, auto }] from extractTags()
export default function TemplateTagSummary({ tags }) {
  const [showHelp, setShowHelp] = useState(false)
  const prompted = tags.filter(t => !t.auto)
  const auto = tags.filter(t => t.auto)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="section-label !mb-0">Template Tags</h3>
        <button
          type="button"
          onClick={() => setShowHelp(v => !v)}
          aria-expanded={showHelp}
          className="inline-flex items-center gap-1 text-xs font-normal normal-case tracking-normal text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)] transition-colors duration-75"
        >
          <HelpCircle size={13} aria-hidden="true" />
          {showHelp ? 'Hide tag help' : 'How tags work'}
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No tags yet. Type something like <code className="font-mono">{'{unit}'}</code> in the name or
          instructions and you'll be asked for its value each time you deploy.
        </p>
      ) : (
        <div className="space-y-2">
          {prompted.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--color-text-muted)]">You fill in at deploy:</span>
              {prompted.map(t => <TagChip key={t.name} {...t} />)}
            </div>
          )}
          {auto.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--color-text-muted)]">Filled in automatically:</span>
              {auto.map(t => <TagChip key={t.name} {...t} />)}
            </div>
          )}
        </div>
      )}

      {showHelp && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-3 space-y-3 text-xs text-[var(--color-text-secondary)]">
          <p>
            Write a tag as <code className="font-mono">{'{name}'}</code> in the name or instructions. Lowercase
            letters, numbers, and underscores. Anything that isn't in the list below becomes a field you fill
            in when you deploy — so <code className="font-mono">{'{unit}'}</code> asks you for the unit.
          </p>
          <div>
            <p className="font-medium text-[var(--color-text-body)] mb-1">Filled in automatically</p>
            <ul className="space-y-0.5">
              {AUTO_TAGS.map(tag => (
                <li key={tag.name} className="flex items-baseline gap-2">
                  <code className="font-mono shrink-0">{`{${tag.name}}`}</code>
                  <span>{tag.label} — e.g. {tag.example}</span>
                </li>
              ))}
            </ul>
          </div>
          <p>
            To show a literal brace, double it: <code className="font-mono">{'{{unit}}'}</code> deploys as{' '}
            <code className="font-mono">{'{unit}'}</code>.
          </p>
        </div>
      )}
    </div>
  )
}
