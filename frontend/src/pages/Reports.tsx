import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import { FileText, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react'

interface SaleReport {
  totalSales: number
  totalRevenue: number
  totalProfit: number
  totalCommissions: number
  byStatus: { status: string; count: number; total: number }[]
  byPayment: { method: string; count: number; total: number }[]
  byTechnician: { name: string; count: number; total: number; commission: number }[]
  monthly: { month: string; total: number; profit: number }[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'Crédito', cartao_debito: 'Débito',
  pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto'
}

export function Reports() {
  const [data, setData] = useState<SaleReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get(`/reports/sales?startDate=${startDate}&endDate=${endDate}`)
      setData(res.data)
    } catch { setError('Erro ao carregar relatórios') }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inicial</label>
            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Final</label>
            <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={load} className="btn btn-primary flex items-center gap-2">
            <FileText className="w-4 h-4" /> Gerar Relatório
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-blue-600" /></div>
              <div><p className="text-xs text-gray-500">Total Vendas</p><p className="text-xl font-bold">{data.totalSales}</p></div>
            </div>
            <div className="card flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
              <div><p className="text-xs text-gray-500">Faturamento</p><p className="text-xl font-bold">R$ {Number(data.totalRevenue).toFixed(2)}</p></div>
            </div>
            <div className="card flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
              <div><p className="text-xs text-gray-500">Lucro Líquido</p><p className="text-xl font-bold">R$ {Number(data.totalProfit).toFixed(2)}</p></div>
            </div>
            <div className="card flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-yellow-600" /></div>
              <div><p className="text-xs text-gray-500">Comissões</p><p className="text-xl font-bold">R$ {Number(data.totalCommissions).toFixed(2)}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Gráfico mensal */}
            {data.monthly?.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Faturamento Mensal</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => `R$ ${Number(v).toFixed(2)}`} />
                    <Bar dataKey="total" fill="#3b82f6" name="Faturamento" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" fill="#10b981" name="Lucro" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Por forma de pagamento */}
            {data.byPayment?.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Por Forma de Pagamento</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={data.byPayment.map(p => ({ ...p, name: paymentLabels[p.method] || p.method }))} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {data.byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `R$ ${Number(v).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Por técnico */}
          {data.byTechnician?.length > 0 && (
            <div className="card mb-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Desempenho por Técnico</h2>
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell font-semibold text-gray-700">Técnico</th>
                    <th className="table-cell font-semibold text-gray-700">Vendas</th>
                    <th className="table-cell font-semibold text-gray-700">Faturamento</th>
                    <th className="table-cell font-semibold text-gray-700">Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.byTechnician.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{t.name}</td>
                      <td className="table-cell">{t.count}</td>
                      <td className="table-cell font-medium text-green-600">R$ {Number(t.total).toFixed(2)}</td>
                      <td className="table-cell text-yellow-600">R$ {Number(t.commission).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
