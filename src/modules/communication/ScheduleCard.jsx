import { useState } from 'react'
import { Pencil, Trash2, Play, Pause, AlertCircle } from 'lucide-react'
import { deleteScheduledCheck, toggleScheduledCheck } from '../../storage/scheduledChecks.js'
import Button from '../../components/Button.jsx'
import IconButton from '../../components/IconButton.jsx'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatHour(hour) {
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

function formatCadence(schedule) {
  if (schedule.cadence === 'daily') return `Daily at ${formatHour(schedule.runHour)}`
  return `Weekly on ${DAY_NAMES[schedule.runDayOfWeek]}s at ${formatHour(schedule.runHour)}`
}

function formatRuleDescription(schedule) {
  switch (schedule.toolType) {
    case 'grade-outreach-assignment':
      return `Assignment score ${schedule.direction} ${schedule.thresholdPct}%${schedule.assignmentName ? ` — ${schedule.assignmentName}` : ''}`
    case 'grade-outreach-overall':
      return `Overall ${schedule.scoreType === 'final' ? 'final' : 'current'} grade ${schedule.direction} ${schedule.thresholdPct}%`
    case 'submission-reminder-specific':
      return `Missing submission${schedule.assignmentName ? ` — ${schedule.assignmentName}` : ''}`
    case 'submission-reminder-upcoming':
      return `Missing submissions due within ${schedule.daysAhead ?? 7} days`
    default:
      return 'Scheduled check'
  }
}

function formatRunTime(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function StatusDot({ schedule }) {
  let color
  if (!schedule.enabled) {
    color = 'var(--color-text-disabled)'
  } else if (schedule.lastRunResult === 'error') {
    color = 'var(--color-error)'
  } else if (!schedule.lastRunAt) {
    color = 'var(--color-warning)' // never run
  } else {
    color = 'var(--color-success)'
  }
  const label = !schedule.enabled ? 'Paused' : schedule.lastRunResult === 'error' ? 'Error' : schedule.lastRunAt ? 'Active' : 'Scheduled'
  return (
    <span
      aria-label={label}
      title={label}
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
      style={{ backgroundColor: color }}
    />
  )
}

export default function ScheduleCard({ schedule, onUpdate, onDelete, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleToggle() {
    await toggleScheduledCheck(schedule.id, !schedule.enabled)
    onUpdate?.()
  }

  async function handleDelete() {
    await deleteScheduledCheck(schedule.id)
    onDelete?.()
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <StatusDot schedule={schedule} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--color-text-body)] leading-snug">
              {formatCadence(schedule)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {formatRuleDescription(schedule)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            icon={schedule.enabled ? Pause : Play}
            label={schedule.enabled ? 'Pause schedule' : 'Resume schedule'}
            size="sm"
            onClick={handleToggle}
          />
          <IconButton icon={Pencil} label="Edit schedule" size="sm" onClick={() => onEdit?.(schedule)} />
          <IconButton icon={Trash2} label="Delete schedule" size="sm" variant="danger" onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <div className="mt-2 pl-5 text-xs text-[var(--color-text-muted)] flex flex-wrap gap-x-4 gap-y-0.5">
        {schedule.lastRunAt ? (
          <span>
            Last run: {formatRunTime(schedule.lastRunAt)}
            {schedule.lastRunSentCount !== null && schedule.lastRunResult === 'ok' && (
              <> · {schedule.lastRunSentCount} message{schedule.lastRunSentCount !== 1 ? 's' : ''} sent</>
            )}
            {schedule.lastRunResult === 'skipped' && ' · No matching students'}
          </span>
        ) : (
          <span>Never run</span>
        )}
        {schedule.nextRunAt && schedule.enabled && (
          <span>Next run: {formatRunTime(schedule.nextRunAt)}</span>
        )}
      </div>

      {schedule.lastRunResult === 'error' && schedule.lastRunError && (
        <div className="mt-2 pl-5 flex items-start gap-1.5 text-xs text-[var(--color-error)]">
          <AlertCircle size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>Last run failed: {schedule.lastRunError}</span>
        </div>
      )}

      {confirmDelete && (
        <div className="mt-3 pl-5 flex items-center gap-3 text-xs">
          <span className="text-[var(--color-text-body)]">Delete this rule? This cannot be undone.</span>
          <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
        </div>
      )}
    </div>
  )
}
