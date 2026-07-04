import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, CheckCircle, XCircle, DollarSign, Filter, X, Check, Trash2, Eye } from 'lucide-react'

interface Commission {
  id: string
  technician: { id: string; name: string }
  sale?: { id: string }
  type: 'venda' | 'avulsa' | 'fixa'
  description: string
  baseValue: number
  percentage: number
  amount: number
  status: 'pendente' | 'aprovada' | 'paga' | 'cancelada'
  observations: string
  isRecurring: boolean
  referenceMonth: string
  createdAt: string
}

interface User { id: string; name: string }

const statusLabels: Record<string, string> = { pendente: 'Pendente', aprovada: 'Aprovada', paga: 'Paga', cancelada: 'Cancelada' }
const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', aprovada: 'bg-blue-100 text-blue-700', paga: 'bg-green-100 text-green-700', cancelada: 'bg-red-100 text-red-700' }

export function Commissions() {
  const { isAdmin, isFinanceiro, isTecnico, user } = useAuth()
  const canManage = isAdmin || isFinanceiro
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [techFilter, setTechFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') })
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [commissionType, setCommissionType] = useState<'avulsa' | 'fixa'>('avulsa')
  const [form, setForm] = useState({ technicianId: '', description: '', baseValue: 0, percentage: 10, observations: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [loadingSale, setLoadingSale] = useState(false)

  useEffect(() => {
    load()
    if (canManage) api.get('/users').then(r => setTechnicians(r.data.filter((u: any) => u.active)))
  }, [])

  async function load() {
    try {
      const res = await api.get('/commissions')
      setCommissions(res.data)
    } catch { setError('Erro ao carregar comissões') }
    finally { setLoading(false) }
  }

  async function approve(id: string) {
    try { await api.patch(`/commissions/${id}/approve`); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao aprovar') }
  }

  async function viewSale(saleId: string) {
    setLoadingSale(true)
    try {
      const res = await api.get('/sales/' + saleId)
      setSelectedSale(res.data)
    } catch { setError('Erro ao carregar venda') }
    finally { setLoadingSale(false) }
  }

  async function pay(id: string) {
    try { await api.patch(`/commissions/${id}/pay`); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao pagar') }
  }

  async function cancel(id: string) {
    if (!confirm('Cancelar esta comissão?')) return
    try { await api.patch(`/commissions/${id}/cancel`); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar') }
  }

  async function payAll() {
    const pending = filtered.filter(c => c.status === 'pendente' || c.status === 'aprovada')
    if (pending.length === 0) { setError('Nenhuma comissão pendente para pagar'); return }
    const techName = techFilter ? technicians.find(t => t.id === techFilter)?.name : 'todos os técnicos'
    if (!confirm(`Pagar ${pending.length} comissão(ões) de ${techName}? Total: R$ ${pending.reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}`)) return
    try {
      for (const c of pending) {
        await api.patch(`/commissions/${c.id}/pay`)
      }
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao pagar em lote') }
  }

  async function cancelAll() {
    const payable = filtered.filter(c => c.status === 'pendente' || c.status === 'aprovada')
    if (payable.length === 0) { setError('Nenhuma comissão para cancelar'); return }
    const techName = techFilter ? technicians.find(t => t.id === techFilter)?.name : 'todos os técnicos'
    if (!confirm(`Cancelar ${payable.length} comissão(ões) de ${techName}?`)) return
    try {
      for (const c of payable) {
        await api.patch(`/commissions/${c.id}/cancel`)
      }
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar em lote') }
  }

  async function saveAvulsa() {
    if (!form.technicianId || !form.description) { setError('Tecnico e descricao obrigatorios'); return }
    setSaving(true)
    try {
      const amount = commissionType === 'fixa' ? form.baseValue : form.baseValue * form.percentage / 100
      await api.post('/commissions', {
        ...form,
        type: commissionType,
        amount,
        isRecurring: commissionType === 'fixa',
        referenceMonth: new Date().toISOString().slice(0, 7),
      })
      setShowModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao criar') }
    finally { setSaving(false) }
  }

  async function generateMonthly() {
    const month = new Date().toISOString().slice(0, 7)
    if (!confirm('Gerar comissoes fixas para ' + month + '?')) return
    try {
      const res = await api.post('/commissions/generate-monthly', { month })
      if (res.data.created === 0) { setError('Todas as comissoes fixas deste mes ja foram geradas'); return }
      alert(res.data.created + ' comissao(oes) gerada(s) - Total: R$ ' + Number(res.data.total).toFixed(2))
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao gerar') }
  }

  const monthOptions = Array.from({ length: 13 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const v = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); const l = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return { val: v, label: l.charAt(0).toUpperCase() + l.slice(1) } })

  const filtered = commissions.filter(c => {
    const matchSearch = c.technician?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || c.status === statusFilter
    const matchTech = !techFilter || c.technician?.id === techFilter
    const matchType = !typeFilter || c.type === typeFilter
    const matchUser = isTecnico ? c.technician?.id === user?.id : true
    const matchMonth = !monthFilter || (c.createdAt && c.createdAt.startsWith(monthFilter))
    return matchSearch && matchStatus && matchTech && matchType && matchUser && matchMonth
  })

  const totalPendente = filtered.filter(c => c.status === 'pendente').reduce((s, c) => s + Number(c.amount), 0)
  const totalAprovada = filtered.filter(c => c.status === 'aprovada').reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Comissoes</h1>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => { setForm({ technicianId: '', description: '', baseValue: 0, percentage: 10, observations: '' }); setCommissionType('avulsa'); setError(''); setShowModal(true) }} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nova Comissao
            </button>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-yellow-600" /></div>
          <div><p className="text-sm text-gray-500">Pendentes</p><p className="text-xl font-bold text-gray-900 dark:text-white">R$ {totalPendente.toFixed(2)}</p></div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-sm text-gray-500">Aprovadas</p><p className="text-xl font-bold text-gray-900 dark:text-white">R$ {totalAprovada.toFixed(2)}</p></div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <select className="input w-48" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
              <option value="">Todos os meses</option>
              {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
          {canManage && (
            <div>
              <select className="input w-48" value={techFilter} onChange={e => setTechFilter(e.target.value)}>
                <option value="">Todos os usuários</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <select className="input w-40" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Todos os tipos</option>
              <option value="venda">Venda</option>
              <option value="fixa">Fixa</option>
              <option value="avulsa">Avulsa</option>
            </select>
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar por tecnico ou descricao..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Ações em lote */}
        {canManage && filtered.some(c => c.status === 'pendente' || c.status === 'aprovada') && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
            <button onClick={payAll} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
              <DollarSign className="w-4 h-4" /> Pagar Todas ({filtered.filter(c => c.status === 'pendente' || c.status === 'aprovada').length})
            </button>
            <button onClick={cancelAll} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition-colors">
              <XCircle className="w-4 h-4" /> Cancelar Todas
            </button>
            <span className="text-sm text-gray-500 self-center ml-2">
              {techFilter ? `Filtrado: ${technicians.find(t => t.id === techFilter)?.name}` : 'Todos os técnicos'}
            </span>
          </div>
        )}
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
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Técnico</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Tipo</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Descrição</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Valor</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                {canManage && <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-gray-500">Nenhuma comissão encontrada</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="table-cell font-medium text-gray-900 dark:text-white">{c.technician?.name}</td>
                  <td className="table-cell"><span className={`px-2 py-1 rounded-full text-xs font-medium ${c.type === 'venda' ? 'bg-blue-100 text-blue-700' : c.type === 'fixa' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{c.type === 'venda' ? 'Venda' : c.type === 'fixa' ? 'Fixa' : 'Avulsa'}</span></td>
                  <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{c.description || `${c.percentage}% sobre R$ ${Number(c.baseValue).toFixed(2)}`}</td>
                  <td className="table-cell font-semibold text-gray-900 dark:text-white">R$ {Number(c.amount).toFixed(2)}</td>
                  <td className="table-cell"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[c.status]}`}>{statusLabels[c.status]}</span></td>
                  {canManage && (
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {c.sale && <button onClick={() => viewSale(c.sale!.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Ver venda"><Eye className="w-4 h-4" /></button>}
                        {c.status === 'pendente' && <button onClick={() => pay(c.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Confirmar pagamento"><DollarSign className="w-4 h-4" /></button>}
                        {!['paga', 'cancelada'].includes(c.status) && <button onClick={() => cancel(c.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar"><XCircle className="w-4 h-4" /></button>}
                        {isAdmin && c.status === 'cancelada' && (
                          <button onClick={async () => { if (!confirm('Excluir esta comissao do historico?')) return; try { await api.delete('/commissions/' + c.id); load() } catch {} }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalhes da venda */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalhes da Venda</h2>
              <button onClick={() => setSelectedSale(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{selectedSale.customer?.name}</span></div>
                <div><span className="text-gray-500">Tecnico:</span> <span className="font-medium">{selectedSale.technician?.name}</span></div>
                <div><span className="text-gray-500">Pagamento:</span> <span className="font-medium">{selectedSale.paymentMethod}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className="font-medium">{selectedSale.status}</span></div>
                <div><span className="text-gray-500">Total:</span> <span className="font-bold text-green-600">R$ {Number(selectedSale.totalAmount).toFixed(2)}</span></div>
                <div><span className="text-gray-500">Comissao:</span> <span className="font-medium">R$ {Number(selectedSale.commissionAmount).toFixed(2)}</span></div>
                <div><span className="text-gray-500">Data:</span> <span className="font-medium">{new Date(selectedSale.createdAt).toLocaleDateString('pt-BR')}</span></div>
                <div><span className="text-gray-500">Lucro:</span> <span className="font-medium">R$ {Number(selectedSale.netProfit).toFixed(2)}</span></div>
              </div>
              {selectedSale.items?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Itens da Venda</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-gray-500"><th className="text-left py-1">Item</th><th className="text-right py-1">Qtd</th><th className="text-right py-1">Unit.</th><th className="text-right py-1">Total</th></tr></thead>
                    <tbody>
                      {selectedSale.items.map((item: any) => (
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
              {selectedSale.observations && <p className="text-sm text-gray-500 italic">Obs: {selectedSale.observations}</p>}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setSelectedSale(null)} className="btn btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nova Comissao</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              {/* Tipo de comissao */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Comissao</label>
                <div className="flex gap-2">
                  <button onClick={() => setCommissionType('avulsa')} className={`px-4 py-2 rounded-lg text-sm font-medium ${commissionType === 'avulsa' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Avulsa</button>
                  <button onClick={() => setCommissionType('fixa')} className={`px-4 py-2 rounded-lg text-sm font-medium ${commissionType === 'fixa' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Fixa (Mensal)</button>
                </div>
                {commissionType === 'fixa' && (
                  <p className="text-xs text-orange-600 mt-2">A comissao fixa sera gerada automaticamente todo mes para o usuario selecionado.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Técnico *</label>
                <select className="input" value={form.technicianId} onChange={e => setForm({ ...form, technicianId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
                <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{commissionType === 'fixa' ? 'Valor Fixo Mensal (R$)' : 'Valor Base (R$)'}</label>
                  <input className="input" type="number" step="0.01" value={form.baseValue} onChange={e => setForm({ ...form, baseValue: parseFloat(e.target.value) || 0 })} />
                </div>
                {commissionType === 'avulsa' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Percentual (%)</label>
                    <input className="input" type="number" step="0.01" value={form.percentage} onChange={e => setForm({ ...form, percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                Valor da comissao: <strong>R$ {commissionType === 'fixa' ? form.baseValue.toFixed(2) : (form.baseValue * form.percentage / 100).toFixed(2)}</strong>
                {commissionType === 'fixa' && <span className="text-orange-600 ml-2">(recorrente todo mes)</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                <textarea className="input" rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={saveAvulsa} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                Criar Comissão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
