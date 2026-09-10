import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Download, Search, RefreshCw, CreditCard, Eye, XCircle, Trash2, CheckCircle, Undo2, CalendarClock,
  ChevronLeft, ChevronRight, Plus, Check, X, AlertTriangle, DollarSign, Clock, Edit2, Receipt, Users,
  TrendingUp, Ban, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'
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
  invoiceNumber?: string | number
  settledManually?: boolean
  paymentNote?: string
  installmentId?: string
}

interface Supplier {
  id: string; name: string; cpfCnpj: string; phone: string;
  email: string; address: string; city: string; uf: string;
  cep: string; contactPerson: string; observations: string; active: boolean;
}

interface Bill {
  id: string; supplierId: string; description: string; value: number;
  paidValue: number; dueDate: string; paidAt: string; status: string;
  category: string; paymentMethod: string; installments: number;
  installmentNumber: number; recurringGroupId: string; documentNumber: string;
  barcode: string; observations: string; createdAt: string;
  isFixedCost?: boolean;
  supplier: Supplier | null;
}

interface ReportRow {
  supplierId: string; supplierName: string; totalBills: string;
  totalValue: string; totalPaid: string; totalPending: string;
}

type Tab = 'lancamentos' | 'fornecedores' | 'relatorio'
type LedgerRow = { kind: 'credito'; data: Payment } | { kind: 'debito'; data: Bill }

const receivableStatusLabels: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado', a_receber: 'A Receber' }
const receivableStatusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700', a_receber: 'bg-blue-100 text-blue-700' }
const billStatusLabels: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', parcial: 'Parcial', vencido: 'Vencido', cancelado: 'Cancelado' }
const billStatusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', parcial: 'bg-blue-100 text-blue-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700' }
const statusLabels: Record<string, string> = { ...billStatusLabels, ...receivableStatusLabels }
const categories = [
  'Aluguel', 'Energia', 'Internet', 'Telefone', 'Água',
  'Material', 'Serviço', 'Impostos', 'Salários', 'Software',
  'Equipamentos', 'Manutenção', 'Marketing', 'Outros'
]
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
function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}

export function Payments() {
  const { isAdmin } = useAuth()
  const { confirm: confirmAction, runOperation, notify } = useFeedback()
  const { trackAction } = useActionToast()
  const [activeTab, setActiveTab] = useState<Tab>('lancamentos')
  const [month, setMonth] = useState(currentMonth())
  const [payments, setPayments] = useState<Payment[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [alerts, setAlerts] = useState<{ overdue: Bill[]; upcoming: Bill[] }>({ overdue: [], upcoming: [] })
  const [report, setReport] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'credito' | 'debito'>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')
  const [reconciling, setReconciling] = useState(false)
  const [reissuingPayment, setReissuingPayment] = useState<Payment | null>(null)
  const [reissueDueDate, setReissueDueDate] = useState('')
  const [reissueValue, setReissueValue] = useState('')
  const [reissuing, setReissuing] = useState(false)
  const [reviewSaleId, setReviewSaleId] = useState<string | null>(null)

  // Bill Modal
  const [showBillModal, setShowBillModal] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [saving, setSaving] = useState(false)
  const [billForm, setBillForm] = useState({
    supplierId: '', description: '', value: '', dueDate: '',
    category: '', installments: '1', barcode: '', documentNumber: '',
    paymentMethod: '', observations: '', isFixedCost: false, recurringMonths: '12'
  })

  // Pay Modal
  const [showPayModal, setShowPayModal] = useState(false)
  const [payingBill, setPayingBill] = useState<Bill | null>(null)
  const [payRequestKey, setPayRequestKey] = useState('')
  const [payMethod, setPayMethod] = useState('pix')
  const [payValue, setPayValue] = useState('')

  // Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState({
    name: '', cpfCnpj: '', phone: '', email: '', address: '',
    city: '', uf: '', cep: '', contactPerson: '', observations: ''
  })

  // Report filters
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')

  useEffect(() => { load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer) }, [month])
  useEffect(() => { loadSuppliersAndAlerts() }, [])
  useEffect(() => { if (activeTab === 'relatorio') loadReport() }, [activeTab])

  async function load() {
    setLoading(true)
    try {
      const { start, end } = monthBounds(month)
      const [pRes, bRes] = await Promise.all([
        api.get('/inter/payments', { params: { page: 1, limit: 100, month } }),
        api.get('/bills', { params: { startDate: start, endDate: end } }),
      ])
      setPayments(pRes.data.data || pRes.data)
      setBills(bRes.data)
    } catch { setPayments([]); setBills([]) }
    finally { setLoading(false) }
  }

  async function loadSuppliersAndAlerts() {
    try {
      const [sRes, alertRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/bills/alerts'),
      ])
      setSuppliers(sRes.data)
      setAlerts(alertRes.data)
    } catch { /* ignora - não bloqueia a tela de lançamentos */ }
  }

  async function loadReport() {
    try {
      const params: any = {}
      if (reportStart) params.startDate = reportStart
      if (reportEnd) params.endDate = reportEnd
      const res = await api.get('/bills/report', { params })
      setReport(res.data)
    } catch { setError('Erro ao carregar relatório') }
  }

  // ==================== RECEBIMENTOS (créditos) ====================
  async function downloadPdf(codigoSolicitacao: string) {
    try {
      const res = await fetch(`/api/inter/pdf/${codigoSolicitacao}`, { credentials: 'include' })
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
      const res = await fetch(`/api/inter/pdf/${codigoSolicitacao}`, { credentials: 'include' })
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
  async function markAsReceived(payment: Payment) {
    const note = window.prompt('Como foi recebido esse pagamento? (ex: dinheiro, transferência, outro banco) - opcional')
    if (note === null) return
    if (!await confirmAction({ title: 'Marcar como recebido', message: `Confirma que o pagamento de ${payment.customerName} (R$ ${Number(payment.value).toFixed(2)}) foi recebido por fora do Inter?`, confirmLabel: 'Marcar como recebido' })) return
    try {
      await runOperation(
        () => api.post(`/inter/payments/${payment.id}/mark-received`, { note: note.trim() || undefined }),
        { title: 'Marcando como recebido', processingMessage: 'Atualizando venda/parcela e financeiro.', successMessage: 'Pagamento marcado como recebido.', errorMessage: (error: any) => error.response?.data?.message || 'Erro ao marcar como recebido' },
      )
      await load()
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao marcar como recebido')
    }
  }

  async function revertToReceivable(payment: Payment) {
    const reason = window.prompt('Motivo da reversão (obrigatório) - ex: pago apenas o boleto 1 de 3, os outros ainda não foram pagos')
    if (reason === null) return
    if (!reason.trim()) { setError('Informe o motivo da reversão'); return }
    if (!await confirmAction({ title: 'Reverter para A Receber', message: `Isso desfaz o pagamento de ${payment.customerName} (R$ ${Number(payment.value).toFixed(2)}) e volta a parcela para "a receber". Use apenas quando o pagamento foi marcado errado.`, confirmLabel: 'Reverter', danger: true })) return
    try {
      await runOperation(
        () => api.post(`/inter/payments/${payment.id}/revert-to-receivable`, { reason: reason.trim() }),
        { title: 'Revertendo pagamento', processingMessage: 'Corrigindo parcela, venda e boleto.', successMessage: 'Pagamento revertido para A Receber.', errorMessage: (error: any) => error.response?.data?.message || 'Erro ao reverter pagamento' },
      )
      await load()
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao reverter pagamento')
    }
  }

  function openReissueModal(payment: Payment) {
    setReissuingPayment(payment)
    setReissueDueDate('')
    setReissueValue(String(payment.value))
    setError('')
  }

  async function confirmReissue() {
    if (!reissuingPayment) return
    if (!reissueDueDate) { setError('Informe a nova data de vencimento'); return }
    setReissuing(true)
    setError('')
    try {
      const value = parseFloat(reissueValue)
      const res = await api.post(`/inter/payments/${reissuingPayment.id}/reissue`, {
        dueDate: reissueDueDate,
        value: Number.isFinite(value) && value > 0 ? value : undefined,
      })
      notify('Boleto reemitido com sucesso.', 'success')
      setReviewSaleId(res.data.saleId)
      setReissuingPayment(null)
      await load()
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erro ao reemitir boleto')
    } finally {
      setReissuing(false)
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

  // ==================== CONTAS A PAGAR (débitos) ====================
  function openNewBill() {
    setEditingBill(null)
    setBillForm({ supplierId: '', description: '', value: '', dueDate: '', category: '', installments: '1', barcode: '', documentNumber: '', paymentMethod: '', observations: '', isFixedCost: false, recurringMonths: '12' })
    setError(''); setShowBillModal(true)
  }

  function openEditBill(b: Bill) {
    setEditingBill(b)
    setBillForm({
      supplierId: b.supplierId, description: b.description,
      value: String(b.value), dueDate: b.dueDate,
      category: b.category || '', installments: String(b.installments),
      barcode: b.barcode || '', documentNumber: b.documentNumber || '',
      paymentMethod: b.paymentMethod || '', observations: b.observations || '',
      isFixedCost: b.isFixedCost || false, recurringMonths: '12'
    })
    setError(''); setShowBillModal(true)
  }

  async function saveBill() {
    if (!billForm.supplierId || !billForm.description || !billForm.value || !billForm.dueDate) {
      setError('Fornecedor, descrição, valor e vencimento são obrigatórios'); return
    }
    setSaving(true)
    try {
      const payload: any = {
        supplierId: billForm.supplierId,
        description: billForm.description.trim(),
        value: parseFloat(billForm.value),
        dueDate: billForm.dueDate,
        category: billForm.category || null,
        installments: parseInt(billForm.installments) || 1,
        barcode: billForm.barcode || null,
        documentNumber: billForm.documentNumber || null,
        paymentMethod: billForm.paymentMethod || null,
        observations: billForm.observations || null,
      }
      if (!editingBill && billForm.isFixedCost) {
        payload.isFixedCost = true
        payload.recurringMonths = parseInt(billForm.recurringMonths) || 12
      }
      if (editingBill) {
        await api.patch('/bills/' + editingBill.id, payload)
      } else {
        await api.post('/bills', payload)
      }
      setShowBillModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  function openPay(b: Bill) {
    setPayingBill(b)
    setPayRequestKey(crypto.randomUUID())
    setPayValue(String(b.value))
    setPayMethod(b.paymentMethod || 'pix')
    setShowPayModal(true)
  }

  async function confirmPay() {
    if (!payingBill) return
    try {
      await api.patch('/bills/' + payingBill.id + '/pay', {
        paymentMethod: payMethod,
        paidValue: parseFloat(payValue) || Number(payingBill.value),
      }, { headers: { 'Idempotency-Key': payRequestKey || crypto.randomUUID() } })
      setShowPayModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao pagar') }
  }

  async function cancelBill(id: string) {
    if (!await confirmAction({ title: 'Cancelar conta', message: 'Cancelar esta conta a pagar?', confirmLabel: 'Cancelar conta', danger: true })) return
    try { await trackAction('Cancelando conta...', api.patch('/bills/' + id + '/cancel'), 'Conta cancelada!'); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar') }
  }

  async function removeBill(id: string) {
    if (!await confirmAction({ title: 'Excluir conta', message: 'Excluir esta conta permanentemente?', confirmLabel: 'Excluir', danger: true })) return
    try { await trackAction('Excluindo conta...', api.delete('/bills/' + id), 'Conta excluída!'); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir') }
  }

  // ==================== FORNECEDORES ====================
  function openNewSupplier() {
    setEditingSupplier(null)
    setSupplierForm({ name: '', cpfCnpj: '', phone: '', email: '', address: '', city: '', uf: '', cep: '', contactPerson: '', observations: '' })
    setError(''); setShowSupplierModal(true)
  }

  function openEditSupplier(s: Supplier) {
    setEditingSupplier(s)
    setSupplierForm({
      name: s.name, cpfCnpj: s.cpfCnpj || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', city: s.city || '',
      uf: s.uf || '', cep: s.cep || '', contactPerson: s.contactPerson || '',
      observations: s.observations || ''
    })
    setError(''); setShowSupplierModal(true)
  }

  async function saveSupplier() {
    if (!supplierForm.name.trim()) { setError('Nome do fornecedor é obrigatório'); return }
    setSaving(true)
    try {
      if (editingSupplier) {
        await api.patch('/suppliers/' + editingSupplier.id, supplierForm)
      } else {
        await api.post('/suppliers', supplierForm)
      }
      setShowSupplierModal(false); loadSuppliersAndAlerts()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar fornecedor') }
    finally { setSaving(false) }
  }

  async function removeSupplier(id: string) {
    if (!await confirmAction({ title: 'Excluir fornecedor', message: 'Excluir este fornecedor?', confirmLabel: 'Excluir', danger: true })) return
    try { await trackAction('Excluindo fornecedor...', api.delete('/suppliers/' + id), 'Fornecedor excluído!'); loadSuppliersAndAlerts() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir') }
  }

  // ==================== LANÇAMENTOS (unificado) ====================
  const ledgerRows: LedgerRow[] = useMemo(() => [
    ...payments.map(p => ({ kind: 'credito' as const, data: p })),
    ...bills.map(b => ({ kind: 'debito' as const, data: b })),
  ].sort((a, b) => (a.data.dueDate || '').localeCompare(b.data.dueDate || '')), [payments, bills])

  const filteredRows = ledgerRows.filter(row => {
    if (typeFilter && row.kind !== typeFilter) return false
    if (statusFilter && row.data.status !== statusFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    if (row.kind === 'credito') {
      const p = row.data
      return (p.customerName || '').toLowerCase().includes(s) ||
        (p.codigoSolicitacao || '').includes(s) ||
        (p.customerDoc || '').includes(s) ||
        String(p.invoiceNumber || '').toLowerCase().includes(s)
    }
    const b = row.data
    return (b.description || '').toLowerCase().includes(s) ||
      (b.supplier?.name || '').toLowerCase().includes(s) ||
      (b.documentNumber || '').toLowerCase().includes(s)
  })

  const totalRecebido = payments.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.value), 0)
  const totalAReceber = payments.filter(p => ['pendente', 'a_receber', 'vencido'].includes(p.status)).reduce((s, p) => s + Number(p.value), 0)
  const totalPago = bills.filter(b => ['pago', 'parcial'].includes(b.status)).reduce((s, b) => s + Number(b.paidValue || (b.status === 'pago' ? b.value : 0)), 0)
  const totalAPagar = bills.filter(b => ['pendente', 'vencido', 'parcial'].includes(b.status)).reduce((s, b) => s + (Number(b.value) - Number(b.paidValue || 0)), 0)
  const saldo = totalRecebido - totalPago

  const tabItems: { key: Tab; label: string; icon: any }[] = [
    { key: 'lancamentos', label: 'Lançamentos', icon: Receipt },
    { key: 'fornecedores', label: 'Fornecedores', icon: Users },
    { key: 'relatorio', label: 'Relatório', icon: TrendingUp },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contas a Pagar e Receber</h1>
          <p className="text-sm text-gray-500 mt-1">Boletos, PIX e contas de fornecedores em um só lugar</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === 'lancamentos' && (
            <>
              {payments.some(p => p.status === 'cancelado') && (
                <button onClick={clearCancelled} className="btn btn-secondary flex items-center gap-2 text-red-600" title="Remove os pagamentos cancelados da tela">
                  <Trash2 className="w-4 h-4" /> Limpar Cancelados
                </button>
              )}
              <button onClick={reconcileInter} disabled={reconciling} className="btn btn-secondary flex items-center gap-2">
                <RefreshCw className={'w-4 h-4 ' + (reconciling ? 'animate-spin' : '')} /> Conciliar Inter
              </button>
              <button onClick={openNewBill} className="btn btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nova Conta a Pagar
              </button>
              <button onClick={load} className="btn btn-secondary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</button>
            </>
          )}
          {activeTab === 'fornecedores' && (
            <button onClick={openNewSupplier} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Novo Fornecedor
            </button>
          )}
        </div>
      </div>

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center"><ArrowDownCircle className="w-4 h-4 text-green-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Recebido</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalRecebido)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">A Receber</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(totalAReceber)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center"><ArrowUpCircle className="w-4 h-4 text-red-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Pago</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalPago)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-yellow-600" /></div>
          <div>
            <p className="text-xs text-gray-500">A Pagar</p>
            <p className="text-lg font-bold text-yellow-600">{formatCurrency(totalAPagar)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className={'w-9 h-9 rounded-lg flex items-center justify-center ' + (saldo >= 0 ? 'bg-green-100' : 'bg-red-100')}><DollarSign className={'w-4 h-4 ' + (saldo >= 0 ? 'text-green-600' : 'text-red-600')} /></div>
          <div>
            <p className="text-xs text-gray-500">Saldo do mês</p>
            <p className={'text-lg font-bold ' + (saldo >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(saldo)}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {activeTab === 'lancamentos' && (alerts.overdue.length > 0 || alerts.upcoming.length > 0) && (
        <div className="card mb-6 border-l-4 border-l-orange-400">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Alertas de contas a pagar
          </h3>
          <div className="space-y-2">
            {alerts.overdue.length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-700">
                  {alerts.overdue.length} conta(s) vencida(s) — Total: {formatCurrency(alerts.overdue.reduce((s, b) => s + Number(b.value), 0))}
                </p>
                <div className="mt-1 text-xs text-red-600 space-y-0.5">
                  {alerts.overdue.slice(0, 5).map(b => (
                    <p key={b.id}>{b.supplier?.name} — {b.description} — {formatCurrency(Number(b.value))} (venc. {formatDate(b.dueDate)})</p>
                  ))}
                  {alerts.overdue.length > 5 && <p>... e mais {alerts.overdue.length - 5}</p>}
                </div>
              </div>
            )}
            {alerts.upcoming.length > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm font-medium text-yellow-700">
                  {alerts.upcoming.length} conta(s) vencendo em breve — Total: {formatCurrency(alerts.upcoming.reduce((s, b) => s + Number(b.value), 0))}
                </p>
                <div className="mt-1 text-xs text-yellow-600 space-y-0.5">
                  {alerts.upcoming.slice(0, 5).map(b => (
                    <p key={b.id}>{b.supplier?.name} — {b.description} — {formatCurrency(Number(b.value))} (venc. {formatDate(b.dueDate)})</p>
                  ))}
                  {alerts.upcoming.length > 5 && <p>... e mais {alerts.upcoming.length - 5}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
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

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error} <button onClick={() => setError('')} className="ml-2 underline">fechar</button></div>}

      {/* ==================== TAB: LANÇAMENTOS ==================== */}
      {activeTab === 'lancamentos' && (
        <>
          <div className="card mb-6">
            <div className="flex gap-4 flex-wrap items-end">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-10" placeholder="Buscar por cliente, fornecedor, código, nota fiscal..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select className="input w-36" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
                  <option value="">Todos</option>
                  <option value="credito">Créditos (recebido)</option>
                  <option value="debito">Débitos (pago)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            {loading ? (
              <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
            ) : (
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell font-semibold text-gray-700">Tipo</th>
                    <th className="table-cell font-semibold text-gray-700">Cliente/Fornecedor</th>
                    <th className="table-cell font-semibold text-gray-700">Valor</th>
                    <th className="table-cell font-semibold text-gray-700">Vencimento</th>
                    <th className="table-cell font-semibold text-gray-700">Status</th>
                    <th className="table-cell font-semibold text-gray-700">Documento/NF</th>
                    <th className="table-cell font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={7} className="table-cell text-center text-gray-500 py-8">Nenhum lançamento neste mês</td></tr>
                  ) : filteredRows.map(row => row.kind === 'credito' ? (
                    <tr key={'c-' + row.data.id} className="hover:bg-gray-50 border-l-2 border-l-green-400">
                      <td className="table-cell">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Crédito</span>
                        <p className="text-[10px] text-gray-400 mt-0.5">{row.data.type === 'pix' ? 'PIX' : 'Boleto'} · {row.data.origem === 'contrato' ? 'Contrato' : row.data.origem === 'venda' ? 'Venda' : 'Outro'}</p>
                      </td>
                      <td className="table-cell text-sm font-medium">{row.data.customerName}</td>
                      <td className="table-cell font-semibold text-green-600">+ {formatCurrency(row.data.value)}</td>
                      <td className="table-cell text-sm">{row.data.dueDate ? new Date(row.data.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="table-cell">
                        <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (receivableStatusColors[row.data.status] || 'bg-blue-100 text-blue-700')}>{receivableStatusLabels[row.data.status] || row.data.status}</span>
                        {row.data.settledManually && <p className="text-xs text-gray-500 mt-0.5" title={row.data.paymentNote || ''}>Recebido manualmente{row.data.paymentNote ? ` (${row.data.paymentNote})` : ''}</p>}
                      </td>
                      <td className="table-cell text-sm">{row.data.invoiceNumber || '-'}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {!['pago', 'cancelado'].includes(row.data.status) && (
                            <button onClick={() => markAsReceived(row.data)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Marcar como recebido (pago por outra forma)"><CheckCircle className="w-4 h-4" /></button>
                          )}
                          {row.data.status === 'pago' && row.data.origem === 'venda' && (
                            <button onClick={() => revertToReceivable(row.data)} className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Reverter para A Receber (marcado como pago por engano)"><Undo2 className="w-4 h-4" /></button>
                          )}
                          {row.data.type === 'boleto' && (
                            <>
                              <button onClick={() => viewPdf(row.data.codigoSolicitacao)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Visualizar boleto"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => downloadPdf(row.data.codigoSolicitacao)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Baixar PDF do boleto"><Download className="w-4 h-4" /></button>
                              {!['cancelado', 'pago'].includes(row.data.status) && <button onClick={() => cancelPayment(row.data)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar boleto"><XCircle className="w-4 h-4" /></button>}
                              {!['cancelado', 'pago'].includes(row.data.status) && <button onClick={() => openReissueModal(row.data)} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="Reemitir com nova data de vencimento"><CalendarClock className="w-4 h-4" /></button>}
                            </>
                          )}
                          <button onClick={() => checkStatus(row.data.codigoSolicitacao)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Consultar status no Inter"><RefreshCw className="w-4 h-4" /></button>
                          {row.data.linhaDigitavel && (
                            <button onClick={() => { navigator.clipboard.writeText(row.data.linhaDigitavel!).then(() => trackAction('Copiando...', Promise.resolve(), 'Linha digitável copiada!')) }} className="p-1 text-gray-600 hover:bg-gray-50 rounded" title="Copiar linha digitável"><CreditCard className="w-4 h-4" /></button>
                          )}
                          {row.data.status === 'cancelado' && (
                            <button onClick={() => deletePayment(row.data)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir da lista"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={'d-' + row.data.id} className="hover:bg-gray-50 border-l-2 border-l-red-400">
                      <td className="table-cell">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Débito</span>
                        {row.data.category && <p className="text-[10px] text-gray-400 mt-0.5">{row.data.category}</p>}
                      </td>
                      <td className="table-cell text-sm font-medium">
                        {row.data.supplier?.name || '-'}
                        <p className="text-xs text-gray-500 truncate max-w-[180px]" title={row.data.description}>{row.data.description}{row.data.isFixedCost && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-100 text-purple-700 align-middle">FIXO</span>}</p>
                      </td>
                      <td className="table-cell font-semibold text-red-600">- {formatCurrency(Number(row.data.value))}</td>
                      <td className="table-cell text-sm">{formatDate(row.data.dueDate)}</td>
                      <td className="table-cell">
                        <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (billStatusColors[row.data.status] || '')}>{billStatusLabels[row.data.status] || row.data.status}</span>
                        {row.data.installments > 1 && <p className="text-xs text-gray-500 mt-0.5">{row.data.installmentNumber}/{row.data.installments}</p>}
                      </td>
                      <td className="table-cell text-sm">{row.data.documentNumber || '-'}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {['pendente', 'vencido', 'parcial'].includes(row.data.status) && (
                            <button onClick={() => openPay(row.data)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Pagar"><DollarSign className="w-4 h-4" /></button>
                          )}
                          {['pendente', 'vencido'].includes(row.data.status) && (
                            <button onClick={() => openEditBill(row.data)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit2 className="w-4 h-4" /></button>
                          )}
                          {['pendente', 'vencido'].includes(row.data.status) && (
                            <button onClick={() => cancelBill(row.data.id)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Cancelar"><Ban className="w-4 h-4" /></button>
                          )}
                          {isAdmin && (
                            <button onClick={() => removeBill(row.data.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ==================== TAB: FORNECEDORES ==================== */}
      {activeTab === 'fornecedores' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Fornecedores Cadastrados ({suppliers.length})</h3>
          {suppliers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum fornecedor cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Nome</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">CPF/CNPJ</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Telefone</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Cidade/UF</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Contato</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="table-cell font-medium text-gray-900 dark:text-white">{s.name}</td>
                      <td className="table-cell text-sm text-gray-600">{s.cpfCnpj || '-'}</td>
                      <td className="table-cell text-sm text-gray-600">{s.phone || '-'}</td>
                      <td className="table-cell text-sm text-gray-600">{s.email || '-'}</td>
                      <td className="table-cell text-sm text-gray-600">{s.city ? `${s.city}/${s.uf}` : '-'}</td>
                      <td className="table-cell text-sm text-gray-600">{s.contactPerson || '-'}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          <button onClick={() => openEditSupplier(s)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => removeSupplier(s.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: RELATÓRIO ==================== */}
      {activeTab === 'relatorio' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Relatório por Fornecedor</h3>
            <div className="flex gap-2 items-center">
              <input className="input w-36" type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} />
              <input className="input w-36" type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
              <button onClick={loadReport} className="btn btn-primary text-sm">Filtrar</button>
            </div>
          </div>
          {report.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum dado disponível.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Fornecedor</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Qtd Contas</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Total</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Pago</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Pendente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {report.map(r => (
                    <tr key={r.supplierId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="table-cell font-medium text-gray-900 dark:text-white">{r.supplierName || 'Sem fornecedor'}</td>
                      <td className="table-cell text-gray-600">{r.totalBills}</td>
                      <td className="table-cell font-semibold">{formatCurrency(Number(r.totalValue))}</td>
                      <td className="table-cell text-green-600 font-medium">{formatCurrency(Number(r.totalPaid))}</td>
                      <td className="table-cell text-red-600 font-medium">{formatCurrency(Number(r.totalPending))}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700 font-semibold">
                    <td className="table-cell">TOTAL</td>
                    <td className="table-cell">{report.reduce((s, r) => s + Number(r.totalBills), 0)}</td>
                    <td className="table-cell">{formatCurrency(report.reduce((s, r) => s + Number(r.totalValue), 0))}</td>
                    <td className="table-cell text-green-600">{formatCurrency(report.reduce((s, r) => s + Number(r.totalPaid), 0))}</td>
                    <td className="table-cell text-red-600">{formatCurrency(report.reduce((s, r) => s + Number(r.totalPending), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: REEMITIR BOLETO ==================== */}
      {reissuingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Reemitir boleto</h2>
                <p className="text-sm text-gray-500 mt-0.5">{reissuingPayment.customerName} - R$ {Number(reissuingPayment.value).toFixed(2)}</p>
              </div>
              <button onClick={() => setReissuingPayment(null)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg">O boleto atual será cancelado automaticamente e um novo será gerado com a data (e valor, se alterado) abaixo.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova data de vencimento *</label>
                <input type="date" className="input" value={reissueDueDate} onChange={e => setReissueDueDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (opcional - deixe igual para manter)</label>
                <input type="number" step="0.01" min="0" className="input" value={reissueValue} onChange={e => setReissueValue(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setReissuingPayment(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={confirmReissue} disabled={reissuing} className="btn btn-primary flex items-center gap-2">
                {reissuing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <CalendarClock className="w-4 h-4" />}
                {reissuing ? 'Reemitindo...' : 'Reemitir boleto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewSaleId && <ReviewSaleModal saleId={reviewSaleId} onClose={() => setReviewSaleId(null)} />}

      {/* ==================== MODAL: NOVA/EDITAR CONTA ==================== */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingBill ? 'Editar Conta' : 'Nova Conta a Pagar'}
              </h2>
              <button onClick={() => setShowBillModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fornecedor *</label>
                <select className="input" value={billForm.supplierId} onChange={e => setBillForm({ ...billForm, supplierId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
                <input className="input" value={billForm.description} onChange={e => setBillForm({ ...billForm, description: e.target.value })} placeholder="Ex: Conta de energia elétrica" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$) *</label>
                  <input className="input" type="number" step="0.01" min="0" value={billForm.value} onChange={e => setBillForm({ ...billForm, value: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vencimento *</label>
                  <input className="input" type="date" value={billForm.dueDate} onChange={e => setBillForm({ ...billForm, dueDate: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                  <select className="input" value={billForm.category} onChange={e => setBillForm({ ...billForm, category: e.target.value })}>
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parcelas</label>
                  <input className="input" type="number" min="1" max="48" value={billForm.installments} onChange={e => setBillForm({ ...billForm, installments: e.target.value })} disabled={!!editingBill || billForm.isFixedCost} />
                  {!editingBill && !billForm.isFixedCost && parseInt(billForm.installments) > 1 && (
                    <p className="text-xs text-gray-500 mt-1">Valor por parcela: {formatCurrency(parseFloat(billForm.value || '0') / parseInt(billForm.installments || '1'))}</p>
                  )}
                </div>
              </div>

              {!editingBill && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={billForm.isFixedCost} onChange={e => setBillForm({ ...billForm, isFixedCost: e.target.checked, installments: '1' })} />
                    Custo fixo (repete todo mês, ex: aluguel, internet)
                  </label>
                  {billForm.isFixedCost && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gerar por quantos meses</label>
                      <input className="input w-32" type="number" min="1" max="60" value={billForm.recurringMonths} onChange={e => setBillForm({ ...billForm, recurringMonths: e.target.value })} />
                      <p className="text-xs text-gray-500 mt-1">Cria {billForm.recurringMonths || 12} contas de {formatCurrency(parseFloat(billForm.value || '0'))} cada, uma por mês a partir do vencimento informado.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nº Documento</label>
                  <input className="input" value={billForm.documentNumber} onChange={e => setBillForm({ ...billForm, documentNumber: e.target.value })} placeholder="Nota fiscal, boleto..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                  <select className="input" value={billForm.paymentMethod} onChange={e => setBillForm({ ...billForm, paymentMethod: e.target.value })}>
                    <option value="">Selecione...</option>
                    <option value="pix">PIX</option>
                    <option value="boleto">Boleto</option>
                    <option value="transferencia">Transferência</option>
                    <option value="cartao_credito">Cartão Crédito</option>
                    <option value="debito_auto">Débito Automático</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código de Barras</label>
                <input className="input" value={billForm.barcode} onChange={e => setBillForm({ ...billForm, barcode: e.target.value })} placeholder="Linha digitável do boleto" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                <textarea className="input" rows={2} value={billForm.observations} onChange={e => setBillForm({ ...billForm, observations: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowBillModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={saveBill} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                {editingBill ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: PAGAR CONTA ==================== */}
      {showPayModal && payingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmar Pagamento</h2>
              <button onClick={() => setShowPayModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Fornecedor: <strong>{payingBill.supplier?.name}</strong></p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Descrição: <strong>{payingBill.description}</strong></p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Valor: <strong>{formatCurrency(Number(payingBill.value))}</strong></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Pago (R$)</label>
                <input className="input" type="number" step="0.01" min="0" value={payValue} onChange={e => setPayValue(e.target.value)} />
                {parseFloat(payValue) < Number(payingBill.value) && (
                  <p className="text-xs text-yellow-600 mt-1">Pagamento parcial — restante: {formatCurrency(Number(payingBill.value) - parseFloat(payValue || '0'))}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="transferencia">Transferência</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="debito_auto">Débito Automático</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowPayModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={confirmPay} className="btn btn-primary flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: FORNECEDOR ==================== */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
              <button onClick={() => setShowSupplierModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                  <input className="input" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="Razão social ou nome" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPF/CNPJ</label>
                  <input className="input" value={supplierForm.cpfCnpj} onChange={e => setSupplierForm({ ...supplierForm, cpfCnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
                  <input className="input" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input className="input" type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="email@fornecedor.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endereço</label>
                <input className="input" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} placeholder="Rua, número, bairro" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cidade</label>
                  <input className="input" value={supplierForm.city} onChange={e => setSupplierForm({ ...supplierForm, city: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UF</label>
                  <input className="input" maxLength={2} value={supplierForm.uf} onChange={e => setSupplierForm({ ...supplierForm, uf: e.target.value.toUpperCase() })} placeholder="SP" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CEP</label>
                  <input className="input" value={supplierForm.cep} onChange={e => setSupplierForm({ ...supplierForm, cep: e.target.value })} placeholder="00000-000" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pessoa de Contato</label>
                <input className="input" value={supplierForm.contactPerson} onChange={e => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                <textarea className="input" rows={2} value={supplierForm.observations} onChange={e => setSupplierForm({ ...supplierForm, observations: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowSupplierModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={saveSupplier} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                {editingSupplier ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewSaleModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [sale, setSale] = useState<any>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/sales/' + saleId),
      api.get('/financial/accounts/by-sale/' + saleId).catch(() => ({ data: {} })),
    ]).then(([saleRes, accRes]) => {
      setSale(saleRes.data)
      setInstallments(accRes.data?.installmentsList || [])
    }).finally(() => setLoading(false))
  }, [saleId])

  const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', parcial: 'bg-blue-100 text-blue-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Revisar venda após reemissão</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : !sale ? (
          <p className="p-6 text-sm text-gray-500">Não foi possível carregar a venda.</p>
        ) : (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Cliente:</span> <strong>{sale.customer?.name}</strong></div>
              <div><span className="text-gray-500">Técnico:</span> <strong>{sale.technician?.name}</strong></div>
              <div><span className="text-gray-500">Total:</span> <strong className="text-green-600">R$ {Number(sale.totalAmount).toFixed(2)}</strong></div>
              <div><span className="text-gray-500">Status:</span> <strong>{sale.status}</strong></div>
            </div>
            {installments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Parcelas ({installments.length}x)</h3>
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-cell font-semibold text-gray-700">Parcela</th>
                      <th className="table-cell font-semibold text-gray-700">Valor</th>
                      <th className="table-cell font-semibold text-gray-700">Vencimento</th>
                      <th className="table-cell font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {installments.map((inst: any) => (
                      <tr key={inst.id}>
                        <td className="table-cell text-sm">{inst.number}ª parcela</td>
                        <td className="table-cell text-sm">R$ {Number(inst.value).toFixed(2)}</td>
                        <td className="table-cell text-sm">{inst.dueDate ? new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="table-cell"><span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[inst.status] || '')}>{inst.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <a href={`/sales/new?edit=${saleId}`} className="btn btn-secondary">Editar venda</a>
          <button onClick={onClose} className="btn btn-primary">Fechar</button>
        </div>
      </div>
    </div>
  )
}
