import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, Search, Check, X, Filter, AlertTriangle, DollarSign,
  Clock, CheckCircle, Trash2, Edit2, Receipt, Users,
  TrendingUp, Ban, CreditCard
} from 'lucide-react'

type Tab = 'contas' | 'fornecedores' | 'relatorio'

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
  supplier: Supplier | null;
}

interface Summary {
  totalOverdue: number; totalPending: number; totalPaid: number;
  qtdOverdue: number; qtdPending: number; qtdPaid: number;
}

interface ReportRow {
  supplierId: string; supplierName: string; totalBills: string;
  totalValue: string; totalPaid: string; totalPending: string;
}

const statusLabels: Record<string, string> = {
  pendente: 'Pendente', pago: 'Pago', parcial: 'Parcial',
  vencido: 'Vencido', cancelado: 'Cancelado'
}
const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  pago: 'bg-green-100 text-green-700',
  parcial: 'bg-blue-100 text-blue-700',
  vencido: 'bg-red-100 text-red-700',
  cancelado: 'bg-gray-100 text-gray-700',
}
const categories = [
  'Aluguel', 'Energia', 'Internet', 'Telefone', 'Água',
  'Material', 'Serviço', 'Impostos', 'Salários', 'Software',
  'Equipamentos', 'Manutenção', 'Marketing', 'Outros'
]

function formatCurrency(v: number) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}

export function Bills() {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('contas')
  const [bills, setBills] = useState<Bill[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [alerts, setAlerts] = useState<{ overdue: Bill[]; upcoming: Bill[] }>({ overdue: [], upcoming: [] })
  const [report, setReport] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Bill Modal
  const [showBillModal, setShowBillModal] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [saving, setSaving] = useState(false)
  const [billForm, setBillForm] = useState({
    supplierId: '', description: '', value: '', dueDate: '',
    category: '', installments: '1', barcode: '', documentNumber: '',
    paymentMethod: '', observations: ''
  })

  // Pay Modal
  const [showPayModal, setShowPayModal] = useState(false)
  const [payingBill, setPayingBill] = useState<Bill | null>(null)
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

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [bRes, sRes, sumRes, alertRes] = await Promise.all([
        api.get('/bills'),
        api.get('/suppliers'),
        api.get('/bills/summary'),
        api.get('/bills/alerts'),
      ])
      setBills(bRes.data)
      setSuppliers(sRes.data)
      setSummary(sumRes.data)
      setAlerts(alertRes.data)
    } catch { setError('Erro ao carregar dados') }
    finally { setLoading(false) }
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

  useEffect(() => { if (activeTab === 'relatorio') loadReport() }, [activeTab])

  // ==================== BILL CRUD ====================
  function openNewBill() {
    setEditingBill(null)
    setBillForm({ supplierId: '', description: '', value: '', dueDate: '', category: '', installments: '1', barcode: '', documentNumber: '', paymentMethod: '', observations: '' })
    setError(''); setShowBillModal(true)
  }

  function openEditBill(b: Bill) {
    setEditingBill(b)
    setBillForm({
      supplierId: b.supplierId, description: b.description,
      value: String(b.value), dueDate: b.dueDate,
      category: b.category || '', installments: String(b.installments),
      barcode: b.barcode || '', documentNumber: b.documentNumber || '',
      paymentMethod: b.paymentMethod || '', observations: b.observations || ''
    })
    setError(''); setShowBillModal(true)
  }

  async function saveBill() {
    if (!billForm.supplierId || !billForm.description || !billForm.value || !billForm.dueDate) {
      setError('Fornecedor, descrição, valor e vencimento são obrigatórios'); return
    }
    setSaving(true)
    try {
      const payload = {
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
      if (editingBill) {
        await api.patch('/bills/' + editingBill.id, payload)
      } else {
        await api.post('/bills', payload)
      }
      setShowBillModal(false); loadAll()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  function openPay(b: Bill) {
    setPayingBill(b)
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
      })
      setShowPayModal(false); loadAll()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao pagar') }
  }

  async function cancelBill(id: string) {
    if (!confirm('Cancelar esta conta?')) return
    try { await api.patch('/bills/' + id + '/cancel'); loadAll() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar') }
  }

  async function removeBill(id: string) {
    if (!confirm('Excluir esta conta permanentemente?')) return
    try { await api.delete('/bills/' + id); loadAll() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir') }
  }

  // ==================== SUPPLIER CRUD ====================
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
      setShowSupplierModal(false); loadAll()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar fornecedor') }
    finally { setSaving(false) }
  }

  async function removeSupplier(id: string) {
    if (!confirm('Excluir este fornecedor?')) return
    try { await api.delete('/suppliers/' + id); loadAll() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir') }
  }

  // Filter bills
  const filteredBills = bills.filter(b => {
    const matchSearch = b.description?.toLowerCase().includes(search.toLowerCase()) ||
      b.supplier?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || b.status === statusFilter
    const matchSupplier = !supplierFilter || b.supplierId === supplierFilter
    const matchCategory = !categoryFilter || b.category === categoryFilter
    const matchStart = !startDate || b.dueDate >= startDate
    const matchEnd = !endDate || b.dueDate <= endDate
    return matchSearch && matchStatus && matchSupplier && matchCategory && matchStart && matchEnd
  })

  const tabItems: { key: Tab; label: string; icon: any }[] = [
    { key: 'contas', label: 'Contas', icon: Receipt },
    { key: 'fornecedores', label: 'Fornecedores', icon: Users },
    { key: 'relatorio', label: 'Relatório', icon: TrendingUp },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contas a Pagar</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão de contas, fornecedores e pagamentos</p>
        </div>
        {activeTab === 'contas' && (
          <button onClick={openNewBill} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        )}
        {activeTab === 'fornecedores' && (
          <button onClick={openNewSupplier} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Fornecedor
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Vencido ({summary.qtdOverdue})</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(summary.totalOverdue)}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pendente ({summary.qtdPending})</p>
              <p className="text-lg font-bold text-yellow-600">{formatCurrency(summary.totalPending)}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pago ({summary.qtdPaid})</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {activeTab === 'contas' && (alerts.overdue.length > 0 || alerts.upcoming.length > 0) && (
        <div className="card mb-6 border-l-4 border-l-orange-400">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Alertas
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

      {/* ==================== TAB: CONTAS ==================== */}
      {activeTab === 'contas' && (
        <>
          {/* Filters */}
          <div className="card mb-6">
            <div className="flex gap-3 flex-wrap items-end">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-10" placeholder="Buscar por descrição ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">Status</option>
                  {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <select className="input w-44" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
                <option value="">Fornecedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input w-36" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">Categoria</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="input w-36" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} title="De" />
              <input className="input w-36" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} title="Até" />
            </div>
          </div>

          {/* Bills Table */}
          <div className="card overflow-hidden p-0">
            {loading ? (
              <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
            ) : (
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Vencimento</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Fornecedor</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Descrição</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Categoria</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Valor</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Parcela</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBills.length === 0 ? (
                    <tr><td colSpan={8} className="table-cell text-center text-gray-500">Nenhuma conta encontrada</td></tr>
                  ) : filteredBills.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="table-cell text-sm text-gray-600 dark:text-gray-400">{formatDate(b.dueDate)}</td>
                      <td className="table-cell text-gray-700 dark:text-gray-300">{b.supplier?.name || '-'}</td>
                      <td className="table-cell font-medium text-gray-900 dark:text-white">{b.description}</td>
                      <td className="table-cell text-sm text-gray-600 dark:text-gray-400">{b.category || '-'}</td>
                      <td className="table-cell font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(b.value))}</td>
                      <td className="table-cell text-sm text-gray-600">{b.installments > 1 ? `${b.installmentNumber}/${b.installments}` : '-'}</td>
                      <td className="table-cell"><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (statusColors[b.status] || '')}>{statusLabels[b.status] || b.status}</span></td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {['pendente', 'vencido', 'parcial'].includes(b.status) && (
                            <button onClick={() => openPay(b)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Pagar">
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {['pendente', 'vencido'].includes(b.status) && (
                            <button onClick={() => openEditBill(b)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {['pendente', 'vencido'].includes(b.status) && (
                            <button onClick={() => cancelBill(b.id)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Cancelar">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => removeBill(b.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                  <input className="input" type="number" min="1" max="48" value={billForm.installments} onChange={e => setBillForm({ ...billForm, installments: e.target.value })} disabled={!!editingBill} />
                  {!editingBill && parseInt(billForm.installments) > 1 && (
                    <p className="text-xs text-gray-500 mt-1">Valor por parcela: {formatCurrency(parseFloat(billForm.value || '0') / parseInt(billForm.installments || '1'))}</p>
                  )}
                </div>
              </div>

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
