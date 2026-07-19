import { useCallback, useMemo, useState } from 'react'

/**
 * useSort — the shared sort "brain" for browse and table screens.
 *
 * Tier 2 composition (bead 1yr.5, ledger Decision 2: "share the brain, keep
 * two faces"). Canonicalizes the {key, dir} state + direction-toggle + list
 * comparator that were hand-rolled in ~10 places (bulk-editor App, CopyFlow,
 * GradeAdjustments, MissingWork, RubricManager, AccommodationsTool, …).
 *
 * One state, two faces — the return value drives both without either owning
 * the logic:
 *   - table face:  <AssignmentTable sortKey={s.key} sortDir={s.dir} onSort={s.onSort} />
 *   - browse face: <SortControl value={s.value} onChange={s.setSort} />
 * and everyone consumes `s.sorted`.
 *
 * @param {T[]} items  The list to sort (not mutated — a copy is sorted).
 * @param {{ key: string, dir: 'asc' | 'desc' }} initial  Initial sort state.
 * @param {{ comparator?: (key: string, dir: 'asc'|'desc') => (a: T, b: T) => number }} [options]
 *   Optional comparator factory to override the default field compare (e.g. a
 *   custom collation). Defaults to `compareBy`, which reproduces the legacy
 *   `sortAssignments` behavior.
 * @returns {{ key, dir, value, sorted, onSort, setSort }}
 */
export default function useSort(items, initial, options = {}) {
  const { comparator } = options
  const [sort, setSort] = useState(initial)

  // Table-header gesture: clicking a column applies the flip rule. Functional
  // update so it never reads a stale `sort` from the closure (the exact bug the
  // old App.jsx toggle skirted).
  const onSort = useCallback((key) => {
    setSort((current) => nextSort(current, key))
  }, [])

  const sorted = useMemo(() => {
    if (!sort.key) return items
    const factory = comparator ?? compareBy
    return [...items].sort(factory(sort.key, sort.dir))
  }, [items, sort.key, sort.dir, comparator])

  return {
    key: sort.key,
    dir: sort.dir,
    value: sort, // { key, dir } — feeds SortControl's `value` prop directly
    sorted,
    onSort, // (key) => void   — single-affordance gesture (table headers)
    setSort, // ({key,dir}) => void — explicit set (SortControl onChange)
  }
}

/**
 * nextSort — the direction-toggle rule, as one pure function so both faces
 * (table header click and SortControl field pick) resolve a field choice
 * identically: re-picking the active field flips direction; picking a new
 * field selects it ascending.
 *
 * @param {{ key: string, dir: 'asc'|'desc' }} current
 * @param {string} key  The field the user just chose.
 * @returns {{ key: string, dir: 'asc'|'desc' }}
 */
export function nextSort(current, key) {
  if (current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { key, dir: 'asc' }
}

/**
 * compareBy — the default field comparator, preserved verbatim from
 * `bulkEditorHelpers.sortAssignments` so adoption is behavior-preserving:
 *   - null / undefined always sink to the bottom, in BOTH directions
 *     (returns raw ±1, deliberately not multiplied by direction);
 *   - strings compare case-insensitively;
 *   - everything else compares with < / > (numbers, and ISO-8601 date strings,
 *     which sort chronologically as text).
 *
 * @param {string} key
 * @param {'asc'|'desc'} dir
 * @returns {(a: object, b: object) => number}
 */
export function compareBy(key, dir) {
  const multiplier = dir === 'asc' ? 1 : -1
  return (a, b) => {
    let av = a[key]
    let bv = b[key]
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    if (av < bv) return -1 * multiplier
    if (av > bv) return 1 * multiplier
    return 0
  }
}
