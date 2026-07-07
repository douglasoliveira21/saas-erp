import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Eye, CheckCircle, XCircle, Filter, Trash2, FileText, DollarSign, Check, Receipt, CreditCard, Edit } from 'lucide-react'

interface Sale {
  id: string
  technician: { id: string; name: string }
  customer: { id: string; name: string }
  status: string
  paymentMethod: string
  totalAmount: number
  netProfit: number
  commissionAmount: number
  installments: number
  createdAt: string
  items: any[]
}

const statusLabels: Record<string, string> = {
  pendente: 'Pendente', nf_emitida: 'NF Emitida', boleto_emitido: 'Boleto Emitido',
  pago: 'Pago', finalizado: 'Finalizado', cancelado: 'Cancelado'
}
const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700', nf_emitida: 'bg-blue-100 text-blue-700',
  boleto_emitido: 'bg-purple-100 text-purple-700',
  pago: 'bg-green-100 text-green-700', finalizado: 'bg-gray-100 text-gray-700',
  cancelado: 'bg-red-100 text-red-700'
}
const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
  pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto'
}

export function Sales() {
  const { isAdmin, isFinanceiro, isTecnico, user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-01' })
  const [dateTo, setDateTo] = useState(() => { const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0); return last.getFullYear() + '-' + String(last.getMonth()+1).padStart(2,'0') + '-' + String(last.getDate()).padStart(2,'0') })
  const [selected, setSelected] = useState<Sale | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/sales')
      setSales(res.data)
    } catch { setError('Erro ao carregar vendas') }
    finally { setLoading(false) }
  }

  async function approve(id: string) {
    try {
      await api.patch(`/sales/${id}/approve`)
      load(); setSelected(null)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  async function markPaid(id: string) {
    try {
      await api.patch(`/sales/${id}/mark-paid`)
      load(); setSelected(null)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  async function markBoleto(id: string) {
    try {
      await api.patch(`/sales/${id}/boleto-emitido`)
      load(); setSelected(null)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  async function finalize(id: string) {
    try {
      await api.patch(`/sales/${id}/finalize`)
      load(); setSelected(null)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  async function cancel(id: string) {
    if (!confirm('Cancelar esta venda?')) return
    try {
      await api.patch(`/sales/${id}/cancel`)
      load(); setSelected(null)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar') }
  }

  async function generatePayment(id: string, type: 'boleto' | 'pix') {
    setError('')
    try {
      const res = await api.post(`/inter/generate/${id}?type=${type}`)
      if (res.data.success) {
        alert(`${type === 'pix' ? 'PIX' : 'Boleto'} gerado com sucesso! Confira em Pagamentos.`)
        load()
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || e.response?.data?.error || JSON.stringify(e.response?.data) || `Erro ao gerar ${type}`
      setError(msg)
      alert('Erro: ' + msg)
    }
  }

  const filtered = sales.filter(s => {
    const matchSearch = s.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.technician?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || s.status === statusFilter
    const matchUser = isTecnico ? s.technician?.id === user?.id : true
    const matchMonth = (() => {
      if (!dateFrom && !dateTo) return true
      const saleDate = s.createdAt ? s.createdAt.split('T')[0] : ''
      // Venda aparece se foi criada no período
      if (saleDate >= dateFrom && saleDate <= dateTo) return true
      // Para vendas parceladas, aparece se tem parcela no período
      const numInst = Number(s.installments) || 1
      if (numInst > 1 && s.createdAt) {
        const createdDate = new Date(s.createdAt)
        for (let i = 1; i < numInst; i++) {
          const parcelaDate = new Date(createdDate.getFullYear(), createdDate.getMonth() + i, createdDate.getDate())
          const parcelaStr = parcelaDate.toISOString().split('T')[0]
          if (parcelaStr >= dateFrom && parcelaStr <= dateTo) return true
        }
      }
      return false
    })()
    return matchSearch && matchStatus && matchUser && matchMonth
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vendas</h1>
        {(isTecnico || isAdmin) && (
          <Link to="/sales/new" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova Venda
          </Link>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input type="date" className="input w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input type="date" className="input w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar por cliente ou tecnico..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="input w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Data</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Tipo</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Cliente</th>
                {!isTecnico && <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Técnico</th>}
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Pagamento</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Total</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center text-gray-500">Nenhuma venda encontrada</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">
                    {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="table-cell">
                    {(() => {
                      const hasProduct = s.items?.some((i: any) => i.productId)
                      const hasService = s.items?.some((i: any) => i.serviceId)
                      if (hasProduct && hasService) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Misto</span>
                      if (hasService) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Serviço</span>
                      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Produto</span>
                    })()}
                  </td>
                  <td className="table-cell font-medium text-gray-900 dark:text-white">{s.customer?.name}</td>
                  {!isTecnico && <td className="table-cell text-gray-600 dark:text-gray-400">{s.technician?.name}</td>}
                  <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{paymentLabels[s.paymentMethod] || s.paymentMethod}{s.installments > 1 ? ` (${s.installments}x)` : ''}</td>
                  <td className="table-cell font-semibold text-gray-900 dark:text-white">R$ {Number(s.totalAmount).toFixed(2)}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[s.status]}`}>{statusLabels[s.status]}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => setSelected(s)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Ver detalhes"><Eye className="w-4 h-4" /></button>
                      {(isAdmin || isFinanceiro) && !['finalizado', 'cancelado'].includes(s.status) && (
                        <Link to={`/sales/new?edit=${s.id}`} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded" title="Editar Venda"><Edit className="w-4 h-4" /></Link>
                      )}
                      {(isAdmin || isFinanceiro) && ['pendente', 'nf_emitida', 'pago', 'finalizado'].includes(s.status) && (
                        <button onClick={() => window.location.href = '/fiscal?emit=' + s.id} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="Emitir Nota Fiscal"><FileText className="w-4 h-4" /></button>
                      )}
                      {(isAdmin || isFinanceiro) && ['pendente', 'nf_emitida'].includes(s.status) && s.paymentMethod === 'boleto' && (
                        <button onClick={() => generatePayment(s.id, 'boleto')} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Gerar Boleto"><CreditCard className="w-4 h-4" /></button>
                      )}
                      {(isAdmin || isFinanceiro) && ['pendente', 'nf_emitida', 'boleto_emitido'].includes(s.status) && (
                        <button onClick={() => markPaid(s.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Confirmar Pagamento"><DollarSign className="w-4 h-4" /></button>
                      )}
                      {(isAdmin || isFinanceiro) && s.status === 'pago' && (
                        <button onClick={() => finalize(s.id)} className="p-1 text-gray-600 hover:bg-gray-50 rounded" title="Finalizar"><Check className="w-4 h-4" /></button>
                      )}
                      {(isAdmin || isFinanceiro) && !['finalizado', 'cancelado'].includes(s.status) && (
                        <button onClick={() => cancel(s.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar"><XCircle className="w-4 h-4" /></button>
                      )}
                      {isAdmin && s.status === 'cancelado' && (
                        <button onClick={async () => { if (!confirm('Excluir esta venda cancelada do historico?')) return; try { await api.delete('/sales/' + s.id); load() } catch {} }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir do historico"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalhes */}
      {selected && <SaleDetailModal sale={selected} onClose={() => setSelected(null)} isAdmin={isAdmin} isFinanceiro={isFinanceiro} approve={approve} cancel={cancel} />}
    </div>
  )
}


function SaleDetailModal({ sale, onClose, isAdmin, isFinanceiro, approve, cancel }: { sale: any; onClose: () => void; isAdmin: boolean; isFinanceiro: boolean; approve: (id: string) => void; cancel: (id: string) => void }) {
  const [installments, setInstallments] = useState<any[]>([])
  const [loadingInst, setLoadingInst] = useState(false)

  useEffect(() => {
    if (sale.installments > 1 || sale.paymentMethod === 'boleto') {
      setLoadingInst(true)
      api.get('/financial/installments', { params: { accountId: sale.id } })
        .then(r => {
          // Se não encontrou por accountId (que é saleId aqui), buscar por sale
          if (r.data.length === 0) {
            return api.get('/financial/accounts', { params: {} }).then(ar => {
              const account = ar.data.find((a: any) => a.saleId === sale.id)
              if (account?.installmentsList) setInstallments(account.installmentsList)
              else if (account) return api.get('/financial/installments', { params: { accountId: account.id } }).then(r2 => setInstallments(r2.data))
            })
          }
          setInstallments(r.data)
        })
        .catch(() => {})
        .finally(() => setLoadingInst(false))
    }
  }, [sale.id])

  const statusLabels: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', parcial: 'Parcial', vencido: 'Vencido', cancelado: 'Cancelado' }
  const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', parcial: 'bg-blue-100 text-blue-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700' }
  const paymentLabels: Record<string, string> = { dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalhes da Venda</h2>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{sale.customer?.name}</span></div>
            <div><span className="text-gray-500">Técnico:</span> <span className="font-medium">{sale.technician?.name}</span></div>
            <div><span className="text-gray-500">Pagamento:</span> <span className="font-medium">{paymentLabels[sale.paymentMethod] || sale.paymentMethod}{sale.installments > 1 ? ` (${sale.installments}x)` : ''}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[sale.status] || ''}`}>{statusLabels[sale.status] || sale.status}</span></div>
            <div><span className="text-gray-500">Total:</span> <span className="font-bold text-green-600">R$ {Number(sale.totalAmount).toFixed(2)}</span></div>
            <div><span className="text-gray-500">Comissão:</span> <span className="font-medium">R$ {Number(sale.commissionAmount || 0).toFixed(2)}</span></div>
          </div>

          {/* Itens */}
          {sale.items?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Itens</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-1">Item</th><th className="text-right py-1">Qtd</th><th className="text-right py-1">Unit.</th><th className="text-right py-1">Total</th></tr></thead>
                <tbody>
                  {sale.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1">{item.name}</td>
                      <td className="text-right py-1">{item.quantity}</td>
                      <td className="text-right py-1">R$ {Number(item.unitPrice).toFixed(2)}</td>
                      <td className="text-right py-1 font-medium">R$ {Number(item.totalPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Parcelas */}
          {installments.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Parcelas ({installments.length}x)</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-1">Parcela</th><th className="text-right py-1">Valor</th><th className="text-center py-1">Vencimento</th><th className="text-center py-1">Status</th></tr></thead>
                <tbody>
                  {installments.sort((a: any, b: any) => a.number - b.number).map((inst: any) => {
                    const isOverdue = inst.status === 'pendente' && new Date(inst.dueDate) < new Date()
                    return (
                      <tr key={inst.id} className={'border-b border-gray-100 ' + (isOverdue ? 'bg-red-50' : '')}>
                        <td className="py-1">{inst.number}ª parcela</td>
                        <td className="text-right py-1 font-medium">R$ {Number(inst.value).toFixed(2)}</td>
                        <td className={'text-center py-1 ' + (isOverdue ? 'text-red-600 font-medium' : '')}>{new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="text-center py-1"><span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[isOverdue ? 'vencido' : inst.status] || '')}>{isOverdue ? 'Vencido' : (statusLabels[inst.status] || inst.status)}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {loadingInst && <div className="text-center text-sm text-gray-500">Carregando parcelas...</div>}
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          {(isAdmin || isFinanceiro) && sale.status === 'pendente' && (
            <button onClick={() => approve(sale.id)} className="btn btn-primary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Aprovar
            </button>
          )}
          {(isAdmin || isFinanceiro) && !['finalizado', 'cancelado'].includes(sale.status) && (
            <button onClick={() => cancel(sale.id)} className="btn btn-danger flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Cancelar
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary">Fechar</button>
        </div>
      </div>
    </div>
  )
}
