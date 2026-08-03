import { useState, useRef, useEffect } from 'react'
import { Search, X, Users, Package, ShoppingCart, ScrollText } from 'lucide-react'
import { api } from '../services/api'
import { useNavigate } from 'react-router-dom'

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const debounceRef = useRef<any>(null)

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAll(query), 300)
  }, [query])

  async function searchAll(q: string) {
    setLoading(true)
    try {
      const [customers, products, sales, contracts] = await Promise.all([
        api.get('/customers').then(r => r.data.filter((c: any) => c.name?.toLowerCase().includes(q.toLowerCase()) || c.cpfCnpj?.includes(q)).slice(0, 3)).catch(() => []),
        api.get('/products').then(r => r.data.filter((p: any) => p.name?.toLowerCase().includes(q.toLowerCase()) || p.code?.toLowerCase().includes(q.toLowerCase())).slice(0, 3)).catch(() => []),
        api.get('/sales').then(r => r.data.filter((s: any) => s.customer?.name?.toLowerCase().includes(q.toLowerCase())).slice(0, 3)).catch(() => []),
        api.get('/contracts').then(r => r.data.filter((c: any) => c.title?.toLowerCase().includes(q.toLowerCase()) || c.customer?.name?.toLowerCase().includes(q.toLowerCase())).slice(0, 3)).catch(() => []),
      ])
      const all: any[] = []
      customers.forEach((c: any) => all.push({ type: 'customer', icon: Users, label: c.name, sub: c.cpfCnpj || c.email, href: '/customers' }))
      products.forEach((p: any) => all.push({ type: 'product', icon: Package, label: p.name, sub: `R$ ${Number(p.salePrice).toFixed(2)}`, href: '/products' }))
      sales.forEach((s: any) => all.push({ type: 'sale', icon: ShoppingCart, label: `Venda - ${s.customer?.name}`, sub: `R$ ${Number(s.totalAmount).toFixed(2)}`, href: '/sales' }))
      contracts.forEach((c: any) => all.push({ type: 'contract', icon: ScrollText, label: c.title, sub: c.customer?.name, href: '/contracts' }))
      setResults(all)
      setOpen(all.length > 0)
    } catch { /* search failed silently */ }
    finally { setLoading(false) }
  }

  function select(item: any) {
    setQuery(''); setOpen(false)
    navigate(item.href)
  }

  return (
    <div className="relative hidden sm:block">
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 w-64 focus-within:ring-2 focus-within:ring-primary-400 focus-within:bg-white transition-all">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          aria-label="Busca global"
          className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-full"
          placeholder="Buscar clientes, produtos..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {query && <button onClick={() => { setQuery(''); setOpen(false) }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
        {loading && <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-elevated border border-gray-100 overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.map((item, i) => {
            const Icon = item.icon
            return (
              <button key={i} onClick={() => select(item)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-0">
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                  {item.sub && <p className="text-xs text-gray-500 truncate">{item.sub}</p>}
                </div>
                <span className="text-[10px] text-gray-400 uppercase">{item.type === 'customer' ? 'Cliente' : item.type === 'product' ? 'Produto' : item.type === 'sale' ? 'Venda' : 'Contrato'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
