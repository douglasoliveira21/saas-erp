import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Menu, X, ChevronDown, ChevronRight, Wallet, Search, Bell, ShoppingCart, CheckCheck, AlertCircle, Package, Receipt, ShieldCheck } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { navigationSections, NavItem } from './navigation'
import { api } from '../services/api'

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  status: 'nova' | 'lida' | 'resolvida'
  entity_type?: string
  entity_id?: string
  created_at: string
}

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const notificationsRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [financeiroOpen, setFinanceiroOpen] = useState(
    ['/commissions', '/financeiro', '/pagamentos', '/sla', '/fiscal', '/reports', '/contas-pagar', '/dre'].includes(location.pathname)
  )
  const [vendasOpen, setVendasOpen] = useState(
    ['/sales', '/sales/new', '/pdv', '/orcamentos', '/pre-vendas', '/vendas-recorrentes', '/cashback', '/fidelidade', '/assinaturas'].includes(location.pathname)
  )
  const [clock, setClock] = useState(new Date())
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  async function loadNotifications(silent = false) {
    if (!user) return
    if (!silent) setNotificationsLoading(true)
    try { setNotifications((await api.get('/operations/notifications')).data || []) } catch { /* Preserve header usability during transient failures. */ }
    finally { if (!silent) setNotificationsLoading(false) }
  }

  useEffect(() => {
    loadNotifications(true)
    const timer = window.setInterval(() => loadNotifications(true), 60000)
    const refresh = () => loadNotifications(true)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [user?.id])

  useEffect(() => {
    function close(event: MouseEvent) { if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function readAllNotifications() {
    await api.patch('/operations/notifications/read-all')
    setNotifications(items => items.map(item => item.status === 'nova' ? { ...item, status: 'lida' } : item))
  }

  async function openNotification(item: NotificationItem) {
    if (item.status === 'nova') {
      await api.patch(`/operations/notifications/${item.id}/read`)
      setNotifications(items => items.map(current => current.id === item.id ? { ...current, status: 'lida' } : current))
    }
    const routes: Record<string,string> = { account_receivable: '/financeiro', invoice: '/fiscal-avancado', approval_request: '/controles-erp', product: '/stock' }
    setNotificationsOpen(false)
    navigate(routes[item.entity_type || ''] || '/controles-erp')
  }

  async function resolveNotification(event: React.MouseEvent, id: string) {
    event.stopPropagation()
    await api.patch(`/operations/notifications/${id}/resolve`)
    setNotifications(items => items.map(item => item.id === id ? { ...item, status: 'resolvida' } : item))
  }

  const unreadNotifications = notifications.filter(item => item.status === 'nova').length

  const filteredSections = navigationSections
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(user?.role || '')) }))
    .filter(s => s.items.length > 0)

  function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
    const Icon = item.icon
    const isActive = location.pathname === item.href
    return (
      <Link to={item.href} onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-primary-600 text-white shadow-glow-violet'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}>
        <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
        {item.name}
      </Link>
    )
  }

  const sidebarContent = (onClick?: () => void) => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-center h-20 px-5 border-b border-gray-100 flex-shrink-0">
        <img src="https://vgon.com.br/wp-content/uploads/2020/12/VGON-OFICIAL-PNG.png" alt="VGON ERP" className="h-14 object-contain" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto min-h-0">
        {filteredSections.map(section => {
            if (section.expandable) {
              const isAnyActive = section.items.some(i => location.pathname === i.href)
              const isVendas = section.expandId === 'vendas'
              const isOpen = isVendas ? vendasOpen : financeiroOpen
              const setOpen = isVendas ? setVendasOpen : setFinanceiroOpen
              const SectionIcon = isVendas ? ShoppingCart : Wallet
              const sectionLabel = section.title
              return (
                <div key={section.title}>
                  <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-[0.08em]">{section.title}</p>
                  <button type="button" onClick={() => setOpen(!isOpen)} aria-expanded={isOpen}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-200 ${
                      isAnyActive && !isOpen ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}>
                    <span className="flex items-center gap-3">
                      <SectionIcon className={`w-[18px] h-[18px] ${isAnyActive ? 'text-primary-500' : 'text-gray-400'}`} />
                      {sectionLabel}
                    </span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-300" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                    <div className="ml-4 pl-3 border-l-2 border-gray-100 space-y-0.5">
                      {section.items.map(item => <NavLink key={item.name} item={item} onClick={onClick} />)}
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div key={section.title}>
                <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-[0.08em]">{section.title}</p>
                <div className="space-y-0.5">
                  {section.items.map(item => <NavLink key={item.name} item={item} onClick={onClick} />)}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-100">
          <Link to="/profile" onClick={onClick} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-semibold">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-[11px] text-gray-400">
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'financeiro' ? 'Financeiro' : 'Técnico'}
              </p>
            </div>
          </Link>
          <button type="button" onClick={logout} className="mt-2 flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </>
    )

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <a href="#main-content" className="skip-link">Ir para o conteúdo principal</a>
      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div className={`fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSidebarOpen(false)} />
        <div className={`fixed inset-y-0 left-0 w-[272px] bg-white shadow-elevated transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" className="absolute top-5 right-4 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          {sidebarContent(() => setSidebarOpen(false))}
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[264px] lg:flex-col bg-white border-r border-gray-100">
        {sidebarContent()}
      </aside>

      {/* Main */}
      <div className="lg:pl-[264px]">
        {/* Top header bar */}
        <header className="sticky top-0 z-10 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu" aria-expanded={sidebarOpen} className="lg:hidden text-gray-500">
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 w-64">
              <Search className="w-4 h-4 text-gray-400" />
              <input aria-label="Busca global" className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-full" placeholder="Buscar..." />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationsRef}>
              <button type="button" aria-label={`Notificacoes${unreadNotifications ? `, ${unreadNotifications} nao lidas` : ''}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(open => !open); if (!notificationsOpen) loadNotifications() }} className="relative rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
              </button>
              {notificationsOpen && <div className="fixed left-3 right-3 top-16 z-50 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-elevated sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[390px]">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><p className="font-semibold text-gray-900">Notificacoes</p><p className="text-xs text-gray-500">{unreadNotifications ? `${unreadNotifications} nao lida(s)` : 'Tudo em dia'}</p></div>{unreadNotifications > 0 && <button type="button" onClick={readAllNotifications} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"><CheckCheck className="h-4 w-4"/>Marcar todas como lidas</button>}</div>
                <div className="max-h-[min(65vh,480px)] overflow-y-auto">{notificationsLoading ? <div className="p-8 text-center text-sm text-gray-500">Atualizando...</div> : notifications.filter(item=>item.status!=='resolvida').length === 0 ? <div className="p-8 text-center"><Bell className="mx-auto mb-2 h-7 w-7 text-gray-300"/><p className="text-sm font-medium text-gray-700">Nenhuma notificacao pendente</p></div> : notifications.filter(item=>item.status!=='resolvida').map(item => {
                  const Icon = item.type === 'fiscal' ? AlertCircle : item.type === 'estoque' ? Package : item.type === 'aprovacao' ? ShieldCheck : Receipt
                  return <button type="button" key={item.id} onClick={()=>openNotification(item)} className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${item.status==='nova'?'bg-primary-50/50':''}`}><span className={`mt-0.5 rounded-md p-1.5 ${item.type==='fiscal'?'bg-red-50 text-red-600':item.type==='estoque'?'bg-amber-50 text-amber-600':'bg-blue-50 text-blue-600'}`}><Icon className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium text-gray-900">{item.title}</span>{item.status==='nova'&&<span className="h-2 w-2 shrink-0 rounded-full bg-primary-600"/>}</span><span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">{item.message}</span><span className="mt-1 block text-[11px] text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</span></span><span role="button" tabIndex={0} onClick={(event)=>resolveNotification(event,item.id)} className="rounded p-1 text-gray-300 hover:bg-green-50 hover:text-green-600" title="Resolver"><CheckCheck className="h-4 w-4"/></span></button>
                })}</div>
                <Link to="/controles-erp" onClick={()=>setNotificationsOpen(false)} className="block border-t border-gray-100 px-4 py-3 text-center text-xs font-medium text-primary-600 hover:bg-gray-50">Abrir central de notificacoes</Link>
              </div>}
            </div>
            <div className="hidden md:block text-right">
              <p className="text-xs text-gray-400">{clock.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-mono font-semibold shadow-sm">
              {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" tabIndex={-1} className="p-4 sm:p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
