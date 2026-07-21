import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; type: ToastType }
interface ConfirmOptions { title?: string; message: string; confirmLabel?: string; danger?: boolean }
interface FeedbackContextValue {
  notify: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)
const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
const colors = { success: 'border-green-200 text-green-700', error: 'border-red-200 text-red-700', info: 'border-blue-200 text-blue-700' }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((result: boolean) => void) | null>(null)
  const nextId = useRef(1)

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++
    setToasts(current => [...current, { id, message, type }])
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 5000)
  }, [])

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized = typeof options === 'string' ? { message: options } : options
    setConfirmation(normalized)
    return new Promise<boolean>(resolve => { resolver.current = resolve })
  }, [])

  const finishConfirmation = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setConfirmation(null)
  }, [])

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => {
          const Icon = icons[toast.type]
          return (
            <div key={toast.id} className={`animate-toast-in flex items-start gap-3 rounded-xl border bg-white p-4 shadow-elevated ${colors[toast.type]}`} role={toast.type === 'error' ? 'alert' : 'status'}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button type="button" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))} aria-label="Fechar notificação" className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
      <Modal
        open={Boolean(confirmation)}
        title={confirmation?.title || 'Confirmar ação'}
        description={confirmation?.message}
        onClose={() => finishConfirmation(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => finishConfirmation(false)}>Cancelar</Button>
            <Button variant={confirmation?.danger ? 'danger' : 'primary'} onClick={() => finishConfirmation(true)}>
              {confirmation?.confirmLabel || 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className={`rounded-xl p-4 text-sm ${confirmation?.danger ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
          Esta ação será aplicada imediatamente.
        </div>
      </Modal>
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) throw new Error('useFeedback deve ser usado dentro de FeedbackProvider')
  return context
}
