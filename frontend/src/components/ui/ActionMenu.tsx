import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onClick?: () => void
  to?: string
  danger?: boolean
  disabled?: boolean
  // Itens com hidden=true simplesmente não aparecem (evita montar o array com spreads/condicionais).
  hidden?: boolean
}

const MENU_WIDTH = 224

// Menu de ações "três pontinhos". Renderiza o dropdown num portal com position: fixed para não ser
// cortado pelo overflow-x-auto das tabelas, e abre para cima quando não há espaço embaixo.
export function ActionMenu({ items, label = 'Ações' }: { items: ActionMenuItem[]; label?: string }) {
  const visible = items.filter(item => !item.hidden)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? visible.length * 40 + 8
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight + 8 && rect.top > menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8)
    setPosition({ top, left })
  }, [open, visible.length])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!visible.length) return null

  const itemClass = (item: ActionMenuItem) =>
    `flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
      item.disabled
        ? 'cursor-not-allowed opacity-50'
        : item.danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
    }`

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen(current => !current)}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH, zIndex: 60 }}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {visible.map((item, index) => {
            const content = <>{item.icon}<span className="truncate">{item.label}</span></>
            if (item.to && !item.disabled) {
              return <Link key={index} role="menuitem" title={item.label} to={item.to} onClick={() => setOpen(false)} className={itemClass(item)}>{content}</Link>
            }
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                title={item.label}
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick?.() }}
                className={itemClass(item)}
              >
                {content}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
