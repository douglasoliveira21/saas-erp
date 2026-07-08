import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { RefreshCw, CheckCircle, XCircle, Clock, DollarSign, AlertTriangle, Search, Filter, ArrowDownUp } from 'lucide-react'

interface Payment {
  id: string
  saleId: string
  type: string
  codigoSolicitacao: string
  status: string
  value: number
  customerName: string
  customerDoc: string
  dueDate: string
  createdAt: string
  linhaDigitavel?: string
  nossoNumero?: string
}

interface ReconcileResult {
  checked: number
  updated: number
  paid: number
  failed: number
  details: Array<{ codigo: string; oldStatus: string; newStatus: string; customer: string }>
}

const statusLabels: Record<string, string> = { a_receber: 'A Receber', pendente: 'Pendente', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado' }
const statusColors: Record<string, string> = { a_receber: 'bg-blue-100 text-blue-700', pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700' }

export function Reconciliation() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [reconciling, setReconciling] = useState(false)
  const [lastResult, setLastResult] = useState<ReconcileResult | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/inter/payments')
      setPayments(res.data)
    } catch { setError('Erro ao carregar pagamentos') }
    finally { setLoading(false) }
  }

  async function reconcile() {
    setReconciling(true)
    setError('')
    try {
      const res = await api.post('/inter/reconcile')
      const data = res.data?.data || res.data
      setLastResult(data)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao conciliar')
    } finally {
      setReconciling(false)
    }
  }

  async function checkSingle(codigoSolicitacao: string) {
    try {
      await api.get(`/inter/status/${codigoSolicitacao}`)
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao consultar') }
  }

  const filtered = payments.filter(p => {
    const matchSearch = !search || (p.customerName || '').toLowerCase().includes(search.toLowerCase()) || (p.codigoSolicitacao || '').includes(search) || (p.nossoNumero || '').includes(search)
    const matchStatus = !statusFilter || p.status === statusFilter
    const matchType = !typeFilter || p.type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  // KPIs
  const totalEmitido = payments.reduce((s, p) => s + Number(p.value), 0)
  const totalPago = payments.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.value), 0)
  const totalPendente = payments.filter(p => ['a_receber', 'pendente'].includes(p.status)).reduce((s, p) => s + Number(p.value), 0)
  const totalVencido = payments.filter(p => p.status === 'vencido').reduce((s, p) => s + Number(p.value), 0)
  const qtdPendente = payments.filter(p => ['a_receber', 'pendente'].includes(p.status)).length
  const qtdPago = payments.filter(p => p.status === 'pago').length
  const qtdVencido = payments.filter(p => p.status === 'vencido').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conciliação Bancária</h1>
          <p className="text-sm text-gray-500 mt-0.5">Banco Inter — Boletos e PIX</p>
        </div>
        <button onClick={reconcile} disabled={reconciling} className="btn btn-primary flex items-center gap-2">
          <RefreshCw className={'w-4 h-4 ' + (reconciling ? 'animate-spin' : '')} />
          {reconciling ? 'Conciliando...' : 'Conciliar Agora'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Emitido</p>
            <p className="text-lg font-bold text-gray-900">R$ {totalEmitido.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">{payments.length} título(s)</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-11 h-11 bg-green-100 rounded-2xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Recebido</p>
            <p className="text-lg font-bold text-green-600">R$ {totalPago.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">{qtdPago} pago(s)</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-11 h-11 bg-yellow-100 rounded-2xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pendente</p>
            <p className="text-lg font-bold text-yellow-600">R$ {totalPendente.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">{qtdPendente} aguardando</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-11 h-11 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Vencido</p>
            <p className="text-lg font-bold text-red-600">R$ {totalVencido.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">{qtdVencido} vencido(s)</p>
          </div>
        </div>
      </div>

      {/* Resultado da última conciliação */}
      {lastResult && (
        <div className="card mb-6 border-2 border-green-200 bg-green-50/30">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">Conciliação Realizada</h3>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Verificados:</span> <span className="font-bold">{lastResult.checked}</span></div>
            <div><span className="text-gray-500">Atualizados:</span> <span className="font-bold text-blue-600">{lastResult.updated}</span></div>
            <div><span className="text-gray-500">Pagos:</span> <span className="font-bold text-green-600">{lastResult.paid || 0}</span></div>
            <div><span className="text-gray-500">Erros:</span> <span className="font-bold text-red-600">{lastResult.failed}</span></div>
          </div>
          {lastResult.details && lastResult.details.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-xs font-medium text-green-700 mb-2">Alterações:</p>
              <div className="space-y-1">
                {lastResult.details.slice(0, 10).map((d, i) => (
                  <div key={i} className="text-xs flex items-center gap-2">
                    <ArrowDownUp className="w-3 h-3 text-green-600" />
                    <span className="text-gray-600">{d.customer || d.codigo?.substring(0, 8)}</span>
                    <span className="text-gray-400">→</span>
                    <span className={'font-medium ' + (d.newStatus === 'pago' ? 'text-green-600' : d.newStatus === 'vencido' ? 'text-red-600' : 'text-gray-600')}>{statusLabels[d.newStatus] || d.newStatus}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar por cliente, código ou nosso número..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos status</option>
              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <select className="input w-32" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Todos tipos</option>
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {/* Tabela */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-8">Nenhum pagamento encontrado</div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700">Data</th>
                <th className="table-cell font-semibold text-gray-700">Cliente</th>
                <th className="table-cell font-semibold text-gray-700">Tipo</th>
                <th className="table-cell font-semibold text-gray-700">Valor</th>
                <th className="table-cell font-semibold text-gray-700">Vencimento</th>
                <th className="table-cell font-semibold text-gray-700">Nosso Nº</th>
                <th className="table-cell font-semibold text-gray-700">Status</th>
                <th className="table-cell font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const isOverdue = ['a_receber', 'pendente'].includes(p.status) && p.dueDate && new Date(p.dueDate) < new Date()
                return (
                  <tr key={p.id} className={'hover:bg-gray-50 ' + (isOverdue ? 'bg-red-50/50' : '')}>
                    <td className="table-cell text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="table-cell">
                      <div className="font-medium text-gray-900 text-sm">{p.customerName || '-'}</div>
                      <div className="text-xs text-gray-400">{p.customerDoc || ''}</div>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.type === 'pix' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {p.type === 'pix' ? 'PIX' : 'Boleto'}
                      </span>
                    </td>
                    <td className="table-cell font-semibold text-gray-900">R$ {Number(p.value).toFixed(2)}</td>
                    <td className="table-cell text-sm">
                      <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {p.dueDate ? new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-500 font-mono">{p.nossoNumero || p.codigoSolicitacao?.substring(0, 8) || '-'}</td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[isOverdue && p.status !== 'pago' ? 'vencido' : p.status] || ''}`}>
                        {isOverdue && p.status !== 'pago' ? 'Vencido' : statusLabels[p.status] || p.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => checkSingle(p.codigoSolicitacao)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Consultar status no Inter">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">ℹ️ Como funciona a conciliação:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>A conciliação automática roda a cada 30 minutos (configurável via INTER_RECONCILE_INTERVAL_MINUTES)</li>
          <li>Consulta todos os boletos/PIX pendentes no Banco Inter e atualiza o status local</li>
          <li>Quando um pagamento é confirmado: atualiza a venda para "pago", registra no financeiro, e envia email de confirmação ao cliente</li>
          <li>O webhook do Inter também processa pagamentos em tempo real (POST /api/inter/webhook)</li>
          <li>Clique em "Conciliar Agora" para forçar uma verificação manual imediata</li>
        </ul>
      </div>
    </div>
  )
}
