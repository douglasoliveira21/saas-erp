import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, DollarSign, TrendingUp, PackageCheck } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'

interface Dashboard {
  totalTenants: number
  byStatus: Record<string, number>
  totalUsers: number
  mrr: number
  planDistribution: { name: string; count: number }[]
  monthlyGrowth: { month: string; count: number }[]
  recentTenants: { id: string; name: string; status: string; planName: string | null; createdAt: string }[]
}

const statusLabels: Record<string, string> = { ativo: 'Ativos', suspenso: 'Suspensos', cancelado: 'Cancelados' }
const statusColors: Record<string, string> = { ativo: 'bg-green-500/20 text-green-300', suspenso: 'bg-yellow-500/20 text-yellow-300', cancelado: 'bg-red-500/20 text-red-300' }

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function monthLabel(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center gap-2 text-gray-400"><Icon className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">{label}</span></div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

export function SuperAdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    superAdminApi.get('/tenants/dashboard/summary').then(r => setData(r.data)).catch(() => setError('Erro ao carregar dashboard'))
  }, [])

  if (error) return <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
  if (!data) return <p className="text-gray-400">Carregando...</p>

  const maxGrowth = Math.max(1, ...data.monthlyGrowth.map(m => m.count))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visão geral</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Building2} label="Clientes ativos" value={String(data.byStatus.ativo || 0)} hint={`${data.totalTenants} no total`} />
        <StatCard icon={Users} label="Usuários" value={String(data.totalUsers)} hint="em todos os clientes" />
        <StatCard icon={DollarSign} label="MRR estimado" value={money(data.mrr)} hint="soma dos planos de clientes ativos" />
        <StatCard icon={TrendingUp} label="Suspensos/Cancelados" value={String((data.byStatus.suspenso || 0) + (data.byStatus.cancelado || 0))} hint={`${data.byStatus.suspenso || 0} suspensos · ${data.byStatus.cancelado || 0} cancelados`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-200"><TrendingUp className="h-4 w-4" /> Novos clientes (últimos 6 meses)</div>
          <div className="flex h-32 items-end gap-3">
            {data.monthlyGrowth.map(m => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${Math.max(4, (m.count / maxGrowth) * 100)}%` }} title={`${m.count} clientes`} />
                <span className="text-xs text-gray-500">{monthLabel(m.month)}</span>
              </div>
            ))}
            {data.monthlyGrowth.length === 0 && <p className="text-sm text-gray-500">Sem dados ainda</p>}
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-200"><PackageCheck className="h-4 w-4" /> Distribuição por plano</div>
          <div className="space-y-2">
            {data.planDistribution.map(p => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{p.name}</span>
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{p.count}</span>
              </div>
            ))}
            {data.planDistribution.length === 0 && <p className="text-sm text-gray-500">Nenhum cliente com plano atribuído</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-200">Clientes recentes</span>
          <Link to="/super-admin/tenants" className="text-xs text-amber-400 hover:underline">Ver todos</Link>
        </div>
        <div className="divide-y divide-gray-800">
          {data.recentTenants.map(t => (
            <div key={t.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-gray-200">{t.name}</p>
                <p className="text-xs text-gray-500">{t.planName || 'Sem plano'} · {new Date(t.createdAt).toLocaleDateString('pt-BR')}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[t.status] || ''}`}>{statusLabels[t.status] || t.status}</span>
            </div>
          ))}
          {data.recentTenants.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Nenhum cliente ainda</p>}
        </div>
      </div>
    </div>
  )
}
