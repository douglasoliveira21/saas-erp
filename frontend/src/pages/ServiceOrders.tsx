import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Settings, Wrench, User as UserIcon, Calendar } from 'lucide-react'
import { api } from '../services/api'
import { Button, Modal, PageHeader, useFeedback } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'

interface Status { id: string; key: string; label: string; color: string; sortOrder: number; isFinal: boolean; active: boolean }
interface Technician { id: string; name: string; active?: boolean }
interface Order {
  id: string
  number: number
  customer?: { id: string; name: string }
  technician?: { id: string; name: string }
  serviceType: string
  customerReport: string
  statusKey: string
  openedAt: string
  completedAt: string | null
  totalCost: number
}

function StatusBadge({ statusKey, statuses }: { statusKey: string; statuses: Status[] }) {
  const status = statuses.find(s => s.key === statusKey)
  const color = status?.color || '#6b7280'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {status?.label || statusKey}
    </span>
  )
}

export function ServiceOrders() {
  const navigate = useNavigate()
  const { notify, confirm } = useFeedback()
  const { isAdmin } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('')

  const [manageOpen, setManageOpen] = useState(false)
  const [statusForm, setStatusForm] = useState({ label: '', color: '#6b7280', isFinal: false })
  const [savingStatus, setSavingStatus] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter) params.status = statusFilter
      if (technicianFilter) params.technicianId = technicianFilter
      if (search) params.search = search
      const [o, s, t] = await Promise.all([
        api.get('/service-orders', { params }),
        api.get('/service-orders/statuses'),
        api.get('/users'),
      ])
      setOrders(o.data)
      setStatuses(s.data)
      setTechnicians(t.data.filter((u: any) => u.active))
    } catch {
      notify('Não foi possível carregar as ordens de serviço', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, technicianFilter])
  useEffect(() => {
    const timer = window.setTimeout(load, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const sortedStatuses = useMemo(() => [...statuses].sort((a, b) => a.sortOrder - b.sortOrder), [statuses])

  async function createStatus() {
    if (!statusForm.label.trim()) { notify('Informe o nome do status', 'error'); return }
    setSavingStatus(true)
    try {
      await api.post('/service-orders/statuses', statusForm)
      setStatusForm({ label: '', color: '#6b7280', isFinal: false })
      notify('Status criado', 'success')
      load()
    } catch (e: any) {
      notify(e.response?.data?.message || 'Erro ao criar status', 'error')
    } finally {
      setSavingStatus(false)
    }
  }

  async function toggleStatusActive(status: Status) {
    try {
      await api.patch(`/service-orders/statuses/${status.id}`, { active: !status.active })
      load()
    } catch (e: any) {
      notify(e.response?.data?.message || 'Erro ao atualizar status', 'error')
    }
  }

  async function deleteStatus(status: Status) {
    const ok = await confirm({ title: 'Remover status', message: `Remover "${status.label}"? Se já houver ordens usando este status, ele só será desativado.`, confirmLabel: 'Remover', danger: true })
    if (!ok) return
    try {
      await api.delete(`/service-orders/statuses/${status.id}`)
      notify('Status removido/desativado', 'success')
      load()
    } catch (e: any) {
      notify(e.response?.data?.message || 'Erro ao remover status', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ordens de Serviço"
        description="Abertura, acompanhamento e conclusão de serviços técnicos"
        actions={<>
          {isAdmin && <Button variant="secondary" onClick={() => setManageOpen(true)}><Settings className="h-4 w-4" aria-hidden="true" />Status</Button>}
          <Button onClick={() => navigate('/service-orders/new')}><Plus className="h-4 w-4" aria-hidden="true" />Nova OS</Button>
        </>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input className="input pl-9" placeholder="Buscar por número, cliente, tipo de serviço..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" aria-label="Filtrar por status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {sortedStatuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="input w-auto" aria-label="Filtrar por atendente" value={technicianFilter} onChange={e => setTechnicianFilter(e.target.value)}>
          <option value="">Todos os atendentes</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" /></div>
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">Nenhuma ordem de serviço encontrada.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map(order => (
            <button
              key={order.id}
              onClick={() => navigate(`/service-orders/${order.id}`)}
              className="card flex flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-gray-400">OS #{String(order.number).padStart(5, '0')}</span>
                <StatusBadge statusKey={order.statusKey} statuses={statuses} />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">{order.customer?.name || 'Cliente não informado'}</p>
              <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300"><Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{order.serviceType}</p>
              <p className="line-clamp-2 text-xs text-gray-500">{order.customerReport}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" aria-hidden="true" />{order.technician?.name || 'Sem atendente'}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{new Date(order.openedAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={manageOpen} title="Status de ordens de serviço" description="Adicione, edite ou desative etapas do fluxo." onClose={() => setManageOpen(false)} size="md" footer={<Button variant="secondary" onClick={() => setManageOpen(false)}>Fechar</Button>}>
        <div className="space-y-4">
          <div className="space-y-2">
            {sortedStatuses.map(status => (
              <div key={status.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                <input
                  type="color"
                  value={status.color}
                  onChange={e => { const color = e.target.value; setStatuses(current => current.map(s => s.id === status.id ? { ...s, color } : s)); api.patch(`/service-orders/statuses/${status.id}`, { color }).catch(() => {}) }}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border-0"
                  aria-label={`Cor do status ${status.label}`}
                />
                <input
                  className="input flex-1"
                  value={status.label}
                  onChange={e => setStatuses(current => current.map(s => s.id === status.id ? { ...s, label: e.target.value } : s))}
                  onBlur={e => api.patch(`/service-orders/statuses/${status.id}`, { label: e.target.value }).catch(() => notify('Erro ao renomear status', 'error'))}
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                  <input type="checkbox" checked={status.isFinal} onChange={e => { const isFinal = e.target.checked; setStatuses(current => current.map(s => s.id === status.id ? { ...s, isFinal } : s)); api.patch(`/service-orders/statuses/${status.id}`, { isFinal }).catch(() => {}) }} />
                  Final
                </label>
                <button type="button" className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${status.active ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600'}`} onClick={() => toggleStatusActive(status)}>
                  {status.active ? 'Ativo' : 'Inativo'}
                </button>
                <button type="button" className="shrink-0 text-xs font-medium text-red-500 hover:underline" onClick={() => deleteStatus(status)}>Remover</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
            <input type="color" value={statusForm.color} onChange={e => setStatusForm({ ...statusForm, color: e.target.value })} className="h-9 w-9 shrink-0 cursor-pointer rounded border-0" aria-label="Cor do novo status" />
            <input className="input flex-1" placeholder="Nome do novo status (ex: Aguardando peça)" value={statusForm.label} onChange={e => setStatusForm({ ...statusForm, label: e.target.value })} />
            <Button onClick={createStatus} loading={savingStatus}>Adicionar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
