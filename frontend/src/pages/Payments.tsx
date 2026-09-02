import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Download, Search, RefreshCw, CreditCard, Eye, XCircle, Trash2 } from 'lucide-react'
import { useFeedback } from '../components/ui'
import { useActionToast } from '../components/ActionToast'

interface Payment {
  id: string
  saleId: string
  customerId: string
  type: string
  codigoSolicitacao: string
  status: string
  value: number
  customerName: string
  customerDoc: string
  dueDate: string
  createdAt: string
  linhaDigitavel?: string
  pixCopiaECola?: string
  origem?: string
  contractTitle?: string
}

const statusLabels: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado', a_receber: 'A Receber' }
const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700', a_receber: 'bg-blue-100 text-blue-700' }

export function Payments() {
  const { confirm: confirmAction, runOperation } = useFeedback()
  const { trackAction } = useActionToast()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [reconciling, setReconciling] = useState(false)

  useEffect(() => { load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer) }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/inter/payments', { params: { page: 1, limit: 100 } })
      setPayments(res.data.data || res.data)
    } catch { setPayments([]) }
    finally { setLoading(false) }
  }

  async function downloadPdf(codigoSolicitacao: string) {
    try {
      const res = await fetch(`/api/inter/pdf/${codigoSolicitacao}`, {
        credentials: 'include',
      })
      if (!res.ok) { setError('Erro ao baixar PDF'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `boleto-${codigoSolicitacao.substring(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { setError('Erro ao baixar PDF') }
  }

  async function viewPdf(codigoSolicitacao: string) {
    try {
      const res = await fetch(`/api/inter/pdf/${codigoSolicitacao}`, {
        credentials: 'include',
      })
      if (!res.ok) { setError('Erro ao visualizar boleto'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch { setError('Erro ao visualizar boleto') }
  }

  async function checkStatus(codigoSolicitacao: string) {
    try {
      await trackAction('Consultando status...', api.get(`/inter/status/${codigoSolicitacao}`), 'Status atualizado!')
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao consultar') }
  }

  async function cancelPayment(payment: Payment) {
    if (!await confirmAction({ title: 'Cancelar boleto', message: 'O cancelamento será solicitado diretamente ao Banco Inter. Deseja continuar?', confirmLabel: 'Cancelar boleto', danger: true })) return
    try {
      await runOperation(
        () => api.post('/inter/cancel-batch', { codigoSolicitacoes: [payment.codigoSolicitacao], reason: 'ACERTOS' }),
        { title: 'Cancelando boleto', processingMessage: 'Enviando a solicitação e aguardando a confirmação do Banco Inter.', successMessage: 'Boleto cancelado e confirmado pelo Banco Inter.', errorMessage: (error: any) => error.response?.data?.message || 'O Banco Inter não confirmou o cancelamento.' },
      )
      await load()
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao cancelar boleto')
    }
  }
  async function deletePayment(payment: Payment) {
    if (!await confirmAction({ title: 'Excluir da lista', message: 'Remove este pagamento cancelado da tela. Isso não afeta nenhum registro financeiro real, apenas limpa a lista.', confirmLabel: 'Excluir', danger: true })) return
    try {
      await runOperation(
        () => api.delete(`/inter/payments/${payment.id}`),
        { title: 'Excluindo', processingMessage: 'Removendo pagamento cancelado.', successMessage: 'Removido da lista.', errorMessage: (error: any) => error.response?.data?.message || 'Erro ao excluir' },
      )
      await load()
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao excluir')
    }
  }
  async function reconcileInter() {
    setReconciling(true)
    setError('')
    try {
      await trackAction('Conciliando pagamentos...', api.post('/inter/reconcile'), 'Conciliação concluída!')
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao conciliar pagamentos')
    } finally {
      setReconciling(false)
    }
  }

  async function clearCancelled() {
    const cancelledCount = payments.filter(p => p.status === 'cancelado').length
    if (cancelledCount === 0) return
    if (!await confirmAction({ title: 'Limpar cancelados', message: `Remove ${cancelledCount} pagamento(s) cancelado(s) da tela. Isso não afeta nenhum registro financeiro real, apenas limpa a lista.`, confirmLabel: 'Limpar', danger: true })) return
    try {
      await runOperation(
        () => api.delete('/inter/payments/cancelled'),
        { title: 'Limpando cancelados', processingMessage: 'Removendo pagamentos cancelados.', successMessage: (response: any) => `${response.data.deleted} pagamento(s) removido(s).`, errorMessage: (error: any) => error.response?.data?.message || 'Erro ao limpar' },
      )
      await load()
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao limpar cancelados')
    }
  }

  const filtered = payments.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return (p.customerName || '').toLowerCase().includes(s) ||
      (p.codigoSolicitacao || '').includes(s) ||
      (p.customerDoc || '').includes(s)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pagamentos</h1>
          <p className="text-sm text-gray-500 mt-1">Boletos e PIX emitidos via Banco Inter</p>
        </div>
        <div className="flex gap-2">
          {payments.some(p => p.status === 'cancelado') && (
            <button onClick={clearCancelled} className="btn btn-secondary flex items-center gap-2 text-red-600" title="Remove os pagamentos cancelados da tela">
              <Trash2 className="w-4 h-4" /> Limpar Cancelados
            </button>
          )}
          <button onClick={reconcileInter} disabled={reconciling} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className={'w-4 h-4 ' + (reconciling ? 'animate-spin' : '')} /> Conciliar Inter
          </button>
          <button onClick={load} className="btn btn-secondary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por cliente, código..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <th className="table-cell font-semibold text-gray-700">Tipo</th>
                <th className="table-cell font-semibold text-gray-700">Origem</th>
                <th className="table-cell font-semibold text-gray-700">Cliente</th>
                <th className="table-cell font-semibold text-gray-700">Valor</th>
                <th className="table-cell font-semibold text-gray-700">Vencimento</th>
                <th className="table-cell font-semibold text-gray-700">Status</th>
                <th className="table-cell font-semibold text-gray-700">Código</th>
                <th className="table-cell font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center text-gray-500 py-8">Nenhum pagamento emitido</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="table-cell"><span className={'px-2 py-0.5 rounded text-xs font-medium ' + (p.type === 'pix' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>{p.type === 'pix' ? 'PIX' : 'Boleto'}</span></td>
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.origem === 'contrato' ? 'bg-purple-100 text-purple-700' :
                      p.origem === 'venda' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {p.origem === 'contrato' ? 'Contrato' : p.origem === 'venda' ? 'Venda' : 'Outro'}
                    </span>
                    {p.contractTitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[150px]" title={p.contractTitle}>{p.contractTitle}</p>}
                  </td>
                  <td className="table-cell text-sm font-medium">{p.customerName}</td>
                  <td className="table-cell font-semibold">R$ {Number(p.value).toFixed(2)}</td>
                  <td className="table-cell text-sm">{p.dueDate ? new Date(p.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="table-cell"><span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[p.status] || 'bg-blue-100 text-blue-700')}>{statusLabels[p.status] || p.status}</span></td>
                  <td className="table-cell font-mono text-xs text-gray-500">{(p.codigoSolicitacao || '').substring(0, 8)}...</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      {p.type === 'boleto' && (
                        <>
                          <button onClick={() => viewPdf(p.codigoSolicitacao)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Visualizar boleto"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => downloadPdf(p.codigoSolicitacao)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Baixar PDF do boleto"><Download className="w-4 h-4" /></button>
                          {!['cancelado', 'pago'].includes(p.status) && <button onClick={() => cancelPayment(p)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar boleto"><XCircle className="w-4 h-4" /></button>}
                        </>
                      )}
                      <button onClick={() => checkStatus(p.codigoSolicitacao)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Consultar status no Inter"><RefreshCw className="w-4 h-4" /></button>
                      {p.linhaDigitavel && (
                        <button onClick={() => { navigator.clipboard.writeText(p.linhaDigitavel!).then(() => trackAction('Copiando...', Promise.resolve(), 'Linha digitável copiada!')) }} className="p-1 text-gray-600 hover:bg-gray-50 rounded" title="Copiar linha digitável"><CreditCard className="w-4 h-4" /></button>
                      )}
                      {p.status === 'cancelado' && (
                        <button onClick={() => deletePayment(p)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir da lista"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
