import { useState, useCallback, createContext, useContext } from 'react'
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

const EXIT_DELAY = 150

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => {
    setToasts(t => t.map(x => x.id === id ? { ...x, exiting: true } : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), EXIT_DELAY)
  }, [])

  const toast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type, exiting: false }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => {
          const Icon = ICONS[t.type] ?? ICONS.info
          const colors = COLORS[t.type] ?? COLORS.info
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm pointer-events-auto max-w-sm ${colors.bg} ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
            >
              <Icon size={16} className={`shrink-0 mt-0.5 ${colors.icon}`} />
              <span className={`flex-1 font-medium ${colors.text}`}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className={`shrink-0 hover:opacity-70 transition-opacity ${colors.text}`}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
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
