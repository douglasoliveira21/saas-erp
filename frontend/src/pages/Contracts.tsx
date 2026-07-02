import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Edit, Trash2, X, Check, FileText, Download, Clock, AlertTriangle } from 'lucide-react'

interface Contract {
  id: string
  customer: { id: string; name: string }
  title: string
  description: string
  totalValue: number
  monthlyValue: number
  startDate: string
  endDate: string
  slaInternal: number
  slaExternal: number
  fileName: string
  fileSize: number
  status: string
  observations: string
  createdAt: string
}
interface Customer { id: string; name: string }

const statusLabels: Record<string, string> = { ativo: 'Ativo', vencido: 'Vencido', cancelado: 'Cancelado' }
const statusColors: Record<string, string> = { ativo: 'bg-green-100 text-green-700', vencido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-700' }

export function Contracts() {
  const { isAdmin, isFinanceiro } = useAuth()
  const canManage = isAdmin || isFinanceiro
  const [contracts, setContracts] = useState<Contract[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ customerId: '', title: '', description: '', totalValue: '', monthlyValue: '', startDate: '', endDate: '', slaInternal: '4', slaExternal: '24', observations: '' })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [c, cust] = await Promise.all([api.get('/contracts'), api.get('/customers')])
      setContracts(c.data); setCustomers(cust.data)
    } catch { setError('Erro ao carregar contratos') }
    finally { setLoading(false) }
  }

  function openNew() {
    setEditing(null); setFile(null)
    setForm({ customerId: '', title: '', description: '', totalValue: '', monthlyValue: '', startDate: new Date().toISOString().split('T')[0], endDate: '', slaInternal: '4', slaExternal: '24', observations: '' })
    setError(''); setShowModal(true)
  }

  function openEdit(c: Contract) {
    setEditing(c); setFile(null)
    setForm({ customerId: c.customer?.id || '', title: c.title, description: c.description || '', totalValue: String(c.totalValue), monthlyValue: c.monthlyValue ? String(c.monthlyValue) : '', startDate: c.startDate, endDate: c.endDate || '', slaInternal: String(c.slaInternal), slaExternal: String(c.slaExternal), observations: c.observations || '' })
    setError(''); setShowModal(true)
  }

  async function save() {
    if (!form.customerId || !form.title || !form.totalValue || !form.startDate) { setError('Preencha cliente, titulo, valor e data de inicio'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('customerId', form.customerId)
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('totalValue', form.totalValue)
      if (form.monthlyValue) fd.append('monthlyValue', form.monthlyValue)
      fd.append('startDate', form.startDate)
      if (form.endDate) fd.append('endDate', form.endDate)
      fd.append('slaInternal', form.slaInternal)
      fd.append('slaExternal', form.slaExternal)
      if (form.observations) fd.append('observations', form.observations)
      if (file) fd.append('file', file)

      if (editing) {
        await api.patch('/contracts/' + editing.id, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        await api.post('/contracts', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      setShowModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remover este contrato?')) return
    try { await api.delete('/contracts/' + id); load() }
    catch { setError('Erro ao remover') }
  }

  function downloadFile(id: string) {
    window.open('/api/contracts/' + id + '/download', '_blank')
  }

  const filtered = contracts.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contratos</h1>
        {canManage && <button onClick={openNew} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Contrato</button>}
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por titulo ou cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          <div className="card flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="card text-center text-gray-500 py-8">Nenhum contrato encontrado</div>
        ) : filtered.map(c => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white">{c.title}</span>
                  <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[c.status] || '')}>{statusLabels[c.status]}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{c.customer?.name}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                  <span>Valor: <strong className="text-gray-900">R$ {Number(c.totalValue).toFixed(2)}</strong></span>
                  {c.monthlyValue && <span>Mensal: <strong>R$ {Number(c.monthlyValue).toFixed(2)}</strong></span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> SLA Interno: <strong>{c.slaInternal}h</strong></span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> SLA Externo: <strong>{c.slaExternal}h</strong></span>
                  <span>Inicio: {new Date(c.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  {c.endDate && <span>Fim: {new Date(c.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                </div>
                {c.fileName && (
                  <button onClick={() => downloadFile(c.id)} className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                    <Download className="w-3 h-3" /> {c.fileName} ({(c.fileSize / 1024).toFixed(0)} KB)
                  </button>
                )}
              </div>
              {canManage && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                  {isAdmin && <button onClick={() => remove(c.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Editar Contrato' : 'Novo Contrato'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
                <select className="input" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titulo do Contrato *</label>
                <input className="input" placeholder="Ex: Contrato de Suporte Mensal" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descricao</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Total (R$) *</label>
                  <input className="input" type="number" step="0.01" value={form.totalValue} onChange={e => setForm({ ...form, totalValue: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Mensal (R$)</label>
                  <input className="input" type="number" step="0.01" value={form.monthlyValue} onChange={e => setForm({ ...form, monthlyValue: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inicio *</label>
                  <input className="input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fim</label>
                  <input className="input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>

              {/* SLA */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3">SLA de Atendimento</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Atendimento Interno (horas)</label>
                    <input className="input" type="number" min="1" value={form.slaInternal} onChange={e => setForm({ ...form, slaInternal: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">Tempo maximo para atender no local da empresa</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Atendimento Externo (horas)</label>
                    <input className="input" type="number" min="1" value={form.slaExternal} onChange={e => setForm({ ...form, slaExternal: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">Tempo maximo para atender no local do cliente</p>
                  </div>
                </div>
              </div>

              {/* Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Arquivo do Contrato (PDF, DOC, etc.)</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" id="contract-file" />
                  <label htmlFor="contract-file" className="cursor-pointer">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    {file ? (
                      <p className="text-sm text-primary-600 font-medium">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
                    ) : editing?.fileName ? (
                      <p className="text-sm text-gray-500">Arquivo atual: {editing.fileName} — clique para substituir</p>
                    ) : (
                      <p className="text-sm text-gray-500">Clique para selecionar arquivo (max 20MB)</p>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observacoes</label>
                <textarea className="input" rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                {editing ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
