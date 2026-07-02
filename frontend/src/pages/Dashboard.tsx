import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { DollarSign, ShoppingCart, TrendingUp, Package, ChevronDown, ChevronUp, Navigation, Award, AlertTriangle, FileText, CheckCircle } from 'lucide-react'

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Bem-vindo, {user?.name}!</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Vendas</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{data?.totalSales || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">A Receber</p>
              <p className="text-xl font-bold text-yellow-600">R$ {Number(data?.totalReceivable || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Faturamento</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {Number(data?.totalRevenue || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Lucro Liquido</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">R$ {Number(data?.totalProfit || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg">
              <Package className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Estoque Baixo</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{data?.lowStockProducts || 0}</p>
            </div>
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
                      <span className="text-gray-700">{t.type === 'emissao_nf' ? 'NF' : 'Boleto'} - {t.sale?.customer?.name}</span>
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
            <div className="card text-center text-gray-500 py-8">
              ✅ Nenhum pagamento pendente para técnicos
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

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ações Rápidas</h2>
          <div className="space-y-3">
            {(isTecnico || isAdmin) && (
              <>
                <a href="/sales/new" className="block px-4 py-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 transition-colors">
                  + Nova Venda
                </a>
                <a href="/routes" className="block px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors">
                  + Registrar Rota Externa
                </a>
              </>
            )}
            {(isAdmin || isFinanceiro) && (
              <>
                <a href="/commissions" className="block px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 transition-colors">
                  Gerenciar Comissoes
                </a>
                <a href="/routes" className="block px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors">
                  Gerenciar Rotas Externas
                </a>
                <a href="/reports" className="block px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 transition-colors">
                  Ver Relatorios
                </a>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações do Sistema</h2>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Perfil:</strong>{' '}
              {user?.role === 'admin' && 'Administrador'}
              {user?.role === 'financeiro' && 'Financeiro'}
              {user?.role === 'tecnico' && 'Técnico'}
            </p>
            <p><strong>Email:</strong> {user?.email}</p>
            {(isAdmin || isFinanceiro) && data && (
              <>
                <hr className="border-gray-200 dark:border-gray-700" />
                <p><strong>Comissões pendentes:</strong>{' '}
                  <span className="text-yellow-600 font-semibold">R$ {Number(data.pendingCommissions).toFixed(2)}</span>
                </p>
                <p><strong>Produtos com estoque baixo:</strong>{' '}
                  <span className={data.lowStockProducts > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    {data.lowStockProducts}
                  </span>
                </p>
              </>
            )}
            <p><strong>Versão:</strong> 1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
