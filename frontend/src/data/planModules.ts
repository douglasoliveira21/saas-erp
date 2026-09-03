// Catálogo de módulos que um plano pode habilitar/desabilitar para um tenant. As chaves
// espelham as seções de frontend/src/components/navigation.ts — quando a Fase 3 (aplicação
// dos planos) chegar, o filtro do menu passa a usar esta mesma lista.
export interface PlanModuleGroup { group: string; modules: [string, string][] }

export const PLAN_MODULE_GROUPS: PlanModuleGroup[] = [
  { group: 'Principal', modules: [['dashboard', 'Dashboard']] },
  { group: 'Comercial e vendas', modules: [
    ['crm', 'CRM de oportunidades'],
    ['orcamentos', 'Orçamentos'],
    ['pre_vendas', 'Pré-vendas'],
    ['sales', 'Vendas'],
    ['pdv', 'PDV'],
    ['vendas_recorrentes', 'Vendas recorrentes'],
    ['contracts', 'Contratos'],
  ]},
  { group: 'Catálogo e estoque', modules: [
    ['products', 'Produtos'],
    ['services', 'Serviços'],
    ['stock', 'Posição de estoque'],
    ['estoque_avancado', 'Inventário e Kardex'],
  ]},
  { group: 'Compras', modules: [['compras', 'Solicitações e compras']] },
  { group: 'Financeiro', modules: [
    ['financeiro', 'Visão financeira'],
    ['contas_pagar', 'Contas a pagar'],
    ['pagamentos', 'Pagamentos e recebimentos'],
    ['conciliacao', 'Conciliação bancária'],
    ['commissions', 'Comissões'],
    ['dre', 'DRE'],
    ['reports', 'Relatórios'],
    ['financeiro_avancado', 'Configurações financeiras'],
  ]},
  { group: 'Fiscal e bancos', modules: [
    ['fiscal', 'Notas fiscais'],
    ['fiscal_avancado', 'Operações fiscais'],
    ['inter_avancado', 'Banco Inter'],
  ]},
  { group: 'Relacionamento', modules: [['relacionamento', 'Cashback / Fidelidade / Assinaturas']] },
  { group: 'Operações', modules: [
    ['service_orders', 'Ordens de serviço'],
    ['routes', 'Rotas externas'],
    ['vehicles', 'Veículos'],
    ['sla', 'Controle de SLA'],
  ]},
  { group: 'Administração', modules: [
    ['controles_erp', 'Controles do ERP'],
    ['users', 'Usuários e acessos'],
    ['customer_portal', 'Portal do cliente'],
    ['email_settings', 'Configuração de e-mail'],
    ['whatsapp_settings', 'WhatsApp'],
  ]},
]

export const ALL_PLAN_MODULE_KEYS: string[] = PLAN_MODULE_GROUPS.flatMap(g => g.modules.map(([key]) => key))
