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
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  const iconColors = { success: 'text-green-500', error: 'text-red-500', warning: 'text-yellow-500', info: 'text-blue-500' }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slideInRight ${colors[t.type]}`}>
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColors[t.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{t.title}</p>
                {t.message && <p className="text-xs mt-0.5 opacity-80">{t.message}</p>}
              </div>
              <button onClick={() => removeToast(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
