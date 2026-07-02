import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'

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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900">Sent Log</h3>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close sent log">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">No messages sent yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.map(entry => {
                const open = expanded.has(entry.id)
                const typeLabel = entry.type === 'nudge' ? 'Submission Reminder' : entry.type === 'threshold' ? 'Grade Outreach' : 'Announcement'
                return (
                  <div key={entry.id}>
                    <button
                      className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => toggle(entry.id)}
                    >
                      {open
                        ? <ChevronDown size={15} className="text-gray-400 mt-0.5 shrink-0" />
                        : <ChevronRight size={15} className="text-gray-400 mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{typeLabel}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">{entry.assignmentName ?? entry.courseName ?? '—'}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatTs(entry.timestamp)} · Sent to {entry.recipientCount} student{entry.recipientCount !== 1 ? 's' : ''}
                          {entry.courseName ? ` · ${entry.courseName}` : ''}
                        </p>
                      </div>
                    </button>
                    {open && (
                      <div className="px-5 pb-4 pl-11 space-y-3 bg-gray-50/50">
                        {entry.recipients?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Recipients</p>
                            <p className="text-xs text-gray-700">{entry.recipients.map(r => r.name).join(', ')}</p>
                          </div>
                        )}
                        {entry.messageBody && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Message</p>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded p-2">{entry.messageBody}</p>
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
