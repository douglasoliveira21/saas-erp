import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Plus, Search, FileText, CheckCircle, XCircle, Copy, ShoppingCart, Trash2, Filter, Eye } from 'lucide-react'

interface QuoteItem {
  name: string
  description?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Quote {
  id: string
  number: number
  customer: { id: string; name: string; email?: string; phone?: string; cpfCnpj?: string }
  createdBy: { id: string; name: string }
  status: string
  validUntil: string
  items: QuoteItem[]
  subtotal: number
  discount: number
  totalAmount: number
  paymentConditions: string
  observations: string
  saleId: string
  approvedAt: string
  rejectedAt: string
  rejectionReason: string
  createdAt: string
}

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
}

const statusLabels: Record<string, string> = {
  pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado',
  expirado: 'Expirado', convertido: 'Convertido'
}
const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-green-100 text-green-700',
  rejeitado: 'bg-red-100 text-red-700',
  expirado: 'bg-gray-100 text-gray-700',
  convertido: 'bg-blue-100 text-blue-700',
}

export function Orcamentos() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null)
  const [rejectingId, setRejectingId] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [qRes, cRes] = await Promise.all([
        api.get('/quotes'),
        api.get('/customers'),
      ])
      setQuotes(qRes.data)
      setCustomers(cRes.data)
    } catch {
      setError('Erro ao carregar orçamentos')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('Aprovar este orçamento?')) return
    try {
      await api.patch(`/quotes/${id}/approve`)
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao aprovar') }
  }

  async function handleReject(id: string) {
    try {
      await api.patch(`/quotes/${id}/reject`, { reason: rejectReason })
      setRejectingId('')
      setRejectReason('')
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao rejeitar') }
  }

  async function handleDuplicate(id: string) {
    try {
      await api.post(`/quotes/${id}/duplicate`)
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao duplicar') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    try {
      await api.delete(`/quotes/${id}`)
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir') }
  }

  function openPdf(id: string) {
    const token = localStorage.getItem('@GestaoTI:token')
    window.open(`/api/quotes/${id}/pdf?token=${token}`, '_blank')
  }

  const filtered = quotes.filter(q => {
    const matchSearch = !search || q.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      q.observations?.toLowerCase().includes(search.toLowerCase()) ||
      String(q.number).includes(search)
    const matchStatus = !statusFilter || q.status === statusFilter
    return matchSearch && matchStatus
  })

  const pendentes = quotes.filter(q => q.status === 'pendente')
  const aprovados = quotes.filter(q => q.status === 'aprovado')
  const convertidos = quotes.filter(q => q.status === 'convertido')
  const totalPendente = pendentes.reduce((s, q) => s + Number(q.totalAmount), 0)
  const totalAprovado = aprovados.reduce((s, q) => s + Number(q.totalAmount), 0)
  const totalConvertido = convertidos.reduce((s, q) => s + Number(q.totalAmount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Orçamentos</h1>
        <button onClick={() => { setEditingQuote(null); setShowForm(true) }} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pendentes</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{pendentes.length}</p>
              <p className="text-xs text-gray-400">R$ {totalPendente.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aprovados</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{aprovados.length}</p>
              <p className="text-xs text-gray-400">R$ {totalAprovado.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Convertidos</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{convertidos.length}</p>
              <p className="text-xs text-gray-400">R$ {totalConvertido.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar por cliente, número ou observação..." value={search} onChange={e => setSearch(e.target.value)} />
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

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error} <button onClick={() => setError('')} className="ml-2 underline text-sm">fechar</button></div>}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Nenhum orçamento encontrado</p>
            <p className="text-sm mt-1">Crie orçamentos para enviar aos clientes.</p>
          </div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">#</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Cliente</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Itens</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Valor</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Validade</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map(q => {
                const isExpired = q.status === 'pendente' && new Date(q.validUntil) < new Date()
                return (
                  <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="table-cell font-mono text-sm font-medium text-primary-600">#{String(q.number).padStart(4, '0')}</td>
                    <td className="table-cell font-medium text-gray-900 dark:text-white">{q.customer?.name}</td>
                    <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{q.items?.length || 0} item(ns)</td>
                    <td className="table-cell font-semibold text-gray-900 dark:text-white">R$ {Number(q.totalAmount).toFixed(2)}</td>
                    <td className="table-cell text-sm">
                      <span className={isExpired ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                        {new Date(q.validUntil + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {isExpired && ' (expirado)'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[isExpired ? 'expirado' : q.status]}`}>
                        {isExpired ? 'Expirado' : statusLabels[q.status]}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openPdf(q.id)} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="Ver PDF"><Eye className="w-4 h-4" /></button>
                        {q.status === 'pendente' && !isExpired && (
                          <button onClick={() => handleApprove(q.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Aprovar"><CheckCircle className="w-4 h-4" /></button>
                        )}
                        {q.status === 'pendente' && (
                          <button onClick={() => setRejectingId(q.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Rejeitar"><XCircle className="w-4 h-4" /></button>
                        )}
                        {q.status === 'aprovado' && (
                          <button onClick={() => { setConvertingQuote(q); setShowConvertModal(true) }} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Converter em Venda"><ShoppingCart className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleDuplicate(q.id)} className="p-1 text-gray-600 hover:bg-gray-50 rounded" title="Duplicar"><Copy className="w-4 h-4" /></button>
                        {q.status === 'pendente' && (
                          <button onClick={() => { setEditingQuote(q); setShowForm(true) }} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded" title="Editar"><FileText className="w-4 h-4" /></button>
                        )}
                        {['pendente', 'rejeitado', 'expirado'].includes(q.status) && (
                          <button onClick={() => handleDelete(q.id)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rejeitar Orçamento</h2>
              <button onClick={() => setRejectingId('')}><XCircle className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo da rejeição (opcional)</label>
                <textarea className="input min-h-[80px]" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Informe o motivo..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setRejectingId('')} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => handleReject(rejectingId)} className="btn btn-danger">Confirmar Rejeição</button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Sale Modal */}
      {showConvertModal && convertingQuote && (
        <ConvertModal quote={convertingQuote} onClose={() => { setShowConvertModal(false); setConvertingQuote(null) }} onSuccess={() => { setShowConvertModal(false); setConvertingQuote(null); load() }} />
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <QuoteFormModal quote={editingQuote} customers={customers} onClose={() => { setShowForm(false); setEditingQuote(null) }} onSuccess={() => { setShowForm(false); setEditingQuote(null); load() }} />
      )}
    </div>
  )
}

function QuoteFormModal({ quote, customers, onClose, onSuccess }: { quote: Quote | null; customers: Customer[]; onClose: () => void; onSuccess: () => void }) {
  const [customerId, setCustomerId] = useState(quote?.customer?.id || '')
  const [validUntil, setValidUntil] = useState(() => {
    if (quote?.validUntil) return quote.validUntil
    const d = new Date(); d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [items, setItems] = useState<QuoteItem[]>(quote?.items || [{ name: '', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }])
  const [discount, setDiscount] = useState(quote?.discount || 0)
  const [paymentConditions, setPaymentConditions] = useState(quote?.paymentConditions || '')
  const [observations, setObservations] = useState(quote?.observations || '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const subtotal = items.reduce((s, i) => s + Number(i.totalPrice), 0)
  const totalAmount = subtotal - (subtotal * Number(discount) / 100)

  function updateItem(idx: number, field: string, value: any) {
    const updated = [...items]
    ;(updated[idx] as any)[field] = value
    if (field === 'quantity' || field === 'unitPrice') {
      updated[idx].totalPrice = Number(updated[idx].quantity) * Number(updated[idx].unitPrice)
    }
    setItems(updated)
  }

  function addItem() {
    setItems([...items, { name: '', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }])
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!customerId) { setFormError('Selecione um cliente'); return }
    if (!items.some(i => i.name && i.quantity > 0)) { setFormError('Adicione ao menos um item válido'); return }

    const validItems = items.filter(i => i.name && i.quantity > 0)
    const payload = {
      customerId,
      validUntil,
      items: validItems,
      subtotal,
      discount: Number(discount),
      totalAmount,
      paymentConditions: paymentConditions || null,
      observations: observations || null,
    }

    setSaving(true)
    try {
      if (quote) {
        await api.patch(`/quotes/${quote.id}`, payload)
      } else {
        await api.post('/quotes', payload)
      }
      onSuccess()
    } catch (e: any) {
      setFormError(e.response?.data?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{quote ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
              <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                <option value="">Selecione...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Válido até *</label>
              <input type="date" className="input" value={validUntil} onChange={e => setValidUntil(e.target.value)} required />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Itens do Orçamento *</label>
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                <Plus className="w-3 h-3" /> Adicionar Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <label className="block text-xs text-gray-500 mb-0.5">Nome</label>
                      <input className="input text-sm" placeholder="Nome do item" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-0.5">Qtd</label>
                      <input type="number" min="1" className="input text-sm" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-0.5">Valor Unit.</label>
                      <input type="number" step="0.01" min="0" className="input text-sm" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-0.5">Total</label>
                      <div className="input text-sm bg-gray-100 dark:bg-gray-600 cursor-not-allowed">R$ {Number(item.totalPrice).toFixed(2)}</div>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600" disabled={items.length <= 1}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <input className="input text-sm" placeholder="Descrição (opcional)" value={item.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desconto (%)</label>
              <input type="number" step="0.01" min="0" max="100" className="input" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subtotal</label>
              <div className="input bg-gray-100 dark:bg-gray-600 cursor-not-allowed font-medium">R$ {subtotal.toFixed(2)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Final</label>
              <div className="input bg-green-50 dark:bg-green-900/20 cursor-not-allowed font-bold text-green-700">R$ {totalAmount.toFixed(2)}</div>
            </div>
          </div>

          {/* Conditions & Observations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condições de Pagamento</label>
            <textarea className="input min-h-[60px]" value={paymentConditions} onChange={e => setPaymentConditions(e.target.value)} placeholder="Ex: 50% na aprovação, 50% na entrega..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
            <textarea className="input min-h-[60px]" value={observations} onChange={e => setObservations(e.target.value)} placeholder="Observações adicionais..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <FileText className="w-4 h-4" />}
              {saving ? 'Salvando...' : quote ? 'Salvar Alterações' : 'Criar Orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConvertModal({ quote, onClose, onSuccess }: { quote: Quote; onClose: () => void; onSuccess: () => void }) {
  const [paymentMethod, setPaymentMethod] = useState('boleto')
  const [installments, setInstallments] = useState(1)
  const [commissionPercentage, setCommissionPercentage] = useState(10)
  const [dueDay, setDueDay] = useState(10)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    setConverting(true)
    setConvertError('')
    try {
      await api.post(`/quotes/${quote.id}/convert`, {
        paymentMethod,
        installments,
        commissionPercentage,
        dueDay,
      })
      alert('Orçamento convertido em venda com sucesso!')
      onSuccess()
    } catch (e: any) {
      setConvertError(e.response?.data?.message || 'Erro ao converter')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Converter em Venda</h2>
            <p className="text-sm text-gray-500 mt-0.5">Orçamento #{String(quote.number).padStart(4, '0')} — R$ {Number(quote.totalAmount).toFixed(2)}</p>
          </div>
          <button onClick={onClose}><XCircle className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleConvert} className="p-6 space-y-4">
          {convertError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{convertError}</div>}

          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <p className="font-medium">Cliente: {quote.customer?.name}</p>
            <p className="mt-1">{quote.items?.length} item(ns) — Total: R$ {Number(quote.totalAmount).toFixed(2)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pagamento</label>
              <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="cartao_debito">Cartão Débito</option>
                <option value="transferencia">Transferência</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parcelas</label>
              <input type="number" min="1" max="24" className="input" value={installments} onChange={e => setInstallments(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comissão (%)</label>
              <input type="number" step="0.5" min="0" max="100" className="input" value={commissionPercentage} onChange={e => setCommissionPercentage(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dia Vencimento</label>
              <input type="number" min="1" max="31" className="input" value={dueDay} onChange={e => setDueDay(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={converting} className="btn btn-primary flex items-center gap-2">
              {converting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <ShoppingCart className="w-4 h-4" />}
              {converting ? 'Convertendo...' : 'Converter em Venda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
