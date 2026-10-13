import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock, DollarSign,
  Navigation, Plus, ShoppingCart, Timer, Wallet,
} from 'lucide-react'

interface ActiveOrder {
  id: string
  number: number
  customerName: string
  serviceType: string
  equipment: string
  statusKey: string
  statusLabel: string
  statusColor: string
  openedAt: string
  daysOpen: number
}

interface TechnicianDashboardData {
  month: string
  serviceOrders: {
    open: number
    stale: number
    staleDays: number
    completedMonth: number
    avgHoursToComplete: number
    active: ActiveOrder[]
  }
  routes: {
    count: number
    km: number
    totalValue: number
    byStatus: Record<string, { count: number; value: number }>
    recent: Array<{ id: string; date: string; description: string; km: number; totalValue: number; status: string }>
  }
  commissions: { pending: number; paidMonth: number }
  sales: { count: number; total: number; paid: number }
}

const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const routeStatusLabels: Record<string, string> = { pendente: 'Pendente', aprovada: 'Aprovada', paga: 'Paga', rejeitada: 'Rejeitada', cancelada: 'Cancelada' }
const routeStatusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  aprovada: 'bg-blue-100 text-blue-700',
  paga: 'bg-green-100 text-green-700',
  rejeitada: 'bg-red-100 text-red-700',
  cancelada: 'bg-gray-100 text-gray-600',
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return `${monthNames[m - 1]} de ${y}`
}
function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

export function TechnicianDashboard() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<TechnicianDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/dashboard/technician', { params: { month }, timeout: 15000 })
      setData(res.data)
    } catch {
      setError('Não foi possível carregar o seu painel.')
    } finally {
      setLoading(false)
    }
  }

  const firstName = (user?.name || '').split(' ')[0]
  const isCurrentMonth = month === currentMonth()
  const orders = data?.serviceOrders

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-gray-900 tracking-tight">{greeting()}, {firstName}!</h1>
          <p className="mt-1 text-sm text-gray-500">Seu painel de trabalho: ordens de serviço, rotas, comissões e vendas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/service-orders/new" className="btn btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Nova ordem de serviço</Link>
          <Link to="/routes" className="btn btn-secondary flex items-center gap-2"><Navigation className="h-4 w-4" /> Lançar rota</Link>
        </div>
      </div>

      <div className="card mb-6 flex items-center justify-center gap-4 py-3">
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="rounded-lg p-2 hover:bg-gray-100" title="Mês anterior"><ChevronLeft className="h-5 w-5" /></button>
        <span className="min-w-48 text-center text-base font-semibold capitalize text-gray-900">{monthLabel(month)}</span>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} className="rounded-lg p-2 hover:bg-gray-100" title="Próximo mês"><ChevronRight className="h-5 w-5" /></button>
        {!isCurrentMonth && <button onClick={() => setMonth(currentMonth())} className="ml-2 text-xs text-primary-600 hover:underline">voltar para o mês atual</button>}
      </div>

      {error && (
        <div className="card mb-6 text-center" role="alert">
          <p className="text-sm text-red-600">{error}</p>
          <button className="btn btn-primary mt-3" onClick={load}>Tentar novamente</button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex h-48 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" /></div>
      ) : data && orders && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100"><ClipboardCheck className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">OS em aberto</p>
                <p className="text-xl font-bold text-gray-900">{orders.open}</p>
                <p className="text-[10px] text-gray-400">atribuídas a você</p>
              </div>
            </div>
            <div className={'card flex items-center gap-4 ' + (orders.stale > 0 ? 'border-l-4 border-l-orange-400' : '')}>
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-100"><AlertTriangle className="h-6 w-6 text-orange-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Paradas há {orders.staleDays}+ dias</p>
                <p className="text-xl font-bold text-gray-900">{orders.stale}</p>
                <p className="text-[10px] text-gray-400">{orders.stale > 0 ? 'precisam de atenção' : 'tudo em dia'}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-green-100"><CheckCircle2 className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Concluídas no mês</p>
                <p className="text-xl font-bold text-gray-900">{orders.completedMonth}</p>
                <p className="text-[10px] text-gray-400">ordens de serviço</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-purple-100"><Timer className="h-6 w-6 text-purple-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Tempo médio de atendimento</p>
                <p className="text-xl font-bold text-gray-900">{orders.avgHoursToComplete ? `${orders.avgHoursToComplete.toLocaleString('pt-BR')} h` : '-'}</p>
                <p className="text-[10px] text-gray-400">do início à conclusão</p>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-yellow-100"><Clock className="h-6 w-6 text-yellow-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Comissões a receber</p>
                <p className="text-xl font-bold text-yellow-600">{money(data.commissions.pending)}</p>
                <p className="text-[10px] text-gray-400">pendentes de pagamento</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-green-100"><Wallet className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Comissões pagas no mês</p>
                <p className="text-xl font-bold text-green-600">{money(data.commissions.paidMonth)}</p>
                <p className="text-[10px] text-gray-400 capitalize">{monthLabel(month)}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-100"><Navigation className="h-6 w-6 text-indigo-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Rotas no mês</p>
                <p className="text-xl font-bold text-gray-900">{data.routes.count}</p>
                <p className="text-[10px] text-gray-400">{data.routes.km.toLocaleString('pt-BR')} km · {money(data.routes.totalValue)}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-100"><ShoppingCart className="h-6 w-6 text-sky-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Minhas vendas no mês</p>
                <p className="text-xl font-bold text-gray-900">{data.sales.count}</p>
                <p className="text-[10px] text-gray-400">{money(data.sales.total)} · {money(data.sales.paid)} recebido</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="card xl:col-span-2 overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-900">Minhas ordens de serviço em aberto</h2>
                <Link to="/service-orders" className="text-sm text-primary-600 hover:underline">Ver todas</Link>
              </div>
              {orders.active.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-gray-500">Nenhuma ordem de serviço em aberto. Bom trabalho!</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {orders.active.map(order => (
                    <li key={order.id}>
                      <Link to={`/service-orders/${order.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            <span className="text-gray-400">#{String(order.number).padStart(5, '0')}</span> · {order.customerName}
                          </p>
                          <p className="truncate text-xs text-gray-500">{[order.serviceType, order.equipment].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: order.statusColor }}>{order.statusLabel}</span>
                          <span className={'text-[11px] ' + (order.daysOpen >= orders.staleDays ? 'font-semibold text-orange-600' : 'text-gray-400')}>
                            {order.daysOpen === 0 ? 'aberta hoje' : `aberta há ${order.daysOpen} ${order.daysOpen === 1 ? 'dia' : 'dias'}`}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {orders.open > orders.active.length && (
                <p className="border-t border-gray-100 px-5 py-3 text-center text-xs text-gray-500">
                  Mostrando as {orders.active.length} mais antigas de {orders.open}. <Link to="/service-orders" className="text-primary-600 hover:underline">Ver todas</Link>
                </p>
              )}
            </div>

            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-900">Minhas rotas do mês</h2>
                <Link to="/routes" className="text-sm text-primary-600 hover:underline">Ver todas</Link>
              </div>
              {Object.keys(data.routes.byStatus).length > 0 && (
                <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3">
                  {Object.entries(data.routes.byStatus).map(([status, info]) => (
                    <span key={status} className={'rounded-full px-2.5 py-1 text-xs font-medium ' + (routeStatusColors[status] || 'bg-gray-100 text-gray-600')}>
                      {routeStatusLabels[status] || status}: {info.count} · {money(info.value)}
                    </span>
                  ))}
                </div>
              )}
              {data.routes.recent.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-gray-500">Nenhuma rota lançada neste mês.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.routes.recent.map(route => (
                    <li key={route.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{route.description}</p>
                        <p className="text-xs text-gray-500">{new Date(route.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {route.km.toLocaleString('pt-BR')} km</p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-gray-900">{money(route.totalValue)}</span>
                        <span className={'rounded-full px-2 py-0.5 text-[11px] font-medium ' + (routeStatusColors[route.status] || 'bg-gray-100 text-gray-600')}>{routeStatusLabels[route.status] || route.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link to="/commissions" className="inline-flex items-center gap-2 text-primary-600 hover:underline"><DollarSign className="h-4 w-4" /> Ver minhas comissões</Link>
            <Link to="/sales" className="inline-flex items-center gap-2 text-primary-600 hover:underline"><ShoppingCart className="h-4 w-4" /> Ver minhas vendas</Link>
          </div>
        </>
      )}
    </div>
  )
}
