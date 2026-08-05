import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, X } from 'lucide-react'

type ActionStatus = 'pending' | 'loading' | 'success' | 'error'

interface ActionToastItem {
  id: string
  title: string
  message?: string
  status: ActionStatus
  autoClose?: boolean
}

interface ActionToastContextType {
  /** Start an action toast - returns id and resolve/reject functions */
  startAction: (title: string, message?: string) => { id: string; resolve: (msg?: string) => void; reject: (msg?: string) => void }
  /** Quick helper that wraps a promise */
  trackAction: <T>(title: string, promise: Promise<T>, successMsg?: string) => Promise<T>
  /** Remove toast manually */
  dismiss: (id: string) => void
}

const ActionToastContext = createContext<ActionToastContextType>({} as ActionToastContextType)
export function useActionToast() { return useContext(ActionToastContext) }

export function ActionToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ActionToastItem[]>([])
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timeoutsRef.current[id]) { clearTimeout(timeoutsRef.current[id]); delete timeoutsRef.current[id] }
  }, [])

  const autoRemove = useCallback((id: string, delay = 3500) => {
    timeoutsRef.current[id] = setTimeout(() => dismiss(id), delay)
  }, [dismiss])

  const startAction = useCallback((title: string, message?: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    setToasts(prev => [...prev, { id, title, message, status: 'loading' }])

    const resolve = (msg?: string) => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, status: 'success' as const, message: msg || t.message } : t))
      autoRemove(id)
    }
    const reject = (msg?: string) => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, status: 'error' as const, message: msg || t.message } : t))
      autoRemove(id, 6000)
    }

    return { id, resolve, reject }
  }, [autoRemove])

  const trackAction = useCallback(async <T,>(title: string, promise: Promise<T>, successMsg?: string): Promise<T> => {
    const { resolve, reject } = startAction(title)
    try {
      const result = await promise
      resolve(successMsg)
      return result
    } catch (err: any) {
      reject(err?.response?.data?.message || err?.message || 'Erro inesperado')
      throw err
    }
  }, [startAction])

  return (
    <ActionToastContext.Provider value={{ startAction, trackAction, dismiss }}>
      {children}
      {/* Action Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-elevated backdrop-blur-sm animate-toast-in transition-all duration-300 ${
              t.status === 'loading' ? 'bg-white/95 border-primary-200' :
              t.status === 'success' ? 'bg-emerald-50/95 border-emerald-200' :
              'bg-red-50/95 border-red-200'
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              {t.status === 'loading' && (
                <div className="relative">
                  <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary-400" />
                </div>
              )}
              {t.status === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
              {t.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                t.status === 'loading' ? 'text-gray-900' :
                t.status === 'success' ? 'text-emerald-900' :
                'text-red-900'
              }`}>{t.title}</p>
              {t.message && <p className={`text-xs mt-0.5 ${
                t.status === 'loading' ? 'text-gray-500' :
                t.status === 'success' ? 'text-emerald-600' :
                'text-red-600'
              }`}>{t.message}</p>}
              {t.status === 'loading' && (
                <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full animate-progress" />
                </div>
              )}
            </div>

            {/* Close */}
            {t.status !== 'loading' && (
              <button onClick={() => dismiss(t.id)} className="flex-shrink-0 p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </ActionToastContext.Provider>
  )
}
