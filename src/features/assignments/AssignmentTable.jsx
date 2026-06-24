import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatDate } from '../../components/DateInput.jsx'
import { Checkbox } from '../../components/FormControls.jsx'

const COLUMNS = [
  { key: 'name', label: 'Assignment', width: 'w-64' },
  { key: 'assignmentGroupName', label: 'Group', width: 'w-32' },
  { key: 'dueAt', label: 'Due Date', width: 'w-32' },
  { key: 'unlockAt', label: 'Available From', width: 'w-32' },
  { key: 'lockAt', label: 'Available Until', width: 'w-32' },
  { key: 'pointsPossible', label: 'Points', width: 'w-20' },
  { key: 'published', label: 'Status', width: 'w-24' },
]

export default function AssignmentTable({ assignments, selectedIds, onToggle, onToggleAll, sortKey, sortDir, onSort }) {
  const allSelected = assignments.length > 0 && assignments.every(a => selectedIds.has(a.id))
  const someSelected = assignments.some(a => selectedIds.has(a.id))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="w-10 px-3 py-3">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onChange={() => onToggleAll(!allSelected)}
              />
            </th>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                className={`${col.width} px-3 py-3 text-left font-medium text-xs uppercase tracking-wide text-gray-500 cursor-pointer select-none hover:text-gray-700`}
                onClick={() => onSort(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  <SortIcon columnKey={col.key} sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="py-12 text-center text-gray-400 text-sm">
                No assignments match the current filters.
              </td>
            </tr>
          )}
          {assignments.map(a => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              selected={selectedIds.has(a.id)}
              onToggle={() => onToggle(a.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AssignmentRow({ assignment: a, selected, onToggle }) {
  return (
    <tr
      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
      style={selected ? { backgroundColor: 'rgba(var(--cpt-color-rgb), 0.06)' } : undefined}
      onClick={onToggle}
    >
      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggle} />
      </td>
      <td className="px-3 py-3 font-medium text-gray-900 max-w-xs truncate">{a.name}</td>
      <td className="px-3 py-3 text-gray-600">{a.assignmentGroupName ?? '—'}</td>
      <td className="px-3 py-3 text-gray-600">{formatDate(a.dueAt)}</td>
      <td className="px-3 py-3 text-gray-600">{formatDate(a.unlockAt)}</td>
      <td className="px-3 py-3 text-gray-600">{formatDate(a.lockAt)}</td>
      <td className="px-3 py-3 text-gray-600">{a.pointsPossible ?? '—'}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${a.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {a.published ? 'Published' : 'Unpublished'}
        </span>
      </td>
    </tr>
  )
}

function SortIcon({ columnKey, sortKey, sortDir }) {
  if (sortKey !== columnKey) return <ChevronsUpDown size={12} className="text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--cpt-color)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--cpt-color)' }} />
}
