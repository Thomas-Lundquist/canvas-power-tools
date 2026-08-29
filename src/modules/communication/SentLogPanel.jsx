import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import Badge from '../../components/Badge.jsx'
import IconButton from '../../components/IconButton.jsx'

function formatTs(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function SentLogPanel({ entries, onClose }) {
  const [expanded, setExpanded] = useState(new Set())

  function toggle(id) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-[var(--radius-card)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)] shrink-0">
          <h2 className="font-semibold text-[var(--color-text-body)]">Sent Log</h2>
          <IconButton icon={X} label="Close sent log" onClick={onClose} />
        </div>

        <div className="overflow-y-auto flex-1">
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)] py-12 text-center">No messages sent yet.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {entries.map(entry => {
                const open = expanded.has(entry.id)
                const typeLabel =
                  entry.type === 'nudge'         ? 'Submission Reminder'    :
                  entry.type === 'threshold'     ? 'Grade Outreach'         :
                  entry.type === 'overall-grade' ? 'Overall Grade Outreach' :
                  'Announcement'
                return (
                  <div key={entry.id}>
                    <button
                      className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                      onClick={() => toggle(entry.id)}
                    >
                      {open
                        ? <ChevronDown size={15} className="text-[var(--color-text-disabled)] mt-0.5 shrink-0" />
                        : <ChevronRight size={15} className="text-[var(--color-text-disabled)] mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge tone="muted">{typeLabel}</Badge>
                          {entry.source === 'scheduled' && (
                            <Badge tone="accent">Scheduled</Badge>
                          )}
                          <span className="text-sm font-medium text-[var(--color-text-body)] truncate">{entry.assignmentName ?? entry.courseName ?? '—'}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
                          {formatTs(entry.timestamp)} · Sent to {entry.recipientCount} student{entry.recipientCount !== 1 ? 's' : ''}
                          {entry.courseName ? ` · ${entry.courseName}` : ''}
                        </p>
                      </div>
                    </button>
                    {open && (
                      <div className="px-5 pb-4 pl-11 space-y-3 bg-[var(--color-bg-hover)]">
                        {entry.recipients?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Recipients</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">{entry.recipients.map(r => r.name).join(', ')}</p>
                          </div>
                        )}
                        {entry.meta && (
                          <div>
                            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Filter</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {entry.type === 'overall-grade'
                                ? `Overall grade ${entry.meta.direction} ${entry.meta.thresholdPct}% · ${entry.meta.scoreType === 'final' ? 'final score' : 'current score'}`
                                : `Score ${entry.meta.direction} ${entry.meta.thresholdPct}%`}
                            </p>
                          </div>
                        )}
                        {entry.messageBody && (
                          <div>
                            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Message</p>
                            <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-2">{entry.messageBody}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
