import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toast: (msg: Omit<ToastMessage, 'id'>) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType>({} as ToastContextType)

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...msg, id }])
    setTimeout(() => removeToast(id), msg.duration || 4000)
  }, [removeToast])

  const contextValue: ToastContextType = {
    toast: addToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message, duration: 6000 }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  }

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
  const colors = {
    success: 'bg-emerald-50/95 border-emerald-200 text-emerald-900',
    error: 'bg-red-50/95 border-red-200 text-red-900',
    warning: 'bg-amber-50/95 border-amber-200 text-amber-900',
    info: 'bg-blue-50/95 border-blue-200 text-blue-900',
  }
  const iconColors = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
  }
  const progressColors = {
    success: 'bg-emerald-400',
    error: 'bg-red-400',
    warning: 'bg-amber-400',
    info: 'bg-blue-400',
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const Icon = icons[t.type]
          const duration = t.duration || 4000
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-elevated backdrop-blur-sm animate-toast-in ${colors[t.type]}`}
            >
              <div className={`p-1 rounded-lg ${t.type === 'success' ? 'bg-emerald-100' : t.type === 'error' ? 'bg-red-100' : t.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                <Icon className={`w-4 h-4 ${iconColors[t.type]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{t.title}</p>
                {t.message && <p className="text-xs mt-0.5 opacity-75">{t.message}</p>}
                {/* Auto-dismiss progress bar */}
                <div className="mt-2.5 h-0.5 w-full bg-black/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progressColors[t.type]}`}
                    style={{ animation: `shrink ${duration}ms linear forwards` }}
                  />
                </div>
              </div>
              <button onClick={() => removeToast(t.id)} className="flex-shrink-0 p-1 rounded-lg opacity-40 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
    </ToastContext.Provider>
  )
}
