import { useState, useEffect } from 'react'
import { BellRing, Mail, Accessibility, ExternalLink } from 'lucide-react'
import SlideOver from '../../components/SlideOver.jsx'
import Button from '../../components/Button.jsx'
import { getCanvasUrl } from '../../storage/account.js'
import {
  nudgeUrl,
  gradeOutreachUrl,
  accommodationUrl,
  canvasStudentGradesUrl,
} from '../../utils/deepLinks.js'

// Registry of the actions the hub can route to. Each entry knows its label,
// icon, and how to build its target URL. `getStudentActions` below decides
// which of these appear for a given student.
const ACTION_REGISTRY = {
  outreach:      { label: 'Grade Outreach', icon: Mail,          build: ({ student, courseId }) => gradeOutreachUrl({ courseId, studentId: student.userId }) },
  nudge:         { label: 'Nudge',          icon: BellRing,      build: ({ student, courseId }) => nudgeUrl({ courseId, studentIds: [student.userId] }) },
  accommodation: { label: 'Accommodation',  icon: Accessibility, build: ({ student }) => accommodationUrl({ studentId: student.userId }) },
  canvas:        { label: 'View in Canvas', icon: ExternalLink,  build: ({ student, courseId, canvasBaseUrl }) => canvasBaseUrl ? canvasStudentGradesUrl(canvasBaseUrl, { courseId, userId: student.userId }) : null },
}

// ── ACTION RULES (tune here) ──────────────────────────────────────────────
// Decides which buttons appear for a student and which one is primary.
// `student` fields: currentScore (0-100 or null), missing, ungraded, late.
// Returns an ordered array of { key, primary? } — exactly one primary.
// Thresholds (70 = at-risk, 60 = failing) are the knobs to adjust.
export function getStudentActions(student) {
  const score = student.currentScore
  const actions = []

  if (score != null && score < 70) actions.push({ key: 'outreach' })      // at-risk grade → reach out
  if (student.missing > 0 || student.late > 0) actions.push({ key: 'nudge' }) // outstanding work → nudge
  actions.push({ key: 'accommodation' })                                    // always available
  actions.push({ key: 'canvas' })                                           // universal fallback

  // Primary = the most urgent situation for this student.
  const primaryKey =
    score != null && score < 60 ? 'outreach'  // failing
    : student.missing > 0       ? 'nudge'      // missing work
    :                             'canvas'
  return actions.map(a => ({ ...a, primary: a.key === primaryKey }))
}
// ──────────────────────────────────────────────────────────────────────────

function gradeColor(score) {
  if (score == null) return 'var(--color-text-disabled)'
  if (score < 60) return 'var(--color-error)'
  if (score < 70) return 'var(--color-warning)'
  return 'var(--color-success)'
}

function SummaryTile({ label, value, color }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] px-3 py-2.5 text-center">
      <div className="text-xl font-bold" style={{ color: value > 0 ? color : 'var(--color-text-disabled)' }}>{value}</div>
      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</div>
    </div>
  )
}

export default function StudentDrawer({ student, courseId, onClose }) {
  const [canvasBaseUrl, setCanvasBaseUrl] = useState(null)

  useEffect(() => {
    let alive = true
    getCanvasUrl().then(url => { if (alive) setCanvasBaseUrl(url) })
    return () => { alive = false }
  }, [])

  const actions = getStudentActions(student)

  function go(href) {
    if (href) window.location.href = href
  }

  return (
    <SlideOver title={student.userName ?? 'Student'} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-text-muted)]">Overall grade</span>
          <span className="text-2xl font-bold" style={{ color: gradeColor(student.currentScore) }}>
            {student.currentScore != null ? `${Math.round(student.currentScore)}%` : '—'}
            {student.currentGrade && <span className="text-base font-medium text-[var(--color-text-muted)] ml-2">{student.currentGrade}</span>}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SummaryTile label="Missing"  value={student.missing}  color="var(--color-error)" />
          <SummaryTile label="Ungraded" value={student.ungraded} color="var(--color-warning)" />
          <SummaryTile label="Late"     value={student.late}     color="var(--color-warning)" />
        </div>

        <div className="pt-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Actions</div>
          <div className="flex flex-col gap-2 [&>button]:w-full [&>button]:justify-start">
            {actions.map(({ key, primary }) => {
              const meta = ACTION_REGISTRY[key]
              const href = meta.build({ student, courseId, canvasBaseUrl })
              const disabled = href == null
              return (
                <Button
                  key={key}
                  variant={primary ? 'primary' : 'secondary'}
                  icon={meta.icon}
                  disabled={disabled}
                  onClick={() => go(href)}
                >
                  {meta.label}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </SlideOver>
  )
}
