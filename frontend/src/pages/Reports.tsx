import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { FileText, TrendingUp, DollarSign, ShoppingCart, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Copy, ClipboardList } from 'lucide-react'
import { useFeedback } from '../components/ui'

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

interface Movement {
  id: string; type: string; category: string; description: string;
  value: number; date: string; isForecast: boolean;
}

const categoryLabels: Record<string, string> = {
  venda: 'Vendas', comissao: 'Comissões', taxa_cartao: 'Taxas de Cartão',
  estorno: 'Estornos', devolucao: 'Devoluções', outros: 'Outros',
  aluguel: 'Aluguel', energia: 'Energia', internet: 'Internet', telefone: 'Telefone',
  agua: 'Água', material: 'Material', servico: 'Serviço', impostos: 'Impostos',
  salarios: 'Salários', software: 'Software', equipamentos: 'Equipamentos',
  manutencao: 'Manutenção', marketing: 'Marketing',
}
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

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
function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}
function formatCurrency(v: number) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Tab = 'vendas' | 'contabilidade'

export function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('vendas')
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

  const tabItems: { key: Tab; label: string; icon: any }[] = [
    { key: 'vendas', label: 'Vendas', icon: TrendingUp },
    { key: 'contabilidade', label: 'Entradas e Saídas', icon: ClipboardList },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {tabItems.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ' +
                (activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'contabilidade' && <AccountingReportTab />}

      {activeTab === 'vendas' && (loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : (
      <>
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
      </>
      ))}
    </div>
  )
}

function AccountingReportTab() {
  const { notify } = useFeedback()
  const [month, setMonth] = useState(currentMonth())
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { start, end } = monthBounds(month)
      const res = await api.get('/financial/movements', { params: { startDate: start, endDate: end, isForecast: false } })
      setMovements(res.data)
    } catch { setError('Erro ao carregar entradas e saídas') }
    finally { setLoading(false) }
  }

  const entradas = useMemo(() => movements.filter(m => m.type === 'receita'), [movements])
  const saidas = useMemo(() => movements.filter(m => m.type === 'despesa'), [movements])
  const estornos = useMemo(() => movements.filter(m => m.type === 'estorno'), [movements])
  const totalEntradas = entradas.reduce((s, m) => s + Number(m.value), 0)
  const totalSaidas = saidas.reduce((s, m) => s + Number(m.value), 0) + estornos.reduce((s, m) => s + Number(m.value), 0)
  const saldo = totalEntradas - totalSaidas

  function groupByCategory(items: Movement[]) {
    const groups: Record<string, number> = {}
    for (const m of items) groups[m.category] = (groups[m.category] || 0) + Number(m.value)
    return Object.entries(groups).sort((a, b) => b[1] - a[1])
  }

  const message = useMemo(() => {
    const lines: string[] = []
    lines.push(`*Relatório Financeiro - ${monthLabel(month)}*`)
    lines.push('')
    lines.push(`*ENTRADAS: ${formatCurrency(totalEntradas)}*`)
    for (const [cat, total] of groupByCategory(entradas)) {
      lines.push(`- ${categoryLabels[cat] || cat}: ${formatCurrency(total)}`)
    }
    lines.push('')
    lines.push(`*SAÍDAS: ${formatCurrency(totalSaidas)}*`)
    for (const [cat, total] of groupByCategory(saidas)) {
      lines.push(`- ${categoryLabels[cat] || cat}: ${formatCurrency(total)}`)
    }
    if (estornos.length > 0) {
      lines.push(`- Estornos: ${formatCurrency(estornos.reduce((s, m) => s + Number(m.value), 0))}`)
    }
    lines.push('')
    lines.push(`*SALDO DO MÊS: ${formatCurrency(saldo)}*`)
    return lines.join('\n')
  }, [month, entradas, saidas, estornos, totalEntradas, totalSaidas, saldo])

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      notify('Mensagem copiada! Cole no WhatsApp ou e-mail para a contabilidade.', 'success')
    } catch {
      setError('Não foi possível copiar a mensagem')
    }
  }

  return (
    <div>
      {/* Navegador de mês */}
      <div className="card mb-6 flex items-center justify-center gap-4 py-3">
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Mês anterior">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-gray-900 dark:text-white capitalize min-w-48 text-center">{monthLabel(month)}</span>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Próximo mês">
          <ChevronRight className="w-5 h-5" />
        </button>
        {month !== currentMonth() && (
          <button onClick={() => setMonth(currentMonth())} className="text-xs text-primary-600 hover:underline ml-2">voltar para o mês atual</button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card flex items-center gap-3 py-4 border-l-4 border-l-green-500">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><ArrowDownCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total de Entradas</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalEntradas)}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 py-4 border-l-4 border-l-red-500">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><ArrowUpCircle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total de Saídas</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalSaidas)}</p>
              </div>
            </div>
            <div className={'card flex items-center gap-3 py-4 border-l-4 ' + (saldo >= 0 ? 'border-l-green-500' : 'border-l-red-500')}>
              <div className={'w-10 h-10 rounded-lg flex items-center justify-center ' + (saldo >= 0 ? 'bg-green-100' : 'bg-red-100')}><DollarSign className={'w-5 h-5 ' + (saldo >= 0 ? 'text-green-600' : 'text-red-600')} /></div>
              <div>
                <p className="text-xs text-gray-500">Saldo do Mês</p>
                <p className={'text-xl font-bold ' + (saldo >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(saldo)}</p>
              </div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4" /> Mensagem para a contabilidade</h3>
              <button onClick={copyMessage} className="btn btn-primary flex items-center gap-2 text-sm"><Copy className="w-4 h-4" /> Copiar mensagem</button>
            </div>
            <textarea readOnly value={message} rows={10} className="input font-mono text-sm" onFocus={e => e.target.select()} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card overflow-hidden p-0">
              <h3 className="font-semibold text-gray-900 dark:text-white p-4 pb-2">Entradas ({entradas.length})</h3>
              <table className="table">
                <tbody className="divide-y divide-gray-200">
                  {entradas.length === 0 ? (
                    <tr><td className="table-cell text-center text-gray-500 py-4">Nenhuma entrada no mês</td></tr>
                  ) : entradas.map(m => (
                    <tr key={m.id}>
                      <td className="table-cell text-sm">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="table-cell text-sm">{m.description || categoryLabels[m.category] || m.category}</td>
                      <td className="table-cell text-sm font-semibold text-green-600 text-right">+ {formatCurrency(Number(m.value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card overflow-hidden p-0">
              <h3 className="font-semibold text-gray-900 dark:text-white p-4 pb-2">Saídas ({saidas.length + estornos.length})</h3>
              <table className="table">
                <tbody className="divide-y divide-gray-200">
                  {saidas.length + estornos.length === 0 ? (
                    <tr><td className="table-cell text-center text-gray-500 py-4">Nenhuma saída no mês</td></tr>
                  ) : [...saidas, ...estornos].map(m => (
                    <tr key={m.id}>
                      <td className="table-cell text-sm">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="table-cell text-sm">{m.description || categoryLabels[m.category] || m.category}</td>
                      <td className="table-cell text-sm font-semibold text-red-600 text-right">- {formatCurrency(Number(m.value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
