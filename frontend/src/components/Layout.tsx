import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  Package,
  Wrench,
  Users,
  ShoppingCart,
  DollarSign,
  Warehouse,
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
  expandIcon?: any
}

export function Layout() {
  const { user, logout, isAdmin, isFinanceiro } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [financeiroOpen, setFinanceiroOpen] = useState(
    ['/commissions', '/financeiro', '/pagamentos'].includes(location.pathname)
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
      expandIcon: Wallet,
      items: [
        { name: 'Comissoes', href: '/commissions', icon: PiggyBank, roles: ['admin', 'financeiro', 'tecnico'] },
        { name: 'Financeiro', href: '/financeiro', icon: DollarSign, roles: ['admin', 'financeiro'] },
        { name: 'Pagamentos', href: '/pagamentos', icon: CreditCard, roles: ['admin', 'financeiro'] },
        { name: 'Controle SLA', href: '/sla', icon: Clock, roles: ['admin', 'financeiro'] },
        { name: 'Modulo Fiscal', href: '/fiscal', icon: FileText, roles: ['admin', 'financeiro'] },
        { name: 'Relatorios', href: '/reports', icon: FileText, roles: ['admin', 'financeiro'] },
      ],
    },
    {
      title: 'Administracao',
      items: [
        { name: 'Usuarios', href: '/users', icon: UserCog, roles: ['admin'] },
      ],
    },
  ]

  const filteredSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(user?.role || '')),
    }))
    .filter(section => section.items.length > 0)

  function renderNavItems(items: NavItem[], onClickItem?: () => void) {
    return items.map((item) => {
      const Icon = item.icon
      const isActive = location.pathname === item.href
      return (
        <Link key={item.name} to={item.href} onClick={onClickItem}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-400' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
          <Icon className="w-4 h-4 mr-3" />
          {item.name}
        </Link>
      )
    })
  }

  function renderSection(section: typeof filteredSections[0], onClickItem?: () => void) {
    if (section.expandable) {
      const isAnyActive = section.items.some(item => location.pathname === item.href)
      return (
        <div key={section.title}>
          <button
            onClick={() => setFinanceiroOpen(!financeiroOpen)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isAnyActive && !financeiroOpen ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center">
              <Wallet className="w-4 h-4 mr-3" />
              {section.title}
            </span>
            {financeiroOpen
              ? <ChevronDown className="w-4 h-4 text-gray-400" />
              : <ChevronRight className="w-4 h-4 text-gray-400" />
            }
          </button>
          {financeiroOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
              {renderNavItems(section.items, onClickItem)}
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={section.title}>
        <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{section.title}</p>
        <div className="space-y-0.5">
          {renderNavItems(section.items, onClickItem)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xl font-bold text-primary-600">Gestão TI</span>
            <button onClick={() => setSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
            {filteredSections.map((section) => renderSection(section, () => setSidebarOpen(false)))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xl font-bold text-primary-600">Gestão TI</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
            {filteredSections.map((section) => renderSection(section))}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Link to="/profile" className="flex items-center mb-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 -m-2 transition-colors">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                <span className="text-sm font-bold text-primary-600">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.role === 'admin' && 'Administrador'}
                  {user?.role === 'financeiro' && 'Financeiro'}
                  {user?.role === 'tecnico' && 'Técnico'}
                </p>
              </div>
            </Link>
            <button onClick={logout} className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="px-4 text-gray-500 focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-xl font-bold text-primary-600">Gestão TI</span>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
