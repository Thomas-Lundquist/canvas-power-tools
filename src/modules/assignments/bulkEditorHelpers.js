import { toIsoDate } from '../../components/DateInput.jsx'

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

// Builds the list of per-assignment, per-field diff rows for preview
export function buildChanges(selectedAssignments, bulkSpec) {
  const changes = []
  for (const assignment of selectedAssignments) {
    const fields = [
      { key: 'dueAt', spec: bulkSpec.dueAt },
      { key: 'unlockAt', spec: bulkSpec.unlockAt },
      { key: 'lockAt', spec: bulkSpec.lockAt },
      { key: 'pointsPossible', spec: bulkSpec.points },
      { key: 'published', spec: bulkSpec.published },
      { key: 'assignmentGroupId', spec: bulkSpec.assignmentGroupId },
    ]

    for (const { key, spec } of fields) {
      if (!spec) continue
      let newValue
      if (key === 'pointsPossible') {
        newValue = spec.value !== '' && spec.value !== null ? Number(spec.value) : undefined
      } else if (key === 'published' || key === 'assignmentGroupId') {
        newValue = spec.value
      } else {
        newValue = resolveFieldChange(assignment[key], spec)
      }
      if (newValue === undefined) continue
      if (newValue === assignment[key]) continue

      changes.push({
        assignmentId: assignment.id,
        assignmentName: assignment.name,
        field: key,
        previousValue: assignment[key],
        newValue,
      })
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
