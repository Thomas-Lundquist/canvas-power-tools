import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
}

const COLORS = {
  success: { bg: 'bg-green-50 border-green-200',   text: 'text-green-800',  icon: 'text-green-500'  },
  error:   { bg: 'bg-red-50 border-red-200',        text: 'text-red-800',    icon: 'text-red-500'    },
  warning: { bg: 'bg-yellow-50 border-yellow-200',  text: 'text-yellow-800', icon: 'text-yellow-500' },
  info:    { bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-800',   icon: 'text-blue-500'   },
}

// success/info auto-dismiss; warning/error require manual dismissal
const DEFAULT_DURATION = { success: 5000, info: 5000, warning: null, error: null }

const EXIT_DELAY = 150
const MAX_VISIBLE = 3

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timerRefs = useRef(new Map())      // id → timeoutId
  const timerStartRefs = useRef(new Map()) // id → { startedAt, totalMs } — null startedAt = paused

  const startTimer = useCallback((id, ms) => {
    const timerId = setTimeout(() => {
      setToasts(t => t.map(x => x.id === id ? { ...x, exiting: true } : x))
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), EXIT_DELAY)
    }, ms)
    timerRefs.current.set(id, timerId)
    timerStartRefs.current.set(id, { startedAt: Date.now(), totalMs: ms })
  }, [])

  const clearTimer = useCallback(id => {
    const timerId = timerRefs.current.get(id)
    if (timerId !== undefined) {
      clearTimeout(timerId)
      timerRefs.current.delete(id)
    }
  }, [])

  const dismiss = useCallback(id => {
    clearTimer(id)
    timerStartRefs.current.delete(id)
    setToasts(t => t.map(x => x.id === id ? { ...x, exiting: true } : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), EXIT_DELAY)
  }, [clearTimer])

  // Start timers only when a toast becomes visible; cancel when it leaves the visible window
  useEffect(() => {
    const visible = toasts.slice(0, MAX_VISIBLE)
    const visibleIds = new Set(visible.map(t => t.id))

    for (const id of [...timerRefs.current.keys()]) {
      if (!visibleIds.has(id)) clearTimer(id)
    }

    for (const t of visible) {
      if (!timerRefs.current.has(t.id) && t.duration && !t.exiting) {
        startTimer(t.id, t.duration)
      }
    }
  }, [toasts, startTimer, clearTimer])

  // Escape dismisses the topmost (newest) toast
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape' && toasts.length > 0) dismiss(toasts[0].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toasts, dismiss])

  const toast = useCallback((message, type = 'info', options = {}) => {
    const { actions, duration: customDuration } = typeof options === 'object' ? options : {}
    const hasActions = Array.isArray(actions) && actions.length > 0
    const duration = hasActions ? null : (customDuration ?? DEFAULT_DURATION[type] ?? null)
    const id = Date.now() + Math.random()
    setToasts(prev => [
      { id, message, type, exiting: false, duration, actions: actions ?? [] },
      ...prev,
    ])
  }, [])

  const handleMouseEnter = useCallback(id => {
    if (!timerRefs.current.has(id)) return
    const { startedAt, totalMs } = timerStartRefs.current.get(id) ?? {}
    if (!startedAt) return
    clearTimer(id)
    const remaining = Math.max(0, totalMs - (Date.now() - startedAt))
    // startedAt: null signals "paused"
    timerStartRefs.current.set(id, { startedAt: null, totalMs: remaining })
  }, [clearTimer])

  const handleMouseLeave = useCallback(id => {
    const entry = timerStartRefs.current.get(id)
    if (!entry || entry.startedAt !== null) return
    if (entry.totalMs > 0) startTimer(id, entry.totalMs)
  }, [startTimer])

  const politeToasts = toasts.filter(t => t.type === 'success' || t.type === 'info')
  const assertiveToasts = toasts.filter(t => t.type === 'warning' || t.type === 'error')

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Screen-reader live regions — always in the DOM, never removed */}
      <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
        {politeToasts.map(t => <div key={t.id}>{t.message}</div>)}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="false" className="sr-only">
        {assertiveToasts.map(t => <div key={t.id}>{t.message}</div>)}
      </div>

      {/* Visual toast stack — top-right, newest on top */}
      <div className="fixed top-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.slice(0, MAX_VISIBLE).map(t => {
          const Icon = ICONS[t.type] ?? ICONS.info
          const colors = COLORS[t.type] ?? COLORS.info
          return (
            <div
              key={t.id}
              onMouseEnter={() => handleMouseEnter(t.id)}
              onMouseLeave={() => handleMouseLeave(t.id)}
              className={`flex flex-col px-4 py-3 rounded-xl border shadow-lg text-sm pointer-events-auto max-w-sm ${colors.bg} ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
            >
              <div className="flex items-start gap-3">
                <Icon size={16} aria-hidden="true" className={`shrink-0 mt-0.5 ${colors.icon}`} />
                <span className={`flex-1 font-medium ${colors.text}`}>{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  className={`shrink-0 hover:opacity-70 transition-opacity ${colors.text}`}
                  aria-label="Dismiss notification"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              {t.actions.length > 0 && (
                <div className="flex gap-3 mt-2 ml-7">
                  {t.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={action.onClick}
                      className={`text-xs font-semibold underline underline-offset-2 ${colors.text}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
