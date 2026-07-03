import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  Package,
  Wrench,
  Users,
  ShoppingCart,
  DollarSign,
  UserCog,
  FileText,
  LogOut,
  Menu,
  X,
  Navigation,
  ScrollText,
  Clock,
  Car,
  ChevronDown,
  ChevronRight,
  Wallet,
  CreditCard,
  PiggyBank,
  Search,
  Bell,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface NavItem { name: string; href: string; icon: any; roles: string[] }
interface NavSection { title: string; items: NavItem[]; expandable?: boolean }

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [financeiroOpen, setFinanceiroOpen] = useState(
    ['/commissions', '/financeiro', '/pagamentos', '/sla', '/fiscal', '/reports'].includes(location.pathname)
  )
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const sections: NavSection[] = [
    { title: 'Principal', items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'financeiro', 'tecnico'] },
    ]},
    { title: 'Comercial', items: [
      { name: 'Clientes', href: '/customers', icon: Users, roles: ['admin', 'financeiro', 'tecnico'] },
      { name: 'Vendas', href: '/sales', icon: ShoppingCart, roles: ['admin', 'financeiro', 'tecnico'] },
      { name: 'Contratos', href: '/contracts', icon: ScrollText, roles: ['admin', 'financeiro'] },
    ]},
    { title: 'Operacional', items: [
      { name: 'Produtos', href: '/products', icon: Package, roles: ['admin', 'financeiro', 'tecnico'] },
      { name: 'Serviços', href: '/services', icon: Wrench, roles: ['admin', 'financeiro', 'tecnico'] },
      { name: 'Rotas Externas', href: '/routes', icon: Navigation, roles: ['admin', 'financeiro', 'tecnico'] },
      { name: 'Veículos', href: '/vehicles', icon: Car, roles: ['admin'] },
    ]},
    { title: 'Financeiro', expandable: true, items: [
      { name: 'Comissões', href: '/commissions', icon: PiggyBank, roles: ['admin', 'financeiro', 'tecnico'] },
      { name: 'Financeiro', href: '/financeiro', icon: DollarSign, roles: ['admin', 'financeiro'] },
      { name: 'Pagamentos', href: '/pagamentos', icon: CreditCard, roles: ['admin', 'financeiro'] },
      { name: 'Controle SLA', href: '/sla', icon: Clock, roles: ['admin', 'financeiro'] },
      { name: 'Módulo Fiscal', href: '/fiscal', icon: FileText, roles: ['admin', 'financeiro'] },
      { name: 'Relatórios', href: '/reports', icon: FileText, roles: ['admin', 'financeiro'] },
    ]},
    { title: 'Administração', items: [
      { name: 'Usuários', href: '/users', icon: UserCog, roles: ['admin'] },
    ]},
  ]

  const filteredSections = sections
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

  function SidebarContent({ onClick }: { onClick?: () => void }) {
    return (
      <>
        {/* Logo */}
        <div className="flex items-center h-16 px-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <span className="ml-3 text-[15px] font-bold text-gray-900 tracking-tight">Gestão TI</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          {filteredSections.map(section => {
            if (section.expandable) {
              const isAnyActive = section.items.some(i => location.pathname === i.href)
              return (
                <div key={section.title}>
                  <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-[0.08em]">{section.title}</p>
                  <button onClick={() => setFinanceiroOpen(!financeiroOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-200 ${
                      isAnyActive && !financeiroOpen ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}>
                    <span className="flex items-center gap-3">
                      <Wallet className={`w-[18px] h-[18px] ${isAnyActive ? 'text-primary-500' : 'text-gray-400'}`} />
                      Financeiro
                    </span>
                    {financeiroOpen ? <ChevronDown className="w-4 h-4 text-gray-300" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${financeiroOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
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
          <button onClick={logout} className="mt-2 flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div className={`fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSidebarOpen(false)} />
        <div className={`fixed inset-y-0 left-0 w-[272px] bg-white shadow-elevated transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <button onClick={() => setSidebarOpen(false)} className="absolute top-5 right-4 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <SidebarContent onClick={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[264px] lg:flex-col bg-white border-r border-gray-100">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="lg:pl-[264px]">
        {/* Top header bar */}
        <header className="sticky top-0 z-10 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500">
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 w-64">
              <Search className="w-4 h-4 text-gray-400" />
              <input className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-full" placeholder="Buscar..." />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="hidden md:block text-right">
              <p className="text-xs text-gray-400">{clock.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-mono font-semibold shadow-sm">
              {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
