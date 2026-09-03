import {
  LucideIcon, LayoutDashboard, Package, Wrench, Users, ShoppingCart, DollarSign,
  UserCog, FileText, Navigation, ScrollText, Clock, Car, CreditCard, PiggyBank,
  ShoppingBag, Receipt, Star, Repeat, ClipboardList, Mail, ArrowDownUp, BarChart3,
  Landmark, Archive, Building2, ShieldCheck, Boxes, Settings, BookOpen, ClipboardCheck, MessageCircle,
} from 'lucide-react'

// `module` casa com as chaves de frontend/src/data/planModules.ts (mesmo catálogo usado na tela
// de planos do super admin). Item sem `module` nunca é escondido por plano — só por `roles` —
// reservado para páginas que toda instância tem, plano nenhum desliga (Dashboard, Clientes,
// Tutorial).
export interface NavItem { name: string; href: string; icon: LucideIcon; roles: string[]; module?: string }
export interface NavSection { id: string; title: string; icon?: LucideIcon; items: NavItem[]; expandable?: boolean }

const all = ['admin', 'financeiro', 'tecnico']
const office = ['admin', 'financeiro']

export const navigationSections: NavSection[] = [
  { id: 'principal', title: 'Principal', items: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: all },
  ]},
  { id: 'comercial', title: 'Comercial e vendas', icon: ShoppingCart, expandable: true, items: [
    { name: 'Clientes', href: '/customers', icon: Users, roles: all },
    { name: 'CRM de oportunidades', href: '/crm', icon: BarChart3, roles: all, module: 'crm' },
    { name: 'Orçamentos', href: '/orcamentos', icon: FileText, roles: all, module: 'orcamentos' },
    { name: 'Pré-vendas', href: '/pre-vendas', icon: ClipboardList, roles: all, module: 'sales' },
    { name: 'Vendas', href: '/sales', icon: ShoppingCart, roles: all, module: 'sales' },
    { name: 'PDV', href: '/pdv', icon: Receipt, roles: all, module: 'sales' },
    { name: 'Vendas recorrentes', href: '/vendas-recorrentes', icon: Repeat, roles: all, module: 'sales' },
    { name: 'Contratos', href: '/contracts', icon: ScrollText, roles: office, module: 'contracts' },
  ]},
  { id: 'catalogo', title: 'Catálogo e estoque', icon: Boxes, expandable: true, items: [
    { name: 'Produtos', href: '/products', icon: Package, roles: all, module: 'products' },
    { name: 'Serviços', href: '/services', icon: Wrench, roles: all, module: 'services' },
    { name: 'Posição de estoque', href: '/stock', icon: Archive, roles: all, module: 'stock' },
    { name: 'Inventário e Kardex', href: '/estoque-avancado', icon: ClipboardList, roles: office, module: 'stock' },
  ]},
  { id: 'compras', title: 'Compras', icon: ShoppingBag, expandable: true, items: [
    { name: 'Solicitações e compras', href: '/compras', icon: ShoppingBag, roles: office, module: 'compras' },
    { name: 'Cotações e recebimento', href: '/compras-avancado', icon: ClipboardList, roles: office, module: 'compras' },
  ]},
  { id: 'financeiro', title: 'Financeiro', icon: Landmark, expandable: true, items: [
    { name: 'Visão financeira', href: '/financeiro', icon: DollarSign, roles: office, module: 'financeiro' },
    { name: 'Contas a pagar', href: '/contas-pagar', icon: Receipt, roles: office, module: 'contas_pagar' },
    { name: 'Pagamentos e recebimentos', href: '/pagamentos', icon: CreditCard, roles: office, module: 'pagamentos' },
    { name: 'Conciliação bancária', href: '/conciliacao', icon: ArrowDownUp, roles: office, module: 'conciliacao' },
    { name: 'Comissões', href: '/commissions', icon: PiggyBank, roles: all, module: 'commissions' },
    { name: 'DRE', href: '/dre', icon: BarChart3, roles: office, module: 'dre' },
    { name: 'Relatórios', href: '/reports', icon: FileText, roles: office, module: 'reports' },
    { name: 'Configurações financeiras', href: '/financeiro-avancado', icon: Settings, roles: office, module: 'financeiro' },
  ]},
  { id: 'fiscal', title: 'Fiscal e bancos', icon: FileText, expandable: true, items: [
    { name: 'Notas fiscais', href: '/fiscal', icon: FileText, roles: office, module: 'fiscal' },
    { name: 'Operações fiscais', href: '/fiscal-avancado', icon: ShieldCheck, roles: office, module: 'fiscal' },
    { name: 'Banco Inter', href: '/inter-avancado', icon: Building2, roles: office, module: 'pagamentos' },
  ]},
  { id: 'relacionamento', title: 'Relacionamento', icon: Star, expandable: true, items: [
    { name: 'Cashback', href: '/cashback', icon: DollarSign, roles: office, module: 'relacionamento' },
    { name: 'Fidelidade', href: '/fidelidade', icon: Star, roles: office, module: 'relacionamento' },
    { name: 'Assinaturas', href: '/assinaturas', icon: CreditCard, roles: office, module: 'relacionamento' },
  ]},
  { id: 'manutencao', title: 'Manutenção', icon: Wrench, expandable: true, items: [
    { name: 'Ordens de serviço', href: '/service-orders', icon: ClipboardCheck, roles: all, module: 'service_orders' },
  ]},
  { id: 'operacoes', title: 'Operações', icon: Navigation, expandable: true, items: [
    { name: 'Rotas externas', href: '/routes', icon: Navigation, roles: all, module: 'routes' },
    { name: 'Veículos', href: '/vehicles', icon: Car, roles: ['admin'], module: 'vehicles' },
    { name: 'Controle de SLA', href: '/sla', icon: Clock, roles: office, module: 'sla' },
  ]},
  { id: 'administracao', title: 'Administração', icon: UserCog, expandable: true, items: [
    { name: 'Controles do ERP', href: '/controles-erp', icon: ShieldCheck, roles: office, module: 'controles_erp' },
    { name: 'Usuários e acessos', href: '/users', icon: UserCog, roles: ['admin'], module: 'users' },
    { name: 'Portal do cliente', href: '/customer-portal', icon: ShieldCheck, roles: ['admin'], module: 'customer_portal' },
    { name: 'Configuração de e-mail', href: '/email-settings', icon: Mail, roles: ['admin'], module: 'email_settings' },
    { name: 'WhatsApp', href: '/whatsapp-settings', icon: MessageCircle, roles: ['admin'], module: 'whatsapp_settings' },
    { name: 'Tutorial e guias', href: '/tutorial', icon: BookOpen, roles: all },
  ]},
]
