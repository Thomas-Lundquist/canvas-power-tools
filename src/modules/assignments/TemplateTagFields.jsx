import FieldLabel from '../../components/FieldLabel.jsx'
import TextField from '../../components/TextField.jsx'
import { Sparkles } from 'lucide-react'
import { AUTO_TAGS } from './templateTags.js'

// Turns a tag name into the label a teacher reads: chapter_number → "Chapter number"
export function tagLabel(name) {
  const words = name.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// The fill-in step for a template's prompted tags. Auto tags are listed as
// resolved-for-you context so the teacher can see the whole substitution at once
// rather than wondering why {course_name} has no input.
//
// tags: [{ name, auto }] from extractTags()
export default function TemplateTagFields({ tags, values, onChange, idPrefix = 'tag' }) {
  const prompted = tags.filter(t => !t.auto)
  const auto = tags.filter(t => t.auto)

  if (tags.length === 0) return null

  return (
    <div className="space-y-4">
      {prompted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prompted.map(tag => (
            <div key={tag.name} className="space-y-1">
              <FieldLabel htmlFor={`${idPrefix}-${tag.name}`} required>
                {tagLabel(tag.name)}
              </FieldLabel>
              <TextField
                id={`${idPrefix}-${tag.name}`}
                value={values[tag.name] ?? ''}
                onChange={v => onChange(tag.name, v)}
                placeholder={`Value for {${tag.name}}`}
              />
            </div>
          ))}
        </div>
      )}

      {auto.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)] flex items-start gap-1.5">
          <Sparkles size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Filled in automatically:{' '}
            {auto.map((tag, i) => (
              <span key={tag.name}>
                {i > 0 && ', '}
                <code className="font-mono">{`{${tag.name}}`}</code>
              </span>
            ))}
          </span>
        </p>
      )}
    </div>
  )
}

// Every prompted tag needs a value before a deploy can run — a blank would
// otherwise ship the literal `{chapter}` into a real Canvas assignment.
export function missingTagValues(tags, values) {
  return tags
    .filter(t => !t.auto)
    .filter(t => !(values[t.name] ?? '').trim())
    .map(t => t.name)
}

export { AUTO_TAGS }
