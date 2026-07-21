import { LucideIcon, LayoutDashboard, Package, Wrench, Users, ShoppingCart, DollarSign, UserCog, FileText, Navigation, ScrollText, Clock, Car, CreditCard, PiggyBank, ShoppingBag, Receipt, Star, Repeat, ClipboardList, Mail, ArrowDownUp, BarChart3, Landmark, Archive, Building2 } from 'lucide-react'

export interface NavItem { name: string; href: string; icon: LucideIcon; roles: string[] }
export interface NavSection { title: string; items: NavItem[]; expandable?: boolean; expandId?: string }

export const navigationSections: NavSection[] = [
  { title: 'Principal', items: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'financeiro', 'tecnico'] },
  ]},
  { title: 'Comercial', items: [
    { name: 'Clientes', href: '/customers', icon: Users, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Contratos', href: '/contracts', icon: ScrollText, roles: ['admin', 'financeiro'] },
  ]},
  { title: 'Vendas', expandable: true, expandId: 'vendas', items: [
    { name: 'Vendas', href: '/sales', icon: ShoppingCart, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'PDV', href: '/pdv', icon: Receipt, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Orçamentos', href: '/orcamentos', icon: FileText, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Pré-venda', href: '/pre-vendas', icon: ClipboardList, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Venda Recorrente', href: '/vendas-recorrentes', icon: Repeat, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Cashback', href: '/cashback', icon: DollarSign, roles: ['admin', 'financeiro'] },
    { name: 'Fidelidade', href: '/fidelidade', icon: Star, roles: ['admin', 'financeiro'] },
    { name: 'Assinaturas', href: '/assinaturas', icon: CreditCard, roles: ['admin', 'financeiro'] },
  ]},
  { title: 'Operacional', items: [
    { name: 'Produtos', href: '/products', icon: Package, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Serviços', href: '/services', icon: Wrench, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Compras', href: '/compras', icon: ShoppingBag, roles: ['admin', 'financeiro'] },
    { name: 'Compras Avançado', href: '/compras-avancado', icon: ClipboardList, roles: ['admin', 'financeiro'] },
    { name: 'Estoque Avançado', href: '/estoque-avancado', icon: Archive, roles: ['admin', 'financeiro'] },
    { name: 'Rotas Externas', href: '/routes', icon: Navigation, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Veículos', href: '/vehicles', icon: Car, roles: ['admin'] },
  ]},
  { title: 'Financeiro', expandable: true, items: [
    { name: 'Comissões', href: '/commissions', icon: PiggyBank, roles: ['admin', 'financeiro', 'tecnico'] },
    { name: 'Financeiro', href: '/financeiro', icon: DollarSign, roles: ['admin', 'financeiro'] },
    { name: 'Financeiro Avançado', href: '/financeiro-avancado', icon: Landmark, roles: ['admin', 'financeiro'] },
    { name: 'Contas a Pagar', href: '/contas-pagar', icon: Receipt, roles: ['admin', 'financeiro'] },
    { name: 'Pagamentos', href: '/pagamentos', icon: CreditCard, roles: ['admin', 'financeiro'] },
    { name: 'Conciliação', href: '/conciliacao', icon: ArrowDownUp, roles: ['admin', 'financeiro'] },
    { name: 'Controle SLA', href: '/sla', icon: Clock, roles: ['admin', 'financeiro'] },
    { name: 'Módulo Fiscal', href: '/fiscal', icon: FileText, roles: ['admin', 'financeiro'] },
    { name: 'Fiscal Avançado', href: '/fiscal-avancado', icon: FileText, roles: ['admin', 'financeiro'] },
    { name: 'Banco Inter', href: '/inter-avancado', icon: Building2, roles: ['admin', 'financeiro'] },
    { name: 'Relatórios', href: '/reports', icon: FileText, roles: ['admin', 'financeiro'] },
    { name: 'DRE', href: '/dre', icon: BarChart3, roles: ['admin', 'financeiro'] },
  ]},
  { title: 'Administração', items: [
    { name: 'Usuários', href: '/users', icon: UserCog, roles: ['admin'] },
    { name: 'Email', href: '/email-settings', icon: Mail, roles: ['admin'] },
  ]},
]
