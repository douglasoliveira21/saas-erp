import { ReactNode, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, title, description, children, footer, onClose, size = 'md' }: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button className="absolute inset-0 bg-black/50" aria-label="Fechar janela" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${sizes[size]}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          <Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-100 p-5 sm:p-6">{footer}</footer>}
      </section>
    </div>
  )
}
