import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DollarSign, CreditCard, AlertTriangle, TrendingUp, Calendar, Search, Check, X, Filter } from 'lucide-react'

type Tab = 'dashboard' | 'accounts' | 'installments' | 'flow' | 'card-fees' | 'overdue'

interface DashboardData { totalVendido: number; totalRecebido: number; totalPendente: number; totalInadimplente: number; ticketMedio: number }
interface Account { id: string; customer: { id: string; name: string }; sale?: { id: string }; totalValue: number; paidValue: number; status: string; paymentMethod: string; createdAt: string; installments?: Installment[] }
interface Installment { id: string; accountId: string; number: number; value: number; paidValue: number; dueDate: string; paidAt: string | null; status: string; paymentMethod: string; customer?: { name: string } }
interface Movement { id: string; type: string; category: string; description: string; value: number; date: string; isForecast: boolean }
interface FlowData { forecast: { receitas: number }; realized: { receitas: number; despesas: number; estornos: number; saldo: number } }
interface CardFee { id: string; operator: string; paymentType: string; feePercentage: number; daysToReceive: number; installmentsFrom: number; installmentsTo: number; active: boolean }

const statusLabels: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', parcial: 'Parcial', vencido: 'Vencido', cancelado: 'Cancelado' }
const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', pago: 'bg-green-100 text-green-700', parcial: 'bg-blue-100 text-blue-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700' }
const paymentMethods: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', boleto: 'Boleto', transferencia: 'Transferência' }
const tabLabels: Record<Tab, string> = { dashboard: 'Dashboard', accounts: 'Contas a Receber', installments: 'Parcelas', flow: 'Fluxo de Caixa', 'card-fees': 'Taxas Cartão', overdue: 'Inadimplentes' }

function formatCurrency(value: number) { return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function formatDate(date: string) { if (!date) return '-'; return new Date(date + (date.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') }

export function Financial() {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-01' })
  const [dateTo, setDateTo] = useState(() => { const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0); return last.getFullYear() + '-' + String(last.getMonth()+1).padStart(2,'0') + '-' + String(last.getDate()).padStart(2,'0') })
  const [page, setPage] = useState(1)
  const perPage = 10

  // Dashboard
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)

  // Accounts
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountStatus, setAccountStatus] = useState('')
  const [accountPayMethod, setAccountPayMethod] = useState('')

  // Installments
  const [installments, setInstallments] = useState<Installment[]>([])
  const [installmentStatus, setInstallmentStatus] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [payingInstallment, setPayingInstallment] = useState<Installment | null>(null)
  const [payValue, setPayValue] = useState('')
  const [payMethod, setPayMethod] = useState('pix')
  const [paying, setPaying] = useState(false)

  // Flow
  const [movements, setMovements] = useState<Movement[]>([])
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [flowType, setFlowType] = useState('')
  const [flowCategory, setFlowCategory] = useState('')
  const [flowForecast, setFlowForecast] = useState('')
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseValue, setExpenseValue] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('outros')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expenseIsForecast, setExpenseIsForecast] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false)

  // Card Fees
  const [cardFees, setCardFees] = useState<CardFee[]>([])
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [feeOperator, setFeeOperator] = useState('')
  const [feeType, setFeeType] = useState('credito')
  const [feePercent, setFeePercent] = useState('')
  const [feeDays, setFeeDays] = useState('')
  const [savingFee, setSavingFee] = useState(false)

  // Overdue
  const [overdue, setOverdue] = useState<Installment[]>([])

  const [error, setError] = useState('')

  useEffect(() => { setPage(1); loadTab() }, [activeTab, dateFrom, dateTo, accountStatus, accountPayMethod, installmentStatus, flowType, flowCategory, flowForecast])

  function getDateRange() {
    return { startDate: dateFrom, endDate: dateTo }
  }

  async function loadTab() {
    setLoading(true)
    setError('')
    const { startDate, endDate } = getDateRange()
    try {
      switch (activeTab) {
        case 'dashboard': {
          const res = await api.get('/financial/dashboard')
          setDashboard(res.data)
          break
        }
        case 'accounts': {
          const params: any = {}
          if (startDate) { params.startDate = startDate; params.endDate = endDate }
          if (accountStatus) params.status = accountStatus
          if (accountPayMethod) params.paymentMethod = accountPayMethod
          const res = await api.get('/financial/accounts', { params })
          setAccounts(res.data)
          break
        }
        case 'installments': {
          const params: any = {}
          if (startDate) { params.startDate = startDate; params.endDate = endDate }
          if (installmentStatus) params.status = installmentStatus
          const res = await api.get('/financial/installments', { params })
          setInstallments(res.data)
          break
        }
        case 'flow': {
          const params: any = {}
          if (startDate) { params.startDate = startDate; params.endDate = endDate }
          if (flowType) params.type = flowType
          if (flowCategory) params.category = flowCategory
          if (flowForecast) params.isForecast = flowForecast
          const flowParams = startDate ? { startDate, endDate } : { startDate: '2020-01-01', endDate: '2030-12-31' }
          const [movRes, flowRes] = await Promise.all([
            api.get('/financial/movements', { params }),
            api.get('/financial/flow', { params: flowParams })
          ])
          setMovements(movRes.data)
          setFlowData(flowRes.data)
          break
        }
        case 'card-fees': {
          const res = await api.get('/financial/card-fees')
          setCardFees(res.data)
          break
        }
        case 'overdue': {
          const res = await api.get('/financial/overdue')
          setOverdue(res.data)
          break
        }
      }
    } catch { setError('Erro ao carregar dados') } finally { setLoading(false) }
  }

  function openPayModal(inst: Installment) {
    setPayingInstallment(inst)
    setPayValue(String(inst.value - (inst.paidValue || 0)))
    setPayMethod('pix')
    setShowPayModal(true)
  }

  async function confirmPay() {
    if (!payingInstallment || !payValue || Number(payValue) <= 0) return
    setPaying(true)
    try {
      await api.post(`/financial/pay/${payingInstallment.id}`, { value: Number(payValue), paymentMethod: payMethod })
      setShowPayModal(false)
      setPayingInstallment(null)
      loadTab()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao pagar') } finally { setPaying(false) }
  }

  async function cancelAccount(id: string) {
    const reason = prompt('Motivo do cancelamento:')
    if (!reason) return
    try { await api.post(`/financial/cancel/${id}`, { reason }); loadTab() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar') }
  }

  async function saveFee() {
    if (!feeOperator || !feePercent || !feeDays) { setError('Preencha todos os campos'); return }
    setSavingFee(true)
    try {
      await api.post('/financial/card-fees', { operator: feeOperator, paymentType: feeType, feePercentage: Number(feePercent), daysToReceive: Number(feeDays) })
      setShowFeeModal(false)
      setFeeOperator(''); setFeePercent(''); setFeeDays('')
      loadTab()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') } finally { setSavingFee(false) }
  }

  async function saveExpense() {
    if (!expenseDescription.trim() || !expenseValue || Number(expenseValue) <= 0) { setError('Preencha descrição e valor da despesa'); return }
    setSavingExpense(true)
    try {
      await api.post('/financial/movements', {
        type: 'despesa',
        category: expenseCategory,
        description: expenseDescription.trim(),
        value: Number(expenseValue),
        date: expenseDate,
        isForecast: expenseIsForecast,
      })
      setShowExpenseModal(false)
      setExpenseDescription(''); setExpenseValue(''); setExpenseCategory('outros')
      setExpenseDate(new Date().toISOString().split('T')[0]); setExpenseIsForecast(false)
      loadTab()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar despesa') }
    finally { setSavingExpense(false) }
  }

  async function deleteFee(id: string) {
    if (!confirm('Remover taxa?')) return
    try { await api.delete(`/financial/card-fees/${id}`); loadTab() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao remover') }
  }

  function paginate<T>(items: T[]): T[] {
    const filtered = items.filter((item: any) => {
      if (!search) return true
      const s = search.toLowerCase()
      return JSON.stringify(item).toLowerCase().includes(s)
    })
    return filtered.slice((page - 1) * perPage, page * perPage)
  }

  function totalPages<T>(items: T[]): number {
    const filtered = items.filter((item: any) => {
      if (!search) return true
      return JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
    })
    return Math.ceil(filtered.length / perPage) || 1
  }

  // ==================== RENDER ====================
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financeiro</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão financeira completa</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {(Object.keys(tabLabels) as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ' + (activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'card-fees' && (
        <div className="card mb-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
              <input type="date" className="input w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Até</label>
              <input type="date" className="input w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-10" placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            {activeTab === 'accounts' && (
              <>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select className="input w-36" value={accountStatus} onChange={e => setAccountStatus(e.target.value)}>
                    <option value="">Status</option>
                    {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <select className="input w-40" value={accountPayMethod} onChange={e => setAccountPayMethod(e.target.value)}>
                    <option value="">Forma Pgto</option>
                    {Object.entries(paymentMethods).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </>
            )}
            {activeTab === 'installments' && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select className="input w-36" value={installmentStatus} onChange={e => setInstallmentStatus(e.target.value)}>
                  <option value="">Status</option>
                  {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
            {activeTab === 'flow' && (
              <>
                <div>
                  <select className="input w-32" value={flowType} onChange={e => setFlowType(e.target.value)}>
                    <option value="">Tipo</option>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                    <option value="estorno">Estorno</option>
                  </select>
                </div>
                <div>
                  <select className="input w-40" value={flowCategory} onChange={e => setFlowCategory(e.target.value)}>
                    <option value="">Categoria</option>
                    <option value="venda">Venda</option>
                    <option value="compra_mercadoria">Compra Mercadoria</option>
                    <option value="taxa_cartao">Taxa Cartão</option>
                    <option value="comissao">Comissão</option>
                    <option value="estorno">Estorno</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div>
                  <select className="input w-36" value={flowForecast} onChange={e => setFlowForecast(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="false">Realizado</option>
                    <option value="true">Previsto</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {loading ? (
        <div className="card flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && dashboard && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="card flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-600" /></div>
                <div><p className="text-xs text-gray-500">Total Vendido</p><p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(dashboard.totalVendido)}</p></div>
              </div>
              <div className="card flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><Check className="w-5 h-5 text-green-600" /></div>
                <div><p className="text-xs text-gray-500">Total Recebido</p><p className="text-lg font-bold text-green-600">{formatCurrency(dashboard.totalRecebido)}</p></div>
              </div>
              <div className="card flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><Calendar className="w-5 h-5 text-yellow-600" /></div>
                <div><p className="text-xs text-gray-500">Total Pendente</p><p className="text-lg font-bold text-yellow-600">{formatCurrency(dashboard.totalPendente)}</p></div>
              </div>
              <div className="card flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div><p className="text-xs text-gray-500">Inadimplência</p><p className="text-lg font-bold text-red-600">{formatCurrency(dashboard.totalInadimplente)}</p></div>
              </div>
              <div className="card flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
                <div><p className="text-xs text-gray-500">Ticket Médio</p><p className="text-lg font-bold text-purple-600">{formatCurrency(dashboard.ticketMedio)}</p></div>
              </div>
            </div>
          )}

          {/* Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Valor Total</th>
                    <th className="table-header">Pago</th>
                    <th className="table-header">Forma Pgto</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(accounts).map(acc => (
                    <tr key={acc.id}>
                      <td className="table-cell font-medium">{acc.customer?.name || '-'}</td>
                      <td className="table-cell">{formatCurrency(acc.totalValue)}</td>
                      <td className="table-cell">{formatCurrency(acc.paidValue)}</td>
                      <td className="table-cell">{paymentMethods[acc.paymentMethod] || acc.paymentMethod}</td>
                      <td className="table-cell"><span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[acc.status] || '')}>{statusLabels[acc.status] || acc.status}</span></td>
                      <td className="table-cell">{formatDate(acc.createdAt)}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {acc.status !== 'pago' && acc.status !== 'cancelado' && acc.installments?.[0] && (
                            <button onClick={() => openPayModal(acc.installments![0])} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Pagar parcela"><DollarSign className="w-4 h-4" /></button>
                          )}
                          {acc.status !== 'cancelado' && acc.status !== 'pago' && (
                            <button onClick={() => cancelAccount(acc.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Cancelar"><X className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && <tr><td colSpan={7} className="table-cell text-center text-gray-500">Nenhuma conta encontrada</td></tr>}
                </tbody>
              </table>
              {totalPages(accounts) > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500">Página {page} de {totalPages(accounts)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Anterior</button>
                    <button onClick={() => setPage(p => Math.min(totalPages(accounts), p + 1))} disabled={page === totalPages(accounts)} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Próximo</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Installments Tab */}
          {activeTab === 'installments' && (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Parcela</th>
                    <th className="table-header">Valor</th>
                    <th className="table-header">Pago</th>
                    <th className="table-header">Vencimento</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(installments).map(inst => {
                    const isOverdue = inst.status === 'vencido' || (inst.status === 'pendente' && new Date(inst.dueDate) < new Date())
                    return (
                      <tr key={inst.id} className={isOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="table-cell font-medium">{inst.customer?.name || '-'}</td>
                        <td className="table-cell">#{inst.number}</td>
                        <td className="table-cell">{formatCurrency(inst.value)}</td>
                        <td className="table-cell">{formatCurrency(inst.paidValue)}</td>
                        <td className={'table-cell ' + (isOverdue ? 'text-red-600 font-medium' : '')}>{formatDate(inst.dueDate)}</td>
                        <td className="table-cell"><span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[isOverdue ? 'vencido' : inst.status] || '')}>{isOverdue ? 'Vencido' : (statusLabels[inst.status] || inst.status)}</span></td>
                        <td className="table-cell">
                          {inst.status !== 'pago' && inst.status !== 'cancelado' && (
                            <button onClick={() => openPayModal(inst)} className="btn btn-primary px-3 py-1 text-xs flex items-center gap-1"><DollarSign className="w-3 h-3" /> Pagar</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {installments.length === 0 && <tr><td colSpan={7} className="table-cell text-center text-gray-500">Nenhuma parcela encontrada</td></tr>}
                </tbody>
              </table>
              {totalPages(installments) > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500">Página {page} de {totalPages(installments)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Anterior</button>
                    <button onClick={() => setPage(p => Math.min(totalPages(installments), p + 1))} disabled={page === totalPages(installments)} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Próximo</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flow Tab */}
          {activeTab === 'flow' && (
            <div className="space-y-6">
              {/* Flow Summary */}
              {flowData && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div>
                    <div><p className="text-xs text-gray-500">Receitas Realizadas</p><p className="text-lg font-bold text-green-600">{formatCurrency(flowData.realized?.receitas || 0)}</p></div>
                  </div>
                  <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-red-600 rotate-180" /></div>
                    <div><p className="text-xs text-gray-500">Despesas + Estornos</p><p className="text-lg font-bold text-red-600">{formatCurrency((flowData.realized?.despesas || 0) + (flowData.realized?.estornos || 0))}</p></div>
                  </div>
                  <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-600" /></div>
                    <div><p className="text-xs text-gray-500">Saldo</p><p className="text-lg font-bold text-blue-600">{formatCurrency(flowData.realized?.saldo || 0)}</p></div>
                  </div>
                  <div className="card flex items-center justify-center">
                    <button onClick={() => setShowExpenseModal(true)} className="btn btn-primary flex items-center gap-2 text-sm w-full justify-center">
                      <TrendingUp className="w-4 h-4 rotate-180" /> Adicionar Despesa
                    </button>
                  </div>
                </div>
              )}
              {!flowData && (
                <div className="flex justify-end mb-4">
                  <button onClick={() => setShowExpenseModal(true)} className="btn btn-primary flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 rotate-180" /> Adicionar Despesa
                  </button>
                </div>
              )}

              {/* Movements Table */}
              <div className="card overflow-x-auto">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Movimentações</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="table-header">Data</th>
                      <th className="table-header">Tipo</th>
                      <th className="table-header">Categoria</th>
                      <th className="table-header">Descrição</th>
                      <th className="table-header">Valor</th>
                      <th className="table-header">Previsão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(movements).map(mov => (
                      <tr key={mov.id}>
                        <td className="table-cell">{formatDate(mov.date)}</td>
                        <td className="table-cell"><span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (mov.type === 'receita' ? 'bg-green-100 text-green-700' : mov.type === 'despesa' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>{mov.type === 'receita' ? 'Receita' : mov.type === 'despesa' ? 'Despesa' : 'Estorno'}</span></td>
                        <td className="table-cell capitalize">{mov.category}</td>
                        <td className="table-cell">{mov.description}</td>
                        <td className={'table-cell font-medium ' + (mov.type === 'receita' ? 'text-green-600' : 'text-red-600')}>{mov.type === 'receita' ? '+' : '-'} {formatCurrency(mov.value)}</td>
                        <td className="table-cell">{mov.isForecast ? <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">Previsto</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Realizado</span>}</td>
                      </tr>
                    ))}
                    {movements.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-gray-500">Nenhuma movimentação encontrada</td></tr>}
                  </tbody>
                </table>
                {totalPages(movements) > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Página {page} de {totalPages(movements)}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Anterior</button>
                      <button onClick={() => setPage(p => Math.min(totalPages(movements), p + 1))} disabled={page === totalPages(movements)} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Próximo</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card Fees Tab */}
          {activeTab === 'card-fees' && (
            <div className="card overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Taxas de Cartão</h3>
                <button onClick={() => { setFeeOperator(''); setFeeType('credito'); setFeePercent(''); setFeeDays(''); setShowFeeModal(true) }} className="btn btn-primary flex items-center gap-2 text-sm"><CreditCard className="w-4 h-4" /> Nova Taxa</button>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-header">Operadora</th>
                    <th className="table-header">Tipo</th>
                    <th className="table-header">Taxa (%)</th>
                    <th className="table-header">Dias p/ Receber</th>
                    <th className="table-header">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cardFees.map(fee => (
                    <tr key={fee.id}>
                      <td className="table-cell font-medium">{fee.operator}</td>
                      <td className="table-cell"><span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (fee.paymentType === 'credito' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>{fee.paymentType === 'credito' ? 'Crédito' : 'Débito'}</span></td>
                      <td className="table-cell">{Number(fee.feePercentage).toFixed(2)}%</td>
                      <td className="table-cell">{fee.daysToReceive} dias</td>
                      <td className="table-cell">
                        {isAdmin && <button onClick={() => deleteFee(fee.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Remover"><X className="w-4 h-4" /></button>}
                      </td>
                    </tr>
                  ))}
                  {cardFees.length === 0 && <tr><td colSpan={5} className="table-cell text-center text-gray-500">Nenhuma taxa cadastrada</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Overdue Tab */}
          {activeTab === 'overdue' && (
            <div className="card overflow-x-auto">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-semibold text-red-700">Inadimplentes ({overdue.length})</h3>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Parcela</th>
                    <th className="table-header">Valor</th>
                    <th className="table-header">Vencimento</th>
                    <th className="table-header">Dias Atraso</th>
                    <th className="table-header">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(overdue).map(inst => {
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={inst.id} className="bg-red-50 dark:bg-red-900/10">
                        <td className="table-cell font-medium">{inst.customer?.name || '-'}</td>
                        <td className="table-cell">#{inst.number}</td>
                        <td className="table-cell font-medium text-red-600">{formatCurrency(inst.value - (inst.paidValue || 0))}</td>
                        <td className="table-cell text-red-600">{formatDate(inst.dueDate)}</td>
                        <td className="table-cell"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{daysOverdue} dias</span></td>
                        <td className="table-cell">
                          <button onClick={() => openPayModal(inst)} className="btn btn-primary px-3 py-1 text-xs flex items-center gap-1"><DollarSign className="w-3 h-3" /> Pagar</button>
                        </td>
                      </tr>
                    )
                  })}
                  {overdue.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-gray-500">Nenhum inadimplente</td></tr>}
                </tbody>
              </table>
              {totalPages(overdue) > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500">Página {page} de {totalPages(overdue)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Anterior</button>
                    <button onClick={() => setPage(p => Math.min(totalPages(overdue), p + 1))} disabled={page === totalPages(overdue)} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-50">Próximo</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Payment Modal */}
      {showPayModal && payingInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar Pagamento</h2>
              <button onClick={() => setShowPayModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <p className="text-sm text-gray-500">Parcela #{payingInstallment.number}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(payingInstallment.value)}</p>
                {payingInstallment.paidValue > 0 && <p className="text-xs text-green-600">Já pago: {formatCurrency(payingInstallment.paidValue)}</p>}
                <p className="text-xs text-gray-500">Restante: {formatCurrency(payingInstallment.value - (payingInstallment.paidValue || 0))}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do Pagamento (R$)</label>
                <input className="input" type="number" step="0.01" min="0.01" value={payValue} onChange={e => setPayValue(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  {Object.entries(paymentMethods).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowPayModal(false)} className="btn btn-primary bg-gray-200 text-gray-700 hover:bg-gray-300">Cancelar</button>
              <button onClick={confirmPay} disabled={paying || !payValue || Number(payValue) <= 0} className="btn btn-primary flex items-center gap-2 disabled:opacity-50">
                {paying ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />} Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Fee Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nova Taxa de Cartão</h2>
              <button onClick={() => setShowFeeModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operadora *</label>
                <input className="input" value={feeOperator} onChange={e => setFeeOperator(e.target.value)} placeholder="Ex: Cielo, Stone, PagSeguro" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
                <select className="input" value={feeType} onChange={e => setFeeType(e.target.value)}>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taxa (%) *</label>
                <input className="input" type="number" step="0.01" min="0" value={feePercent} onChange={e => setFeePercent(e.target.value)} placeholder="Ex: 2.50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dias para Receber *</label>
                <input className="input" type="number" min="0" value={feeDays} onChange={e => setFeeDays(e.target.value)} placeholder="Ex: 30" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowFeeModal(false)} className="btn btn-primary bg-gray-200 text-gray-700 hover:bg-gray-300">Cancelar</button>
              <button onClick={saveFee} disabled={savingFee} className="btn btn-primary flex items-center gap-2 disabled:opacity-50">
                {savingFee ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Adicionar Despesa</h2>
              <button onClick={() => setShowExpenseModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
                <input className="input" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} placeholder="Ex: Aluguel, Conta de luz, Material..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$) *</label>
                <input className="input" type="number" step="0.01" min="0.01" value={expenseValue} onChange={e => setExpenseValue(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria *</label>
                <select className="input" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>
                  <option value="aluguel">Aluguel</option>
                  <option value="energia">Energia</option>
                  <option value="internet">Internet/Telecom</option>
                  <option value="salarios">Salários</option>
                  <option value="impostos">Impostos</option>
                  <option value="compra_mercadoria">Compra de Mercadoria</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="combustivel">Combustível</option>
                  <option value="marketing">Marketing</option>
                  <option value="software">Software/Licenças</option>
                  <option value="comissao">Comissão</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data *</label>
                <input className="input" type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="expForecast" checked={expenseIsForecast} onChange={e => setExpenseIsForecast(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                <label htmlFor="expForecast" className="text-sm text-gray-700 dark:text-gray-300">Despesa prevista (não realizada ainda)</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowExpenseModal(false)} className="btn btn-primary bg-gray-200 text-gray-700 hover:bg-gray-300">Cancelar</button>
              <button onClick={saveExpense} disabled={savingExpense || !expenseDescription.trim() || !expenseValue || Number(expenseValue) <= 0} className="btn btn-primary flex items-center gap-2 disabled:opacity-50">
                {savingExpense ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />} Salvar Despesa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
