import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Edit, Trash2, X, Check, FileText, Download, Clock, AlertTriangle, RefreshCw, Bell, Monitor, DollarSign } from 'lucide-react'

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
  // Novos campos
  adjustmentIndex: string
  adjustmentPercentage: number
  autoCharge: boolean
  chargeDay: number
  equipments: string
  renewalHistory: string
  lastRenewalDate: string
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
  const [form, setForm] = useState({ customerId: '', title: '', description: '', totalValue: '', monthlyValue: '', startDate: '', endDate: '', slaInternal: '4', slaExternal: '24', observations: '', adjustmentIndex: 'IGPM', adjustmentPercentage: '', autoCharge: false, chargeDay: '10', equipments: '' })
  const [file, setFile] = useState<File | null>(null)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewingContract, setRenewingContract] = useState<Contract | null>(null)
  const [renewMonths, setRenewMonths] = useState('12')
  const [renewAdjust, setRenewAdjust] = useState('')
  const [renewSaving, setRenewSaving] = useState(false)

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
    setForm({ customerId: '', title: '', description: '', totalValue: '', monthlyValue: '', startDate: new Date().toISOString().split('T')[0], endDate: '', slaInternal: '4', slaExternal: '24', observations: '', adjustmentIndex: 'IGPM', adjustmentPercentage: '', autoCharge: false, chargeDay: '10', equipments: '' })
    setError(''); setShowModal(true)
  }

  function openEdit(c: Contract) {
    setEditing(c); setFile(null)
    setForm({ customerId: c.customer?.id || '', title: c.title, description: c.description || '', totalValue: String(c.totalValue), monthlyValue: c.monthlyValue ? String(c.monthlyValue) : '', startDate: c.startDate, endDate: c.endDate || '', slaInternal: String(c.slaInternal), slaExternal: String(c.slaExternal), observations: c.observations || '', adjustmentIndex: c.adjustmentIndex || 'IGPM', adjustmentPercentage: c.adjustmentPercentage ? String(c.adjustmentPercentage) : '', autoCharge: c.autoCharge || false, chargeDay: c.chargeDay ? String(c.chargeDay) : '10', equipments: c.equipments || '' })
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
      fd.append('adjustmentIndex', form.adjustmentIndex)
      if (form.adjustmentPercentage) fd.append('adjustmentPercentage', form.adjustmentPercentage)
      fd.append('autoCharge', String(form.autoCharge))
      fd.append('chargeDay', form.chargeDay)
      if (form.equipments) fd.append('equipments', form.equipments)
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

  async function renewContract() {
    if (!renewingContract) return
    setRenewSaving(true)
    try {
      const currentEnd = renewingContract.endDate || renewingContract.startDate
      const newStart = currentEnd
      const endDate = new Date(currentEnd + 'T12:00:00')
      endDate.setMonth(endDate.getMonth() + parseInt(renewMonths))
      const newEnd = endDate.toISOString().split('T')[0]
      const adjustPct = renewAdjust ? parseFloat(renewAdjust) : (renewingContract.adjustmentPercentage || 0)
      const newMonthly = renewingContract.monthlyValue ? renewingContract.monthlyValue * (1 + adjustPct / 100) : null
      const newTotal = newMonthly ? newMonthly * parseInt(renewMonths) : renewingContract.totalValue * (1 + adjustPct / 100)

      const renewalEntry = `${new Date().toLocaleDateString('pt-BR')}: Renovado por ${renewMonths} meses${adjustPct > 0 ? ` com reajuste de ${adjustPct}%` : ''}`
      const history = renewingContract.renewalHistory ? renewingContract.renewalHistory + '\n' + renewalEntry : renewalEntry

      await api.patch('/contracts/' + renewingContract.id, {
        startDate: newStart,
        endDate: newEnd,
        totalValue: newTotal?.toFixed(2),
        monthlyValue: newMonthly?.toFixed(2) || renewingContract.monthlyValue,
        status: 'ativo',
        renewalHistory: history,
        lastRenewalDate: new Date().toISOString().split('T')[0],
      })
      setShowRenewModal(false); setRenewingContract(null); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao renovar') }
    finally { setRenewSaving(false) }
  }

  function openRenew(c: Contract) {
    setRenewingContract(c)
    setRenewMonths('12')
    setRenewAdjust(c.adjustmentPercentage ? String(c.adjustmentPercentage) : '')
    setError('')
    setShowRenewModal(true)
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

  // Alertas de contratos
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const alerts = contracts.filter(c => {
    if (c.status === 'cancelado') return false
    if (!c.endDate) return false
    const end = new Date(c.endDate + 'T12:00:00')
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 30 && diffDays >= 0
  }).map(c => {
    const end = new Date(c.endDate + 'T12:00:00')
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return { ...c, daysToExpire: diffDays }
  })

  const expiredContracts = contracts.filter(c => {
    if (c.status === 'cancelado') return false
    if (!c.endDate) return false
    const end = new Date(c.endDate + 'T12:00:00')
    return end < today && c.status === 'ativo'
  })

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

      {/* Alertas */}
      {(alerts.length > 0 || expiredContracts.length > 0) && (
        <div className="mb-6 space-y-3">
          {expiredContracts.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-red-800">Contratos Vencidos ({expiredContracts.length})</h3>
              </div>
              <div className="space-y-1">
                {expiredContracts.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-red-700"><strong>{c.customer?.name}</strong> — {c.title}</span>
                    <button onClick={() => openRenew(c)} className="text-xs text-red-600 font-medium hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Renovar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alerts.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800">Contratos Vencendo em Breve ({alerts.length})</h3>
              </div>
              <div className="space-y-1">
                {alerts.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-yellow-700"><strong>{c.customer?.name}</strong> — {c.title}</span>
                    <span className="text-xs text-yellow-600 font-medium">{c.daysToExpire} dias restantes</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                  {c.autoCharge && <span className="flex items-center gap-1 text-green-600"><DollarSign className="w-3 h-3" /> Cobrança Automática (dia {c.chargeDay})</span>}
                  {c.equipments && <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Equipamentos</span>}
                  {c.adjustmentIndex && c.adjustmentPercentage && <span>Reajuste: {c.adjustmentPercentage}% ({c.adjustmentIndex})</span>}
                </div>
                {c.fileName && (
                  <button onClick={() => downloadFile(c.id)} className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                    <Download className="w-3 h-3" /> {c.fileName} ({(c.fileSize / 1024).toFixed(0)} KB)
                  </button>
                )}
              </div>
              {canManage && (
                <div className="flex gap-1 flex-shrink-0">
                  {c.status === 'ativo' && <button onClick={() => openRenew(c)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Renovar"><RefreshCw className="w-4 h-4" /></button>}
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

              {/* Reajuste */}
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-3">Reajuste Anual</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Índice de Reajuste</label>
                    <select className="input" value={form.adjustmentIndex} onChange={e => setForm({ ...form, adjustmentIndex: e.target.value })}>
                      <option value="IGPM">IGP-M</option>
                      <option value="IPCA">IPCA</option>
                      <option value="INPC">INPC</option>
                      <option value="FIXO">Percentual Fixo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Percentual de Reajuste (%)</label>
                    <input className="input" type="number" step="0.01" min="0" value={form.adjustmentPercentage} onChange={e => setForm({ ...form, adjustmentPercentage: e.target.value })} placeholder="Ex: 5.5" />
                  </div>
                </div>
              </div>

              {/* Equipamentos */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-3">Equipamentos Vinculados</h3>
                <textarea className="input" rows={3} value={form.equipments} onChange={e => setForm({ ...form, equipments: e.target.value })} placeholder="Liste os equipamentos cobertos por este contrato (um por linha)&#10;Ex: Servidor Dell PowerEdge T340 - SN: ABC123&#10;Switch 24P TP-Link - SN: XYZ789" />
                <p className="text-xs text-gray-400 mt-1">Equipamentos que estão cobertos pelo contrato de suporte</p>
              </div>

              {/* Cobrança Automática */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3">Cobrança Automática</h3>
                <div className="flex items-center gap-3 mb-3">
                  <input type="checkbox" id="autoCharge" checked={form.autoCharge} onChange={e => setForm({ ...form, autoCharge: e.target.checked })} className="w-4 h-4 text-primary-600 rounded" />
                  <label htmlFor="autoCharge" className="text-sm text-gray-700 dark:text-gray-300">Ativar cobrança automática mensal</label>
                </div>
                {form.autoCharge && (
                  <div className="ml-7">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Dia da Cobrança</label>
                    <select className="input w-32" value={form.chargeDay} onChange={e => setForm({ ...form, chargeDay: e.target.value })}>
                      {[1,5,10,15,20,25,28].map(d => <option key={d} value={String(d)}>Dia {d}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">O sistema gerará a cobrança automaticamente neste dia de cada mês</p>
                  </div>
                )}
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

      {/* Modal Renovação */}
      {showRenewModal && renewingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Renovar Contrato</h2>
              <button onClick={() => setShowRenewModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <p className="text-sm text-gray-500">Contrato</p>
                <p className="font-semibold text-gray-900 dark:text-white">{renewingContract.title}</p>
                <p className="text-xs text-gray-500">{renewingContract.customer?.name}</p>
                <p className="text-sm mt-1">Valor atual: <strong>R$ {Number(renewingContract.monthlyValue || renewingContract.totalValue).toFixed(2)}{renewingContract.monthlyValue ? '/mês' : ' total'}</strong></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período de Renovação</label>
                <select className="input" value={renewMonths} onChange={e => setRenewMonths(e.target.value)}>
                  <option value="6">6 meses</option>
                  <option value="12">12 meses (1 ano)</option>
                  <option value="24">24 meses (2 anos)</option>
                  <option value="36">36 meses (3 anos)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reajuste (%)</label>
                <input className="input" type="number" step="0.01" min="0" value={renewAdjust} onChange={e => setRenewAdjust(e.target.value)} placeholder="0 = sem reajuste" />
                <p className="text-xs text-gray-400 mt-1">Índice: {renewingContract.adjustmentIndex || 'IGPM'}</p>
              </div>
              {renewAdjust && Number(renewAdjust) > 0 && (
                <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
                  Novo valor: <strong>R$ {(Number(renewingContract.monthlyValue || renewingContract.totalValue) * (1 + Number(renewAdjust) / 100)).toFixed(2)}{renewingContract.monthlyValue ? '/mês' : ' total'}</strong>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowRenewModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={renewContract} disabled={renewSaving} className="btn btn-primary flex items-center gap-2">
                {renewSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <RefreshCw className="w-4 h-4" />}
                Renovar Contrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
