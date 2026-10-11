import { toIsoDate } from '../../utils/dates.js'

// Applies a bulk change spec to one assignment's field, returns the new value
export function resolveFieldChange(currentValue, change) {
  if (!change) return undefined
  if (change.mode === 'clear') return null
  if (change.mode === 'set') return change.value ? toIsoDate(change.value) : null
  if (change.mode === 'shift') {
    if (!currentValue || !change.days) return currentValue
    const date = new Date(currentValue)
    date.setUTCDate(date.getUTCDate() + parseInt(change.days, 10))
    return date.toISOString()
  }
  return undefined
}

const DATE_KEYS = ['dueAt', 'unlockAt', 'lockAt']

// Builds the list of per-assignment, per-field diff rows for preview.
//
// dateTarget is 'everyone' (write the assignment's base dates, the historical
// behavior) or a section id (write that section's assignment_override instead).
// Points, status and group are never per-section in Canvas, so they always
// stay course-wide regardless of the target. Each row carries a `scope`:
//   'assignment' → written via updateAssignment, and revertable via the log
//   'section'    → written via a section override, pin-gated but not revertable
export function buildChanges(selectedAssignments, bulkSpec, dateTarget = 'everyone', sections = []) {
  const changes = []
  const targetSection = dateTarget !== 'everyone'
    ? sections.find(s => s.id === dateTarget) ?? null
    : null

  for (const assignment of selectedAssignments) {
    // Dates first (matches the action bar's row order), routed by target.
    const existingOverride = targetSection
      ? assignment.overrides?.find(o => o.courseSectionId === targetSection.id) ?? null
      : null

    for (const key of DATE_KEYS) {
      const spec = bulkSpec[key]
      if (!spec) continue
      const currentValue = targetSection ? (existingOverride?.[key] ?? null) : assignment[key]
      const newValue = resolveFieldChange(currentValue, spec)
      if (newValue === undefined) continue
      if (newValue === currentValue) continue

      const base = {
        assignmentId: assignment.id,
        assignmentName: assignment.name,
        field: key,
        previousValue: currentValue,
        newValue,
      }
      changes.push(targetSection
        ? { ...base, scope: 'section', sectionId: targetSection.id, sectionName: targetSection.name, overrideId: existingOverride?.id ?? null }
        : { ...base, scope: 'assignment' })
    }

    // Course-wide fields — unaffected by the date target.
    const flatFields = [
      { key: 'pointsPossible', spec: bulkSpec.points },
      { key: 'published', spec: bulkSpec.published },
      { key: 'assignmentGroupId', spec: bulkSpec.assignmentGroupId },
    ]
    for (const { key, spec } of flatFields) {
      if (!spec) continue
      const newValue = key === 'pointsPossible'
        ? (spec.value !== '' && spec.value !== null ? Number(spec.value) : undefined)
        : spec.value
      if (newValue === undefined) continue
      if (newValue === assignment[key]) continue

      changes.push({
        assignmentId: assignment.id,
        assignmentName: assignment.name,
        field: key,
        previousValue: assignment[key],
        newValue,
        scope: 'assignment',
      })
    }
  }
  return changes
}

// Merges a section's changed date fields onto its starting dates, so a write
// never wipes a date the teacher did not touch. Returns the full trio the
// overrides API expects.
//
// Seed order: an existing override's own dates win; otherwise fall back to the
// base assignment's dates. The fallback matters when the teacher edits one field
// of a section that currently *inherits* the base dates — a brand-new override
// must keep the other two inherited dates it was showing, not null them out
// (Canvas treats a null override date as "no date", not "inherit").
export function buildSectionOverrideDates(existingOverride, sectionChanges, baseFallback = null) {
  const seed = existingOverride ?? baseFallback
  const dates = {
    dueAt:    seed?.dueAt    ?? null,
    unlockAt: seed?.unlockAt ?? null,
    lockAt:   seed?.lockAt   ?? null,
  }
  for (const change of sectionChanges) dates[change.field] = change.newValue
  return dates
}

// Converts the bulk editor's staged inline edits into the same flat changes[]
// shape buildChanges() produces, so Preview and Apply need no special-casing.
//
// tableEdits shape: { [assignmentId]: { base, sections: {[sectionId]:…}, fields } }
// Date values are 'YYYY-MM-DD' strings (or null); they become ISO here, matching
// the bulk bar. A staged value equal to the current Canvas value is dropped, so
// the diff never shows a no-op row.
export function buildChangesFromInlineEdits(tableEdits, assignments, sections = []) {
  const changes = []
  const assignmentById = new Map(assignments.map(a => [a.id, a]))
  const sectionById = new Map(sections.map(s => [s.id, s]))

  for (const assignmentId in tableEdits) {
    const a = assignmentById.get(assignmentId)
    if (!a) continue
    const entry = tableEdits[assignmentId]

    // Course-wide base dates → written to the assignment, revertable.
    for (const field of DATE_KEYS) {
      if (!entry.base || !(field in entry.base)) continue
      const newValue = entry.base[field] ? toIsoDate(entry.base[field]) : null
      const previousValue = a[field] ?? null
      if (newValue === previousValue) continue
      changes.push({ assignmentId, assignmentName: a.name, field, previousValue, newValue, scope: 'assignment' })
    }

    // Course-wide non-date fields (status, group) → assignment, revertable.
    if (entry.fields) {
      for (const field in entry.fields) {
        const newValue = entry.fields[field]
        const previousValue = a[field]
        if (newValue === previousValue) continue
        changes.push({ assignmentId, assignmentName: a.name, field, previousValue, newValue, scope: 'assignment' })
      }
    }

    // Per-section dates → that section's override, pin-gated, not logged/reverted.
    if (entry.sections) {
      for (const sectionId in entry.sections) {
        const sec = sectionById.get(sectionId)
        if (!sec) continue
        const override = a.overrides?.find(o => String(o.courseSectionId) === String(sectionId)) ?? null
        const bucket = entry.sections[sectionId]
        for (const field of DATE_KEYS) {
          if (!(field in bucket)) continue
          const newValue = bucket[field] ? toIsoDate(bucket[field]) : null
          // A section with no override inherits the base date as its baseline.
          const previousValue = override ? (override[field] ?? null) : (a[field] ?? null)
          if (newValue === previousValue) continue
          changes.push({
            assignmentId, assignmentName: a.name, field, previousValue, newValue,
            scope: 'section', sectionId, sectionName: sec.name, overrideId: override?.id ?? null,
          })
        }
      }
    }
  }
  return changes
}

// Applies filters to the assignment list (client-side)
export function applyFilters(assignments, filters) {
  let result = assignments

  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(a => a.name.toLowerCase().includes(q))
  }

  if (filters.groups && filters.groups.length > 0) {
    result = result.filter(a => filters.groups.includes(a.assignmentGroupId))
  }

  if (filters.modules && filters.modules.length > 0) {
    result = result.filter(a => a.moduleIds.some(id => filters.modules.includes(id)))
  }

  if (filters.status && filters.status.length > 0) {
    result = result.filter(a => {
      if (filters.status.includes('published') && a.published) return true
      if (filters.status.includes('unpublished') && !a.published) return true
      return false
    })
  }

  for (const [filterKey, fieldKey] of [['dueDate', 'dueAt'], ['unlockAt', 'unlockAt'], ['lockAt', 'lockAt']]) {
    const range = filters[filterKey]
    if (!range || (!range.from && !range.to)) continue
    result = result.filter(a => {
      if (!a[fieldKey]) return false
      // Convert UTC ISO timestamp to local YYYY-MM-DD so the comparison matches
      // what the teacher sees in the date picker (which produces local dates).
      const d = new Date(a[fieldKey])
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (range.from && dateStr < range.from) return false
      if (range.to && dateStr > range.to) return false
      return true
    })
  }

  if (filters.points) {
    const { min, max } = filters.points
    if (min !== '' || max !== '') {
      result = result.filter(a => {
        const pts = a.pointsPossible
        if (pts === null || pts === undefined) return false
        if (min !== '' && pts < Number(min)) return false
        if (max !== '' && pts > Number(max)) return false
        return true
      })
    }
  }

  return result
}

// Sorts an assignment list by a given column key
export function sortAssignments(assignments, sortKey, sortDir) {
  const multiplier = sortDir === 'asc' ? 1 : -1
  return [...assignments].sort((a, b) => {
    let av = a[sortKey]
    let bv = b[sortKey]
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    if (av < bv) return -1 * multiplier
    if (av > bv) return 1 * multiplier
    return 0
  })
}
