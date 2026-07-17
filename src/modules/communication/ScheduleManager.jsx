import { useState, useEffect, useCallback } from 'react'
import { Plus, CalendarClock } from 'lucide-react'
import { getScheduledChecksByTool } from '../../storage/scheduledChecks.js'
import ScheduleCard from './ScheduleCard.jsx'

export default function ScheduleManager({ toolType, courseId, onCreateSchedule, onEditSchedule }) {
  const [schedules, setSchedules] = useState([])

  const refresh = useCallback(async () => {
    const all = await getScheduledChecksByTool(toolType)
    setSchedules(courseId ? all.filter(s => s.courseId === courseId) : all)
  }, [toolType, courseId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Re-fetch when the background worker updates a schedule's run state
  useEffect(() => {
    function handleStorageChange(changes) {
      if (changes.scheduledChecks) refresh()
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [refresh])

  const activeCount = schedules.filter(s => s.enabled).length

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-body)]">
            Recurring Rules
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {schedules.length === 0
              ? 'No rules set up yet.'
              : `${activeCount} active rule${activeCount !== 1 ? 's' : ''}${activeCount < schedules.length ? `, ${schedules.length - activeCount} paused` : ''}`
            }
            {!courseId && schedules.length > 0 && ' — select a course to filter'}
          </p>
        </div>
        <button
          onClick={onCreateSchedule}
          disabled={!courseId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--cpt-color)' }}
          title={!courseId ? 'Select a course first' : 'Add a recurring rule'}
        >
          <Plus size={13} aria-hidden="true" />
          Add Rule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-lg border border-dashed border-[var(--color-border)]">
          <CalendarClock size={28} className="text-[var(--color-text-muted)] mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-[var(--color-text-body)]">No recurring rules yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xs">
            Add a rule to automatically check for matching students and send messages on a schedule.
          </p>
          {courseId && (
            <button
              onClick={onCreateSchedule}
              className="mt-4 px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity"
              style={{ backgroundColor: 'var(--cpt-color)' }}
            >
              Add your first rule
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {schedules.map(schedule => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onUpdate={refresh}
              onDelete={refresh}
              onEdit={onEditSchedule}
            />
          ))}
        </div>
      )}
    </div>
  )
}
