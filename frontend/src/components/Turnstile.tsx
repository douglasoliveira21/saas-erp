import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
      }) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Falha ao carregar o Turnstile'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

// Widget de captcha (Cloudflare Turnstile). Some sozinho (não renderiza nada) quando
// VITE_TURNSTILE_SITE_KEY não está configurado - assim dev local e ambientes que ainda não
// criaram uma conta no Cloudflare continuam funcionando sem captcha nenhum (o backend também
// pula a verificação nesse caso, ver auth.service.ts).
export function Turnstile({ onVerify }: { onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false
    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': () => onVerify(''),
        'error-callback': () => onVerify(''),
      })
    }).catch(() => {})
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={containerRef} />
}
