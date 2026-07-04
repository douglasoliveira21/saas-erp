import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Check, X, Filter, ShoppingBag, Truck, RotateCcw, CheckCircle, XCircle, Eye, Trash2, DollarSign, Package, ClipboardList, FileCheck } from 'lucide-react'

type Tab = 'all' | 'solicitacao' | 'cotacao' | 'ordem_compra' | 'aprovacao' | 'entrada' | 'devolucao' | 'fornecedores'

interface Purchase {
  id: string
  type: string
  status: string
  description: string
  supplierName: string
  supplierCnpj: string
  items: string
  totalValue: number
  paymentMethod: string
  dueDate: string
  deliveryDate: string
  invoiceNumber: string
  observations: string
  creator: { id: string; name: string } | null
  approver: { id: string; name: string } | null
  approvedAt: string
  receivedAt: string
  createdAt: string
}

interface Summary { total: number; pendentes: number; aprovadas: number; recebidas: number; totalValue: number }

const typeLabels: Record<string, string> = { solicitacao: 'Solicitação', cotacao: 'Cotação', ordem_compra: 'Ordem de Compra', aprovacao: 'Aprovação', entrada: 'Entrada Mercadoria', devolucao: 'Devolução' }
const statusLabels: Record<string, string> = { pendente: 'Pendente', aprovado: 'Aprovado', recebido: 'Recebido', cancelado: 'Cancelado', devolvido: 'Devolvido' }
const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', aprovado: 'bg-blue-100 text-blue-700', recebido: 'bg-green-100 text-green-700', cancelado: 'bg-gray-100 text-gray-700', devolvido: 'bg-red-100 text-red-700' }
const tabLabels: Record<Tab, string> = { all: 'Todas', solicitacao: 'Solicitações', cotacao: 'Cotações', ordem_compra: 'Ordens de Compra', aprovacao: 'Aprovações', entrada: 'Entradas', devolucao: 'Devoluções', fornecedores: 'Fornecedores' }

function formatCurrency(v: number) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function formatDate(d: string) { if (!d) return '-'; return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') }

export function Purchases() {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formType, setFormType] = useState('solicitacao')
  const [formDesc, setFormDesc] = useState('')
  const [formSupplier, setFormSupplier] = useState('')
  const [formCnpj, setFormCnpj] = useState('')
  const [formItems, setFormItems] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formPayment, setFormPayment] = useState('pix')
  const [formDueDate, setFormDueDate] = useState('')
  const [formDeliveryDate, setFormDeliveryDate] = useState('')
  const [formInvoice, setFormInvoice] = useState('')
  const [formObs, setFormObs] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Fornecedores (extracted from purchases)
  const suppliers = Array.from(new Set(purchases.map(p => p.supplierName).filter(Boolean)))

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/purchases/summary'),
      ])
      setPurchases(pRes.data)
      setSummary(sRes.data)
    } catch { setError('Erro ao carregar compras') }
    finally { setLoading(false) }
  }

  function resetForm() {
    setFormType('solicitacao'); setFormDesc(''); setFormSupplier(''); setFormCnpj('')
    setFormItems(''); setFormValue(''); setFormPayment('pix'); setFormDueDate('')
    setFormDeliveryDate(''); setFormInvoice(''); setFormObs(''); setEditingId(null)
  }

  function openNew(type?: string) {
    resetForm()
    if (type) setFormType(type)
    setError(''); setShowModal(true)
  }

  function openEdit(p: Purchase) {
    setEditingId(p.id)
    setFormType(p.type); setFormDesc(p.description); setFormSupplier(p.supplierName)
    setFormCnpj(p.supplierCnpj || ''); setFormItems(p.items || ''); setFormValue(String(p.totalValue || ''))
    setFormPayment(p.paymentMethod || 'pix'); setFormDueDate(p.dueDate || '')
    setFormDeliveryDate(p.deliveryDate || ''); setFormInvoice(p.invoiceNumber || '')
    setFormObs(p.observations || '')
    setError(''); setShowModal(true)
  }

  async function save() {
    if (!formDesc.trim() || !formSupplier.trim()) { setError('Descrição e fornecedor são obrigatórios'); return }
    setSaving(true)
    try {
      const payload = {
        type: formType,
        description: formDesc.trim(),
        supplierName: formSupplier.trim(),
        supplierCnpj: formCnpj || null,
        items: formItems || null,
        totalValue: formValue ? parseFloat(formValue) : 0,
        paymentMethod: formPayment,
        dueDate: formDueDate || null,
        deliveryDate: formDeliveryDate || null,
        invoiceNumber: formInvoice || null,
        observations: formObs || null,
      }
      if (editingId) {
        await api.patch('/purchases/' + editingId, payload)
      } else {
        await api.post('/purchases', payload)
      }
      setShowModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function approve(id: string) {
    try { await api.patch('/purchases/' + id + '/approve'); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao aprovar') }
  }

  async function receive(id: string) {
    try { await api.patch('/purchases/' + id + '/receive'); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao registrar entrada') }
  }

  async function returnPurchase(id: string) {
    const reason = prompt('Motivo da devolução:')
    if (!reason) return
    try { await api.patch('/purchases/' + id + '/return', { reason }); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao devolver') }
  }

  async function cancel(id: string) {
    if (!confirm('Cancelar esta compra?')) return
    try { await api.patch('/purchases/' + id + '/cancel'); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar') }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta compra?')) return
    try { await api.delete('/purchases/' + id); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir') }
  }

  const filtered = purchases.filter(p => {
    const matchTab = activeTab === 'all' || activeTab === 'fornecedores' || p.type === activeTab
    const matchSearch = p.description?.toLowerCase().includes(search.toLowerCase()) || p.supplierName?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchTab && matchSearch && matchStatus
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Compras</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão de compras e fornecedores</p>
        </div>
        <button onClick={() => openNew()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Compra
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><ShoppingBag className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold">{summary.total}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center"><ClipboardList className="w-4 h-4 text-yellow-600" /></div>
            <div><p className="text-xs text-gray-500">Pendentes</p><p className="text-lg font-bold text-yellow-600">{summary.pendentes}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><FileCheck className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Aprovadas</p><p className="text-lg font-bold text-blue-600">{summary.aprovadas}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-green-600" /></div>
            <div><p className="text-xs text-gray-500">Recebidas</p><p className="text-lg font-bold text-green-600">{summary.recebidas}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-purple-600" /></div>
            <div><p className="text-xs text-gray-500">Valor Total</p><p className="text-lg font-bold text-purple-600">{formatCurrency(summary.totalValue)}</p></div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {(Object.keys(tabLabels) as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ' + (activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'fornecedores' && (
        <div className="card mb-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-10" placeholder="Buscar por descrição ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {/* Fornecedores Tab */}
      {activeTab === 'fornecedores' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Fornecedores Cadastrados ({suppliers.length})</h3>
          {suppliers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum fornecedor encontrado. Crie uma compra para registrar fornecedores.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {suppliers.map(s => {
                const supplierPurchases = purchases.filter(p => p.supplierName === s)
                const totalSpent = supplierPurchases.filter(p => p.status === 'recebido').reduce((sum, p) => sum + Number(p.totalValue), 0)
                const cnpj = supplierPurchases.find(p => p.supplierCnpj)?.supplierCnpj
                return (
                  <div key={s} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-orange-600" /></div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{s}</p>
                        {cnpj && <p className="text-xs text-gray-500">{cnpj}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between text-sm text-gray-500">
                      <span>{supplierPurchases.length} compra(s)</span>
                      <span className="font-medium text-gray-700">{formatCurrency(totalSpent)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Purchases List */}
      {activeTab !== 'fornecedores' && (
        <div className="card overflow-hidden p-0">
          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
          ) : (
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Data</th>
                  <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Tipo</th>
                  <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Descrição</th>
                  <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Fornecedor</th>
                  <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Valor</th>
                  <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="table-cell text-center text-gray-500">Nenhuma compra encontrada</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{formatDate(p.createdAt)}</td>
                    <td className="table-cell"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{typeLabels[p.type] || p.type}</span></td>
                    <td className="table-cell font-medium text-gray-900 dark:text-white">{p.description}</td>
                    <td className="table-cell text-gray-600 dark:text-gray-400">{p.supplierName}</td>
                    <td className="table-cell font-semibold text-gray-900 dark:text-white">{formatCurrency(p.totalValue)}</td>
                    <td className="table-cell"><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (statusColors[p.status] || '')}>{statusLabels[p.status]}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {p.status === 'pendente' && <button onClick={() => approve(p.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Aprovar"><CheckCircle className="w-4 h-4" /></button>}
                        {p.status === 'aprovado' && <button onClick={() => receive(p.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Registrar Entrada"><Package className="w-4 h-4" /></button>}
                        {p.status === 'recebido' && <button onClick={() => returnPurchase(p.id)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Devolver"><RotateCcw className="w-4 h-4" /></button>}
                        {!['recebido', 'devolvido', 'cancelado'].includes(p.status) && <button onClick={() => openEdit(p)} className="p-1 text-gray-600 hover:bg-gray-50 rounded" title="Editar"><Eye className="w-4 h-4" /></button>}
                        {!['recebido', 'devolvido'].includes(p.status) && <button onClick={() => cancel(p.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar"><XCircle className="w-4 h-4" /></button>}
                        {isAdmin && p.status === 'cancelado' && <button onClick={() => remove(p.id)} className="p-1 text-gray-400 hover:text-red-600 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Nova Compra */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingId ? 'Editar Compra' : 'Nova Compra'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
                <select className="input" value={formType} onChange={e => setFormType(e.target.value)}>
                  {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
                <input className="input" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Ex: Compra de cabos de rede Cat6" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fornecedor *</label>
                  <input className="input" value={formSupplier} onChange={e => setFormSupplier(e.target.value)} placeholder="Nome do fornecedor" list="suppliers-list" />
                  <datalist id="suppliers-list">
                    {suppliers.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ Fornecedor</label>
                  <input className="input" value={formCnpj} onChange={e => setFormCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Itens (um por linha)</label>
                <textarea className="input" rows={3} value={formItems} onChange={e => setFormItems(e.target.value)} placeholder="10x Cabo Cat6 1m - R$ 5,00&#10;5x Switch 8P - R$ 150,00" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Total (R$)</label>
                  <input className="input" type="number" step="0.01" min="0" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                  <select className="input" value={formPayment} onChange={e => setFormPayment(e.target.value)}>
                    <option value="pix">PIX</option>
                    <option value="boleto">Boleto</option>
                    <option value="cartao_credito">Cartão Crédito</option>
                    <option value="transferencia">Transferência</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vencimento</label>
                  <input className="input" type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Previsão de Entrega</label>
                  <input className="input" type="date" value={formDeliveryDate} onChange={e => setFormDeliveryDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nº Nota Fiscal</label>
                <input className="input" value={formInvoice} onChange={e => setFormInvoice(e.target.value)} placeholder="Opcional" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                <textarea className="input" rows={2} value={formObs} onChange={e => setFormObs(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                {editingId ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
