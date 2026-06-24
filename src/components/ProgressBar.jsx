// Reusable three-segment progress bar: graded (green) / ungraded (yellow) / not submitted (gray).
// Used by Grading Dashboard. Future: student progress views, module completion, at-risk flags.
export default function ProgressBar({ graded = 0, ungraded = 0, notSubmitted = 0, showLabel = true }) {
  const total = graded + ungraded + notSubmitted
  if (total === 0) return <span className="text-xs text-gray-300">—</span>

  const gradedPct      = (graded      / total) * 100
  const ungradedPct    = (ungraded    / total) * 100
  const notSubmittedPct = (notSubmitted / total) * 100

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden flex min-w-0">
        <div className="h-full bg-green-500 transition-all"  style={{ width: `${gradedPct}%` }} />
        <div className="h-full bg-yellow-400 transition-all" style={{ width: `${ungradedPct}%` }} />
        <div className="h-full bg-gray-200 transition-all"   style={{ width: `${notSubmittedPct}%` }} />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 shrink-0 w-8 text-right tabular-nums">
          {Math.round(gradedPct)}%
        </span>
      )}
    </div>
  )
}
