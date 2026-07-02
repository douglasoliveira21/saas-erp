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
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  name: string
  href: string
  icon: any
  roles: string[]
}

interface NavSection {
  title: string
  items: NavItem[]
  expandable?: boolean
}

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [financeiroOpen, setFinanceiroOpen] = useState(
    ['/commissions', '/financeiro', '/pagamentos', '/sla', '/fiscal', '/reports'].includes(location.pathname)
  )

  const sections: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'financeiro', 'tecnico'] },
      ],
    },
    {
      title: 'Comercial',
      items: [
        { name: 'Clientes', href: '/customers', icon: Users, roles: ['admin', 'financeiro', 'tecnico'] },
        { name: 'Vendas', href: '/sales', icon: ShoppingCart, roles: ['admin', 'financeiro', 'tecnico'] },
        { name: 'Contratos', href: '/contracts', icon: ScrollText, roles: ['admin', 'financeiro'] },
      ],
    },
    {
      title: 'Operacional',
      items: [
        { name: 'Produtos', href: '/products', icon: Package, roles: ['admin', 'financeiro'] },
        { name: 'Servicos', href: '/services', icon: Wrench, roles: ['admin'] },
        { name: 'Rotas Externas', href: '/routes', icon: Navigation, roles: ['admin', 'financeiro', 'tecnico'] },
        { name: 'Veiculos', href: '/vehicles', icon: Car, roles: ['admin'] },
      ],
    },
    {
      title: 'Financeiro',
      expandable: true,
      items: [
        { name: 'Comissões', href: '/commissions', icon: PiggyBank, roles: ['admin', 'financeiro', 'tecnico'] },
        { name: 'Financeiro', href: '/financeiro', icon: DollarSign, roles: ['admin', 'financeiro'] },
        { name: 'Pagamentos', href: '/pagamentos', icon: CreditCard, roles: ['admin', 'financeiro'] },
        { name: 'Controle SLA', href: '/sla', icon: Clock, roles: ['admin', 'financeiro'] },
        { name: 'Módulo Fiscal', href: '/fiscal', icon: FileText, roles: ['admin', 'financeiro'] },
        { name: 'Relatórios', href: '/reports', icon: FileText, roles: ['admin', 'financeiro'] },
      ],
    },
    {
      title: 'Administração',
      items: [
        { name: 'Usuários', href: '/users', icon: UserCog, roles: ['admin'] },
      ],
    },
  ]

  const filteredSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(user?.role || '')),
    }))
    .filter(section => section.items.length > 0)

  function renderNavItem(item: NavItem, onClickItem?: () => void) {
    const Icon = item.icon
    const isActive = location.pathname === item.href
    return (
      <Link key={item.name} to={item.href} onClick={onClickItem}
        className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
            : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
        }`}>
        <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
        {item.name}
      </Link>
    )
  }

  function renderSection(section: typeof filteredSections[0], onClickItem?: () => void) {
    if (section.expandable) {
      const isAnyActive = section.items.some(item => location.pathname === item.href)
      return (
        <div key={section.title}>
          <p className="px-3 mb-2 text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">{section.title}</p>
          <button
            onClick={() => setFinanceiroOpen(!financeiroOpen)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
              isAnyActive && !financeiroOpen
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
            }`}
          >
            <span className="flex items-center">
              <Wallet className="w-4 h-4 mr-3" />
              Financeiro
            </span>
            {financeiroOpen
              ? <ChevronDown className="w-4 h-4 opacity-60" />
              : <ChevronRight className="w-4 h-4 opacity-60" />
            }
          </button>
          {financeiroOpen && (
            <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-indigo-700/50 pl-3">
              {section.items.map(item => renderNavItem(item, onClickItem))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={section.title}>
        <p className="px-3 mb-2 text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">{section.title}</p>
        <div className="space-y-1">
          {section.items.map(item => renderNavItem(item, onClickItem))}
        </div>
      </div>
    )
  }

  const sidebarContent = (onClickItem?: () => void) => (
    <>
      <div className="flex items-center h-16 px-5">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mr-3">
          <span className="text-white font-bold text-sm">G</span>
        </div>
        <span className="text-lg font-bold text-white">Gestão TI</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {filteredSections.map((section) => renderSection(section, onClickItem))}
      </nav>
      <div className="p-4 border-t border-indigo-800/50">
        <Link to="/profile" onClick={onClickItem} className="flex items-center mb-3 hover:bg-indigo-800/30 rounded-xl p-2.5 -m-1 transition-all duration-200">
          <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
            <span className="text-sm font-bold text-white">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-indigo-300">
              {user?.role === 'admin' && 'Administrador'}
              {user?.role === 'financeiro' && 'Financeiro'}
              {user?.role === 'tecnico' && 'Técnico'}
            </p>
          </div>
        </Link>
        <button onClick={logout} className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-900/30 hover:text-red-200 rounded-xl transition-all duration-200">
          <LogOut className="w-4 h-4 mr-3" />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-gradient-to-b from-indigo-950 to-slate-900">
          <div className="absolute top-4 right-4">
            <button onClick={() => setSidebarOpen(false)} className="text-indigo-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          {sidebarContent(() => setSidebarOpen(false))}
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-indigo-950 to-slate-900">
          {sidebarContent()}
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar mobile */}
        <div className="sticky top-0 z-10 flex items-center h-16 bg-white border-b border-gray-200 shadow-sm lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="px-4 text-gray-500 focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center mr-2">
              <span className="text-white font-bold text-xs">G</span>
            </div>
            <span className="text-lg font-bold text-gray-800">Gestão TI</span>
          </div>
        </div>

        {/* Page content */}
        <main className="p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
