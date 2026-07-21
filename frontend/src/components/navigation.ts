import {
  LucideIcon, LayoutDashboard, Package, Wrench, Users, ShoppingCart, DollarSign,
  UserCog, FileText, Navigation, ScrollText, Clock, Car, CreditCard, PiggyBank,
  ShoppingBag, Receipt, Star, Repeat, ClipboardList, Mail, ArrowDownUp, BarChart3,
  Landmark, Archive, Building2, ShieldCheck, Boxes, Settings,
} from 'lucide-react'

export interface NavItem { name: string; href: string; icon: LucideIcon; roles: string[] }
export interface NavSection { id: string; title: string; icon?: LucideIcon; items: NavItem[]; expandable?: boolean }

const all = ['admin', 'financeiro', 'tecnico']
const office = ['admin', 'financeiro']

export const navigationSections: NavSection[] = [
  { id: 'principal', title: 'Principal', items: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: all },
  ]},
  { id: 'comercial', title: 'Comercial e vendas', icon: ShoppingCart, expandable: true, items: [
    { name: 'Clientes', href: '/customers', icon: Users, roles: all },
    { name: 'Orçamentos', href: '/orcamentos', icon: FileText, roles: all },
    { name: 'Pré-vendas', href: '/pre-vendas', icon: ClipboardList, roles: all },
    { name: 'Vendas', href: '/sales', icon: ShoppingCart, roles: all },
    { name: 'PDV', href: '/pdv', icon: Receipt, roles: all },
    { name: 'Vendas recorrentes', href: '/vendas-recorrentes', icon: Repeat, roles: all },
    { name: 'Contratos', href: '/contracts', icon: ScrollText, roles: office },
  ]},
  { id: 'catalogo', title: 'Catálogo e estoque', icon: Boxes, expandable: true, items: [
    { name: 'Produtos', href: '/products', icon: Package, roles: all },
    { name: 'Serviços', href: '/services', icon: Wrench, roles: all },
    { name: 'Posição de estoque', href: '/stock', icon: Archive, roles: all },
    { name: 'Inventário e Kardex', href: '/estoque-avancado', icon: ClipboardList, roles: office },
  ]},
  { id: 'compras', title: 'Compras', icon: ShoppingBag, expandable: true, items: [
    { name: 'Solicitações e compras', href: '/compras', icon: ShoppingBag, roles: office },
    { name: 'Cotações e recebimento', href: '/compras-avancado', icon: ClipboardList, roles: office },
  ]},
  { id: 'financeiro', title: 'Financeiro', icon: Landmark, expandable: true, items: [
    { name: 'Visão financeira', href: '/financeiro', icon: DollarSign, roles: office },
    { name: 'Contas a pagar', href: '/contas-pagar', icon: Receipt, roles: office },
    { name: 'Pagamentos e recebimentos', href: '/pagamentos', icon: CreditCard, roles: office },
    { name: 'Conciliação bancária', href: '/conciliacao', icon: ArrowDownUp, roles: office },
    { name: 'Comissões', href: '/commissions', icon: PiggyBank, roles: all },
    { name: 'DRE', href: '/dre', icon: BarChart3, roles: office },
    { name: 'Relatórios', href: '/reports', icon: FileText, roles: office },
    { name: 'Configurações financeiras', href: '/financeiro-avancado', icon: Settings, roles: office },
  ]},
  { id: 'fiscal', title: 'Fiscal e bancos', icon: FileText, expandable: true, items: [
    { name: 'Notas fiscais', href: '/fiscal', icon: FileText, roles: office },
    { name: 'Operações fiscais', href: '/fiscal-avancado', icon: ShieldCheck, roles: office },
    { name: 'Banco Inter', href: '/inter-avancado', icon: Building2, roles: office },
  ]},
  { id: 'relacionamento', title: 'Relacionamento', icon: Star, expandable: true, items: [
    { name: 'Cashback', href: '/cashback', icon: DollarSign, roles: office },
    { name: 'Fidelidade', href: '/fidelidade', icon: Star, roles: office },
    { name: 'Assinaturas', href: '/assinaturas', icon: CreditCard, roles: office },
  ]},
  { id: 'operacoes', title: 'Operações', icon: Navigation, expandable: true, items: [
    { name: 'Rotas externas', href: '/routes', icon: Navigation, roles: all },
    { name: 'Veículos', href: '/vehicles', icon: Car, roles: ['admin'] },
    { name: 'Controle de SLA', href: '/sla', icon: Clock, roles: office },
  ]},
  { id: 'administracao', title: 'Administração', icon: UserCog, expandable: true, items: [
    { name: 'Controles do ERP', href: '/controles-erp', icon: ShieldCheck, roles: office },
    { name: 'Usuários e acessos', href: '/users', icon: UserCog, roles: ['admin'] },
    { name: 'Configuração de e-mail', href: '/email-settings', icon: Mail, roles: ['admin'] },
  ]},
]
