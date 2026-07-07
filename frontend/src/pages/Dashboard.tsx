import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { DollarSign, ShoppingCart, TrendingUp, Package, ChevronDown, ChevronUp, Navigation, Award, AlertTriangle, FileText } from 'lucide-react'
import { MarketTicker } from '../components/MarketTicker'

interface DashboardData {
  totalSales: number
  totalRevenue: number
  totalProfit: number
  totalReceivable: number
  pendingCommissions: number
  lowStockProducts: number
}

interface TechCommission {
  id: string
  description: string
  amount: number
  saleId: string
}

interface TechRoute {
  id: string
  description: string
  km: number
  totalValue: number
  routeDate: string
}

interface TechSummary {
  id: string
  name: string
  commissions: TechCommission[]
  routes: TechRoute[]
  totalCommissions: number
  totalRoutes: number
  total: number
}

interface FinTask {
  id: string
  type: string
  status: string
  dueDate: string
  sale: { id: string; customer: { name: string }; totalAmount: number; paymentMethod: string }
}

const financialTaskLabels: Record<string, string> = {
  emissao_nf: 'NF',
  emissao_boleto: 'Boleto',
}

export function Dashboard() {
  const { user, isAdmin, isFinanceiro, isTecnico } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [techSummary, setTechSummary] = useState<TechSummary[]>([])
  const [financialTasks, setFinancialTasks] = useState<{ nf: FinTask[]; boleto: FinTask[]; overdue: FinTask[] }>({ nf: [], boleto: [], overdue: [] })
  const [loading, setLoading] = useState(true)
  const [expandedTech, setExpandedTech] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<Record<string, 'commissions' | 'routes' | null>>({})

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    try {
      const promises: Promise<any>[] = [api.get('/dashboard')]
      if (isAdmin || isFinanceiro) {
        promises.push(api.get('/dashboard/technicians-summary'))
        promises.push(api.get('/financial-tasks/today'))
      }
      const [dashRes, techRes, tasksRes] = await Promise.all(promises)
      setData(dashRes.data)
      if (techRes) setTechSummary(techRes.data)
      if (tasksRes) setFinancialTasks(tasksRes.data)
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleTech(id: string) {
    setExpandedTech(expandedTech === id ? null : id)
  }

  function toggleSection(techId: string, section: 'commissions' | 'routes') {
    setExpandedSection(prev => ({
      ...prev,
      [techId]: prev[techId] === section ? null : section,
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  const totalAPagar = techSummary.reduce((s, t) => s + t.total, 0)

  return (
    <div>
      {/* Header com saudação e data/hora */}
      <div className="mb-8">
        <h1 className="text-[26px] font-bold text-gray-900 tracking-tight">Olá, {user?.name}! 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Aqui está o resumo do seu negócio hoje.</p>
      </div>

      {/* Ticker de indicadores econômicos */}
      <MarketTicker />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Vendas</p>
            <p className="text-xl font-bold text-gray-900">{data?.totalSales || 0}</p>
            <p className="text-[10px] text-gray-400">Total de vendas</p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">A Receber</p>
            <p className="text-xl font-bold text-gray-900">R$ {Number(data?.totalReceivable || 0).toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">Valor pendente</p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Faturamento</p>
            <p className="text-xl font-bold text-gray-900">R$ {Number(data?.totalRevenue || 0).toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">Total faturado</p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Lucro Líquido</p>
            <p className="text-xl font-bold text-gray-900">R$ {Number(data?.totalProfit || 0).toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">Resultado líquido</p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Estoque Baixo</p>
            <p className="text-xl font-bold text-gray-900">{data?.lowStockProducts || 0}</p>
            <p className="text-[10px] text-gray-400">Itens abaixo do mínimo</p>
          </div>
        </div>
      </div>

      {/* Alertas financeiros do dia */}
      {(isAdmin || isFinanceiro) && (financialTasks.nf.length > 0 || financialTasks.boleto.length > 0 || financialTasks.overdue.length > 0) && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" /> Pendencias do Dia
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {financialTasks.overdue.length > 0 && (
              <div className="card border-l-4 border-red-500 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="font-semibold text-red-700">Atrasadas ({financialTasks.overdue.length})</span>
                </div>
                <div className="space-y-2">
                  {financialTasks.overdue.slice(0, 5).map(t => (
                    <div key={t.id} className="text-sm flex justify-between">
                      <span className="text-gray-700">{financialTaskLabels[t.type] || t.type} - {t.sale?.customer?.name}</span>
                      <span className="text-red-600 font-medium text-xs">{new Date(t.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                  {financialTasks.overdue.length > 5 && <p className="text-xs text-gray-500">+{financialTasks.overdue.length - 5} mais...</p>}
                </div>
              </div>
            )}
            {financialTasks.nf.length > 0 && (
              <div className="card border-l-4 border-yellow-500 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-yellow-500" />
                  <span className="font-semibold text-yellow-700">Emitir NF ({financialTasks.nf.length})</span>
                </div>
                <div className="space-y-2">
                  {financialTasks.nf.map(t => (
                    <div key={t.id} className="text-sm flex justify-between">
                      <span className="text-gray-700">{t.sale?.customer?.name}</span>
                      <span className="text-gray-500">R$ {Number(t.sale?.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {financialTasks.boleto.length > 0 && (
              <div className="card border-l-4 border-blue-500 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-blue-700">Emitir Boleto ({financialTasks.boleto.length})</span>
                </div>
                <div className="space-y-2">
                  {financialTasks.boleto.map(t => (
                    <div key={t.id} className="text-sm flex justify-between">
                      <span className="text-gray-700">{t.sale?.customer?.name}</span>
                      <span className="text-gray-500">R$ {Number(t.sale?.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Painel financeiro */}
      {(isAdmin || isFinanceiro) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Pagamentos Pendentes por Técnico
            </h2>
            {totalAPagar > 0 && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm text-gray-500">Total a pagar: </span>
                <span className="font-bold text-red-600 text-lg">R$ {totalAPagar.toFixed(2)}</span>
              </div>
            )}
          </div>

          {techSummary.length === 0 ? (
            <div className="card flex items-center gap-8 py-10 px-8">
              <div className="flex-shrink-0 text-6xl">📋</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Tudo em dia! 🎉</h3>
                <p className="text-sm text-gray-500 mt-1">Não há pagamentos pendentes para técnicos no momento.</p>
              </div>
              <div className="hidden lg:block flex-shrink-0 text-6xl opacity-80">💰</div>
            </div>
          ) : (
            <div className="space-y-3">
              {techSummary.map(tech => (
                <div key={tech.id} className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">

                  {/* Cabeçalho do técnico */}
                  <button
                    onClick={() => toggleTech(tech.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                        <span className="text-primary-600 dark:text-primary-400 font-bold text-sm">
                          {tech.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{tech.name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          {tech.commissions.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              {tech.commissions.length} comissão{tech.commissions.length > 1 ? 'ões' : ''}
                            </span>
                          )}
                          {tech.routes.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Navigation className="w-3 h-3" />
                              {tech.routes.length} rota{tech.routes.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {tech.totalCommissions > 0 && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-500">Comissões</p>
                          <p className="font-semibold text-purple-600">R$ {tech.totalCommissions.toFixed(2)}</p>
                        </div>
                      )}
                      {tech.totalRoutes > 0 && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-500">Rotas</p>
                          <p className="font-semibold text-blue-600">R$ {tech.totalRoutes.toFixed(2)}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-lg font-bold text-red-600">R$ {tech.total.toFixed(2)}</p>
                      </div>
                      {expandedTech === tech.id
                        ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      }
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {expandedTech === tech.id && (
                    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">

                      {/* Seção Comissões */}
                      {tech.commissions.length > 0 && (
                        <div className="border-b border-gray-100 dark:border-gray-700">
                          <button
                            onClick={() => toggleSection(tech.id, 'commissions')}
                            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-purple-500" />
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                                Comissões aprovadas ({tech.commissions.length})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-purple-600">R$ {tech.totalCommissions.toFixed(2)}</span>
                              {expandedSection[tech.id] === 'commissions'
                                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                : <ChevronDown className="w-4 h-4 text-gray-400" />
                              }
                            </div>
                          </button>

                          {expandedSection[tech.id] === 'commissions' && (
                            <div className="px-5 pb-3 space-y-2">
                              {tech.commissions.map(c => (
                                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                  <div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{c.description}</p>
                                    {c.saleId && (
                                      <p className="text-xs text-gray-400 font-mono">venda #{c.saleId.slice(0, 8)}...</p>
                                    )}
                                  </div>
                                  <span className="font-semibold text-purple-600 text-sm">R$ {c.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Seção Rotas */}
                      {tech.routes.length > 0 && (
                        <div>
                          <button
                            onClick={() => toggleSection(tech.id, 'routes')}
                            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Navigation className="w-4 h-4 text-blue-500" />
                              <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                                Rotas aprovadas ({tech.routes.length})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-blue-600">R$ {tech.totalRoutes.toFixed(2)}</span>
                              {expandedSection[tech.id] === 'routes'
                                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                : <ChevronDown className="w-4 h-4 text-gray-400" />
                              }
                            </div>
                          </button>

                          {expandedSection[tech.id] === 'routes' && (
                            <div className="px-5 pb-3 space-y-2">
                              {tech.routes.map(r => (
                                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                  <div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{r.description}</p>
                                    <p className="text-xs text-gray-400">
                                      {new Date(r.routeDate + 'T12:00:00').toLocaleDateString('pt-BR')} · {Number(r.km).toFixed(1)} km
                                    </p>
                                  </div>
                                  <span className="font-semibold text-blue-600 text-sm">R$ {Number(r.totalValue).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rodapé com total */}
                      <div className="flex justify-end items-center gap-2 px-5 py-3 bg-gray-100 dark:bg-gray-700/50">
                        <span className="text-sm text-gray-500">Total a pagar para {tech.name}:</span>
                        <span className="text-lg font-bold text-red-600">R$ {tech.total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ações rápidas + Informações */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(isTecnico || isAdmin) && (
              <>
                <Link to="/sales/new" className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all group">
                  <div className="w-10 h-10 bg-blue-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">+ Nova Venda</p>
                    <p className="text-xs text-gray-500">Cadastrar nova venda</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/routes" className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all group">
                  <div className="w-10 h-10 bg-indigo-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">+ Registrar Rota Externa</p>
                    <p className="text-xs text-gray-500">Adicionar nova rota externa</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90 group-hover:translate-x-1 transition-transform" />
                </Link>
              </>
            )}
            {(isAdmin || isFinanceiro) && (
              <>
                <Link to="/commissions" className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-all group">
                  <div className="w-10 h-10 bg-purple-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-purple-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Gerenciar Comissões</p>
                    <p className="text-xs text-gray-500">Visualizar e gerenciar comissões</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/routes" className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all group">
                  <div className="w-10 h-10 bg-emerald-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Gerenciar Rotas Externas</p>
                    <p className="text-xs text-gray-500">Gerenciar todas as rotas</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/reports" className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition-all group sm:col-span-2">
                  <div className="w-10 h-10 bg-orange-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-orange-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Ver Relatórios</p>
                    <p className="text-xs text-gray-500">Acessar relatórios do sistema</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90 group-hover:translate-x-1 transition-transform" />
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informações do Sistema</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 flex items-center gap-2">👤 Perfil</span>
              <span className="text-sm font-semibold text-gray-900">
                {user?.role === 'admin' && 'Administrador'}
                {user?.role === 'financeiro' && 'Financeiro'}
                {user?.role === 'tecnico' && 'Técnico'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 flex items-center gap-2">✉️ Email</span>
              <span className="text-sm font-medium text-gray-700">{user?.email}</span>
            </div>
            {(isAdmin || isFinanceiro) && data && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 flex items-center gap-2">💰 Comissões pendentes</span>
                  <span className="text-sm font-bold text-orange-600">R$ {Number(data.pendingCommissions).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500 flex items-center gap-2">📦 Produtos com estoque baixo</span>
                  <span className={`text-sm font-bold ${data.lowStockProducts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.lowStockProducts}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 flex items-center gap-2">{'</>'} Versão do Sistema</span>
              <span className="text-sm font-medium text-gray-700">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500 flex items-center gap-2">🕐 Último acesso</span>
              <span className="text-sm font-medium text-gray-700">{new Date().toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 py-4">
        © {new Date().getFullYear()} Gestão TI. Todos os direitos reservados.
      </div>
    </div>
  )
}
