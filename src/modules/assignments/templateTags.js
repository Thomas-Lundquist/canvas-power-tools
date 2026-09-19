// Template tags — the two-tier dynamic variable system for Assignment Templates.
//
// Syntax is `{snake_case}`, matching the personalization tokens the Communication
// module already uses (see modules/communication/tokenHelpers.js). One syntax,
// two resolution sources:
//
//   auto     — resolved silently from deploy context ({course_name}, {due_date}…)
//   prompted — anything else; the teacher fills it in once at deploy time
//
// Templates store instructions as an *unresolved* string (design doc 03,
// Decision 12); resolution happens only on the way into Canvas.
//
// A doubled brace escapes a literal: `{{points}}` renders as `{points}` and is
// never treated as a tag. This matters because instructions are verbatim Canvas
// HTML and may legitimately contain braces (code samples, math).

// One pass handles escapes and tags together, so an escaped brace can never be
// re-read as a tag and no placeholder sentinel is needed.
// Alternation order matters: `{{` must win over `{` at the same position.
const SCAN_PATTERN = /\{\{|\}\}|\{([a-z][a-z0-9_]{1,39})\}/g

// The auto-tag registry. `resolve` receives the deploy context and returns a
// string. Order here is the order shown in the editor's help list.
export const AUTO_TAGS = [
  {
    name: 'course_name',
    label: 'Course name',
    example: 'Culinary 1',
    resolve: ctx => ctx.course?.name ?? '',
  },
  {
    name: 'course_code',
    label: 'Course code',
    example: 'CUL1-03',
    resolve: ctx => ctx.course?.courseCode ?? '',
  },
  {
    name: 'course_term',
    label: 'Term',
    example: 'Fall 2026',
    resolve: ctx => ctx.course?.term ?? '',
  },
  {
    name: 'due_date',
    label: 'Due date',
    example: 'October 3, 2026',
    resolve: ctx => formatDate(ctx.dueAt),
  },
  {
    name: 'today',
    label: "Today's date",
    example: 'September 18, 2026',
    resolve: ctx => formatDate(ctx.today ?? new Date()),
  },
  {
    name: 'teacher_name',
    label: 'Teacher name',
    example: 'Mr. Lundquist',
    resolve: ctx => ctx.teacherName ?? '',
  },
]

const AUTO_TAG_NAMES = new Set(AUTO_TAGS.map(t => t.name))

export function isAutoTag(name) {
  return AUTO_TAG_NAMES.has(name)
}

// Canvas timestamps are ISO 8601 UTC; display dates are local (CLAUDE.md, Canvas API §5).
function formatDate(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Finds every tag across one or more strings, in first-appearance order.
// Returns [{ name, auto }] — deduplicated. Escaped braces yield nothing.
export function extractTags(sources) {
  const list = Array.isArray(sources) ? sources : [sources]
  const seen = new Set()
  const tags = []

  for (const source of list) {
    if (typeof source !== 'string' || !source) continue
    for (const match of source.matchAll(SCAN_PATTERN)) {
      const name = match[1]
      if (!name || seen.has(name)) continue
      seen.add(name)
      tags.push({ name, auto: isAutoTag(name) })
    }
  }

  return tags
}

// Convenience: just the tags the teacher has to fill in.
export function promptedTags(sources) {
  return extractTags(sources).filter(t => !t.auto).map(t => t.name)
}

// Builds the auto-tag value map for one deploy target.
// ctx: { course, dueAt, teacherName, today }
export function buildAutoValues(ctx = {}) {
  const values = {}
  for (const tag of AUTO_TAGS) {
    values[tag.name] = tag.resolve(ctx)
  }
  return values
}

// Substitutes tags in `text`. Tags with no value in `values` are left exactly as
// written — a missing value must never silently blank out content a teacher
// typed. Escaped braces are restored last so a literal `{course_name}` stays put.
export function resolveTags(text, values = {}) {
  if (typeof text !== 'string' || !text) return text ?? ''
  return text.replace(SCAN_PATTERN, (match, name) => {
    if (match === '{{') return '{'
    if (match === '}}') return '}'
    const value = values[name]
    if (value === undefined || value === null) return match
    return String(value)
  })
}

// Resolves a template's deployable fields for one course.
// Returns a new fields object; the stored template is never mutated.
export function resolveTemplateFields(fields, ctx = {}, promptedValues = {}) {
  const values = { ...buildAutoValues(ctx), ...stripEmpty(promptedValues) }
  return {
    ...fields,
    name: resolveTags(fields.name ?? '', values),
    description: resolveTags(fields.description ?? '', values),
  }
}

// A prompted tag the teacher left blank should fall through to "leave the tag
// alone" rather than replacing it with an empty string.
function stripEmpty(values) {
  const out = {}
  for (const [key, value] of Object.entries(values ?? {})) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    out[key] = value
  }
  return out
}
