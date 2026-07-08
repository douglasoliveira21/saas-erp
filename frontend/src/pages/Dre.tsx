import { useEffect, useState } from 'react'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line,
} from 'recharts'
import { TrendingUp, TrendingDown, Calendar, BarChart3 } from 'lucide-react'

interface DreMonth {
  month: number
  year: number
  label: string
  receitaBruta: number
  cmv: number
  lucroBruto: number
  despesasOperacionais: number
  comissoes: number
  contasPagas: number
  despesasFixas: number
  ebitda: number
  depreciacao: number
  lucroOperacional: number
  impostos: number
  lucroLiquido: number
  margemBruta: number
  margemEbitda: number
  margemLiquida: number
}

interface DreData {
  year: number
  months: DreMonth[]
  totals: {
    receitaBruta: number
    cmv: number
    lucroBruto: number
    despesasOperacionais: number
    ebitda: number
    depreciacao: number
    lucroOperacional: number
    impostos: number
    lucroLiquido: number
    margemBruta: number
    margemEbitda: number
    margemLiquida: number
  }
}

const MONTHS_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function Dre() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [viewMode, setViewMode] = useState<'anual' | 'mensal'>('anual')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [data, setData] = useState<DreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [year, viewMode, selectedMonth])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const params = viewMode === 'mensal' ? `?year=${year}&month=${selectedMonth}` : `?year=${year}`
      const res = await api.get(`/reports/dre${params}`)
      setData(res.data)
    } catch {
      setError('Erro ao carregar DRE')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DRE - Demonstrativo de Resultado</h1>
            <p className="text-sm text-gray-500">Análise de resultados do exercício</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ano</label>
            <select
              className="input"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Visualização</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setViewMode('anual')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'anual' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Anual
              </button>
              <button
                onClick={() => setViewMode('mensal')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'mensal' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Mensal
              </button>
            </div>
          </div>

          {viewMode === 'mensal' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mês</label>
              <select
                className="input"
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
              >
                {MONTHS_LABELS.map((label, i) => (
                  <option key={i} value={i + 1}>{label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Receita Bruta</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(data.totals.receitaBruta)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Lucro Bruto</p>
              <p className={`text-xl font-bold ${data.totals.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.totals.lucroBruto)}
              </p>
              <p className="text-xs text-gray-400">Margem: {formatPercent(data.totals.margemBruta)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">EBITDA</p>
              <p className={`text-xl font-bold ${data.totals.ebitda >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.totals.ebitda)}
              </p>
              <p className="text-xs text-gray-400">Margem: {formatPercent(data.totals.margemEbitda)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Lucro Líquido</p>
              <p className={`text-xl font-bold ${data.totals.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.totals.lucroLiquido)}
              </p>
              <p className="text-xs text-gray-400">Margem: {formatPercent(data.totals.margemLiquida)}</p>
            </div>
          </div>

          {/* DRE Table */}
          <div className="card mb-6 overflow-x-auto">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              Demonstrativo de Resultado - {year}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700 min-w-[200px]">Conta</th>
                  {viewMode === 'anual' ? (
                    <>
                      {data.months.map(m => (
                        <th key={m.month} className="text-right py-3 px-2 font-semibold text-gray-700 min-w-[100px]">
                          {MONTHS_LABELS[m.month - 1]}
                        </th>
                      ))}
                      <th className="text-right py-3 px-2 font-bold text-gray-900 min-w-[120px] bg-gray-50">Total</th>
                    </>
                  ) : (
                    <th className="text-right py-3 px-2 font-semibold text-gray-700 min-w-[140px]">
                      {MONTHS_LABELS[selectedMonth - 1]}/{year}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* Receita Bruta */}
                <DreRow
                  label="(+) Receita Bruta"
                  months={data.months}
                  field="receitaBruta"
                  total={data.totals.receitaBruta}
                  viewMode={viewMode}
                  isSubtotal
                />
                {/* CMV */}
                <DreRow
                  label="(-) CMV (Custo Mercadoria Vendida)"
                  months={data.months}
                  field="cmv"
                  total={data.totals.cmv}
                  viewMode={viewMode}
                  negate
                />
                {/* Lucro Bruto */}
                <DreRow
                  label="(=) Lucro Bruto"
                  months={data.months}
                  field="lucroBruto"
                  total={data.totals.lucroBruto}
                  viewMode={viewMode}
                  isTotal
                  highlight
                />
                {/* Separator */}
                <tr><td colSpan={100} className="py-1"></td></tr>
                {/* Despesas detail */}
                <DreRow
                  label="    Comissões"
                  months={data.months}
                  field="comissoes"
                  total={data.months.reduce((s, m) => s + m.comissoes, 0)}
                  viewMode={viewMode}
                  negate
                  isDetail
                />
                <DreRow
                  label="    Contas Fornecedores"
                  months={data.months}
                  field="contasPagas"
                  total={data.months.reduce((s, m) => s + m.contasPagas, 0)}
                  viewMode={viewMode}
                  negate
                  isDetail
                />
                <DreRow
                  label="    Despesas Fixas"
                  months={data.months}
                  field="despesasFixas"
                  total={data.months.reduce((s, m) => s + m.despesasFixas, 0)}
                  viewMode={viewMode}
                  negate
                  isDetail
                />
                <DreRow
                  label="(-) Total Despesas Operacionais"
                  months={data.months}
                  field="despesasOperacionais"
                  total={data.totals.despesasOperacionais}
                  viewMode={viewMode}
                  negate
                  isSubtotal
                />
                {/* EBITDA */}
                <DreRow
                  label="(=) EBITDA"
                  months={data.months}
                  field="ebitda"
                  total={data.totals.ebitda}
                  viewMode={viewMode}
                  isTotal
                  highlight
                />
                {/* Depreciação */}
                <DreRow
                  label="(-) Depreciação/Amortização"
                  months={data.months}
                  field="depreciacao"
                  total={data.totals.depreciacao}
                  viewMode={viewMode}
                  negate
                />
                {/* Lucro Operacional */}
                <DreRow
                  label="(=) Lucro Operacional"
                  months={data.months}
                  field="lucroOperacional"
                  total={data.totals.lucroOperacional}
                  viewMode={viewMode}
                  isSubtotal
                />
                {/* Impostos */}
                <DreRow
                  label="(-) Impostos"
                  months={data.months}
                  field="impostos"
                  total={data.totals.impostos}
                  viewMode={viewMode}
                  negate
                />
                {/* Lucro Líquido */}
                <DreRow
                  label="(=) Lucro Líquido"
                  months={data.months}
                  field="lucroLiquido"
                  total={data.totals.lucroLiquido}
                  viewMode={viewMode}
                  isTotal
                  highlight
                />
                {/* Separator */}
                <tr><td colSpan={100} className="py-2 border-t border-gray-200"></td></tr>
                {/* Margins */}
                <DreRow
                  label="Margem Bruta (%)"
                  months={data.months}
                  field="margemBruta"
                  total={data.totals.margemBruta}
                  viewMode={viewMode}
                  isPercent
                />
                <DreRow
                  label="Margem EBITDA (%)"
                  months={data.months}
                  field="margemEbitda"
                  total={data.totals.margemEbitda}
                  viewMode={viewMode}
                  isPercent
                />
                <DreRow
                  label="Margem Líquida (%)"
                  months={data.months}
                  field="margemLiquida"
                  total={data.totals.margemLiquida}
                  viewMode={viewMode}
                  isPercent
                />
              </tbody>
            </table>
          </div>

          {/* Charts */}
          {viewMode === 'anual' && data.months.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Bar Chart - Receita vs Despesas */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Receita vs Despesas
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.months.map(m => ({
                    name: MONTHS_LABELS[m.month - 1],
                    receita: m.receitaBruta,
                    despesas: m.despesasOperacionais + m.cmv,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line Chart - Lucro Líquido + Margins */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-blue-500" />
                  Evolução do Resultado
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={data.months.map(m => ({
                    name: MONTHS_LABELS[m.month - 1],
                    lucroLiquido: m.lucroLiquido,
                    ebitda: m.ebitda,
                    margemLiquida: m.margemLiquida,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip formatter={(v: number, name: string) =>
                      name === 'Margem Líquida' ? formatPercent(v) : formatCurrency(v)
                    } />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="ebitda" name="EBITDA" fill="#dbeafe" stroke="#3b82f6" fillOpacity={0.3} />
                    <Line yAxisId="left" type="monotone" dataKey="lucroLiquido" name="Lucro Líquido" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="margemLiquida" name="Margem Líquida" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* DRE Row Component */
function DreRow({
  label,
  months,
  field,
  total,
  viewMode,
  isTotal = false,
  isSubtotal = false,
  isDetail = false,
  isPercent = false,
  negate = false,
  highlight = false,
}: {
  label: string
  months: DreMonth[]
  field: keyof DreMonth
  total: number
  viewMode: 'anual' | 'mensal'
  isTotal?: boolean
  isSubtotal?: boolean
  isDetail?: boolean
  isPercent?: boolean
  negate?: boolean
  highlight?: boolean
}) {
  const rowBg = highlight ? 'bg-gray-50' : ''
  const labelWeight = isTotal ? 'font-bold text-gray-900' : isSubtotal ? 'font-semibold text-gray-800' : isDetail ? 'text-gray-500' : 'text-gray-700'
  const labelSize = isDetail ? 'text-xs' : 'text-sm'

  function cellValue(val: number) {
    const displayVal = negate ? -val : val
    if (isPercent) {
      return <span className={`${displayVal >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(val)}</span>
    }
    const color = displayVal > 0 ? 'text-green-600' : displayVal < 0 ? 'text-red-600' : 'text-gray-400'
    const weight = isTotal ? 'font-bold' : isSubtotal ? 'font-semibold' : ''
    return <span className={`${color} ${weight}`}>{formatCurrency(displayVal)}</span>
  }

  return (
    <tr className={`${rowBg} ${isTotal ? 'border-t-2 border-gray-300' : 'border-t border-gray-100'}`}>
      <td className={`py-2 px-2 ${labelWeight} ${labelSize} whitespace-nowrap`}>{label}</td>
      {viewMode === 'anual' ? (
        <>
          {months.map(m => (
            <td key={m.month} className="text-right py-2 px-2 text-sm tabular-nums">
              {cellValue(Number(m[field]))}
            </td>
          ))}
          <td className="text-right py-2 px-2 text-sm tabular-nums bg-gray-50 font-semibold">
            {cellValue(total)}
          </td>
        </>
      ) : (
        <td className="text-right py-2 px-2 text-sm tabular-nums">
          {cellValue(Number(months[0]?.[field] || 0))}
        </td>
      )}
    </tr>
  )
}
