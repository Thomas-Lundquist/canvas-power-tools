import { ChevronDown } from 'lucide-react'

export default function CourseSelector({ courses, selectedId, onChange, loading }) {
  return (
    <div className="relative">
      <select
        value={selectedId ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={loading || courses.length === 0}
        className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm
                   font-medium text-gray-900 shadow-sm
                   disabled:opacity-50 disabled:cursor-not-allowed min-w-[260px]"
      >
        {loading && <option value="">Loading courses...</option>}
        {!loading && courses.length === 0 && <option value="">No courses found</option>}
        {!loading && courses.length > 0 && (
          <>
            <option value="" disabled>Select a course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.term ? ` — ${c.term}` : ''}
              </option>
            ))}
          </>
        )}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
