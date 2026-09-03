import { useEffect, useMemo, useState } from 'react'
import { DragEvent } from 'react'
import { Plus, TrendingUp, Trash2, Search } from 'lucide-react'
import { api } from '../services/api'
import { Button, Modal, PageHeader, useFeedback } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'

interface Customer { id: string; name: string }

interface Opportunity {
  id: string
  customerId: string | null
  customer?: Customer
  title: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  stage: string
  value: number
  probability: number
  expectedCloseDate: string | null
  lostReason: string | null
  notes: string | null
  source: string | null
  tags: string[] | null
}

const stages: [string, string][] = [
  ['lead', 'Lead'],
  ['contato', 'Contato'],
  ['proposta', 'Proposta'],
  ['negociacao', 'Negociação'],
  ['ganho', 'Ganho'],
  ['perdido', 'Perdido'],
]

const sourceOptions: [string, string][] = [
  ['indicacao', 'Indicação'],
  ['site', 'Site'],
  ['redes_sociais', 'Redes sociais'],
  ['ligacao', 'Ligação'],
  ['evento', 'Evento'],
  ['parceiro', 'Parceiro'],
  ['outro', 'Outro'],
]

const emptyForm = {
  title: '', customerId: '', contactName: '', contactEmail: '', contactPhone: '',
  value: '', probability: '10', expectedCloseDate: '', notes: '', source: '', tags: '',
}
type FormState = typeof emptyForm

function money(value: any) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function toPayload(form: FormState) {
  return {
    title: form.title.trim(),
    customerId: form.customerId || null,
    contactName: form.contactName.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
    contactPhone: form.contactPhone.trim() || null,
    value: Number(form.value || 0),
    probability: Math.min(100, Math.max(0, Number(form.probability || 0))),
    expectedCloseDate: form.expectedCloseDate || null,
    notes: form.notes.trim() || null,
    source: form.source || null,
    tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
  }
}

function OpportunityFormFields({ form, onChange, customers }: { form: FormState; onChange: (form: FormState) => void; customers: Customer[] }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Título *</label>
        <input className="input" required value={form.title} onChange={e => onChange({ ...form, title: e.target.value })} placeholder="Ex: Contrato de suporte mensal" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
        <select className="input" value={form.customerId} onChange={e => onChange({ ...form, customerId: e.target.value })}>
          <option value="">Cliente ainda não cadastrado</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Contato</label>
          <input className="input" value={form.contactName} onChange={e => onChange({ ...form, contactName: e.target.value })} placeholder="Nome" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input className="input" type="email" value={form.contactEmail} onChange={e => onChange({ ...form, contactEmail: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Telefone</label>
          <input className="input" value={form.contactPhone} onChange={e => onChange({ ...form, contactPhone: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Valor (R$)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.value} onChange={e => onChange({ ...form, value: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Probabilidade (%)</label>
          <input className="input" type="number" min="0" max="100" value={form.probability} onChange={e => onChange({ ...form, probability: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Previsão de fechamento</label>
          <input className="input" type="date" value={form.expectedCloseDate} onChange={e => onChange({ ...form, expectedCloseDate: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Origem do lead</label>
          <select className="input" value={form.source} onChange={e => onChange({ ...form, source: e.target.value })}>
            <option value="">Não informada</option>
            {sourceOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
          <input className="input" value={form.tags} onChange={e => onChange({ ...form, tags: e.target.value })} placeholder="Separe por vírgula: urgente, upsell..." />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => onChange({ ...form, notes: e.target.value })} />
      </div>
    </div>
  )
}

export function Crm() {
  const { notify, confirm } = useFeedback()
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<Opportunity[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<Opportunity | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editStage, setEditStage] = useState('lead')
  const [editLostReason, setEditLostReason] = useState('')

  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [lostReasonTarget, setLostReasonTarget] = useState<{ id: string; stage: string } | null>(null)
  const [lostReasonText, setLostReasonText] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [a, c] = await Promise.all([api.get('/crm/opportunities'), api.get('/customers')])
      setItems(a.data)
      setCustomers(c.data)
    } catch {
      notify('Não foi possível carregar o CRM', 'error')
    } finally {
      setLoading(false)
    }
  }

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    items.forEach(item => (item.tags || []).forEach(tag => set.add(tag)))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [items])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter(item => {
      const matchesTerm = !term ||
        item.title.toLowerCase().includes(term) ||
        (item.customer?.name || '').toLowerCase().includes(term) ||
        (item.contactName || '').toLowerCase().includes(term)
      const matchesSource = !sourceFilter || item.source === sourceFilter
      const matchesTag = !tagFilter || (item.tags || []).includes(tagFilter)
      return matchesTerm && matchesSource && matchesTag
    })
  }, [items, search, sourceFilter, tagFilter])

  const hasActiveFilters = Boolean(search || sourceFilter || tagFilter)

  const stats = useMemo(() => {
    const open = items.filter(item => item.stage !== 'ganho' && item.stage !== 'perdido')
    const pipelineValue = open.reduce((sum, item) => sum + Number(item.value || 0), 0)
    const weightedValue = open.reduce((sum, item) => sum + Number(item.value || 0) * Number(item.probability || 0) / 100, 0)
    const wonValue = items.filter(item => item.stage === 'ganho').reduce((sum, item) => sum + Number(item.value || 0), 0)
    return { pipelineValue, weightedValue, wonValue, openCount: open.length }
  }, [items])

  async function submitCreate() {
    if (!createForm.title.trim()) { notify('Informe um título para a oportunidade', 'error'); return }
    setSaving(true)
    try {
      await api.post('/crm/opportunities', { ...toPayload(createForm), stage: 'lead' })
      setCreateOpen(false)
      setCreateForm(emptyForm)
      notify('Oportunidade criada', 'success')
      load()
    } catch (e: any) {
      notify(e.response?.data?.message || 'Erro ao salvar oportunidade', 'error')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(item: Opportunity) {
    setEditing(item)
    setEditForm({
      title: item.title,
      customerId: item.customerId || '',
      contactName: item.contactName || '',
      contactEmail: item.contactEmail || '',
      contactPhone: item.contactPhone || '',
      value: String(item.value ?? ''),
      probability: String(item.probability ?? '10'),
      expectedCloseDate: item.expectedCloseDate ? item.expectedCloseDate.substring(0, 10) : '',
      notes: item.notes || '',
      source: item.source || '',
      tags: (item.tags || []).join(', '),
    })
    setEditStage(item.stage)
    setEditLostReason(item.lostReason || '')
  }

  async function submitEdit() {
    if (!editing) return
    if (!editForm.title.trim()) { notify('Informe um título para a oportunidade', 'error'); return }
    if (editStage === 'perdido' && !editLostReason.trim()) { notify('Informe o motivo da perda', 'error'); return }
    setSaving(true)
    try {
      await api.patch(`/crm/opportunities/${editing.id}`, {
        ...toPayload(editForm),
        stage: editStage,
        ...(editStage === 'perdido' ? { lostReason: editLostReason.trim() } : {}),
      })
      setEditing(null)
      notify('Oportunidade atualizada', 'success')
      load()
    } catch (e: any) {
      notify(e.response?.data?.message || 'Erro ao atualizar oportunidade', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    const ok = await confirm({ title: 'Excluir oportunidade', message: `Remover "${editing.title}" definitivamente? Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    try {
      await api.delete(`/crm/opportunities/${editing.id}`)
      setEditing(null)
      notify('Oportunidade excluída', 'success')
      load()
    } catch (e: any) {
      notify(e.response?.data?.message || 'Erro ao excluir oportunidade', 'error')
    }
  }

  async function moveStage(id: string, stage: string, lostReason?: string) {
    try {
      await api.patch(`/crm/opportunities/${id}`, { stage, ...(lostReason ? { lostReason } : {}) })
      notify('Etapa atualizada', 'success')
      load()
    } catch (e: any) {
      notify(e.response?.data?.message || 'Erro ao mover oportunidade', 'error')
    }
  }

  function requestStageChange(item: Opportunity, stage: string) {
    if (stage === item.stage) return
    if (stage === 'perdido' && !item.lostReason) {
      setLostReasonTarget({ id: item.id, stage })
      setLostReasonText('')
      return
    }
    moveStage(item.id, stage)
  }

  async function confirmLostReason() {
    if (!lostReasonTarget || !lostReasonText.trim()) return
    await moveStage(lostReasonTarget.id, lostReasonTarget.stage, lostReasonText.trim())
    setLostReasonTarget(null)
  }

  function onCardDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onColumnDrop(e: DragEvent, stage: string) {
    e.preventDefault()
    setDragOverStage(null)
    const id = e.dataTransfer.getData('text/plain')
    const item = items.find(x => x.id === id)
    if (item) requestStageChange(item, stage)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="CRM de oportunidades"
        description="Funil comercial e previsão de fechamento"
        actions={<Button onClick={() => { setCreateForm(emptyForm); setCreateOpen(true) }}><Plus className="h-4 w-4" aria-hidden="true" />Nova oportunidade</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3"><p className="text-xs text-gray-500">Em aberto</p><p className="text-lg font-bold text-gray-900 dark:text-white">{stats.openCount}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Pipeline</p><p className="text-lg font-bold text-gray-900 dark:text-white">{money(stats.pipelineValue)}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Previsão ponderada</p><p className="text-lg font-bold text-gray-900 dark:text-white">{money(stats.weightedValue)}</p></div>
        <div className="card p-3"><p className="text-xs text-gray-500">Ganho</p><p className="text-lg font-bold text-green-600">{money(stats.wonValue)}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input className="input pl-9" placeholder="Buscar por título, cliente ou contato..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" aria-label="Filtrar por origem" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">Todas as origens</option>
          {sourceOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="input w-auto" aria-label="Filtrar por tag" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
          <option value="">Todas as tags</option>
          {availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        {hasActiveFilters && (
          <button type="button" className="text-sm font-medium text-primary-600 hover:underline" onClick={() => { setSearch(''); setSourceFilter(''); setTagFilter('') }}>
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
          {stages.map(([key, label]) => {
            const columnItems = filtered.filter(item => item.stage === key)
            const columnValue = columnItems.reduce((sum, item) => sum + Number(item.value || 0), 0)
            return (
              <section
                key={key}
                onDragOver={e => { e.preventDefault(); setDragOverStage(key) }}
                onDragLeave={() => setDragOverStage(current => current === key ? null : current)}
                onDrop={e => onColumnDrop(e, key)}
                className={`card flex min-h-64 flex-col p-3 transition-colors ${dragOverStage === key ? 'bg-primary-50 ring-2 ring-primary-400 dark:bg-primary-900/20' : ''}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-white">{label}</h2>
                  <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{columnItems.length}</span>
                </div>
                {columnItems.length > 0 && <p className="mb-2 text-xs font-medium text-gray-400">{money(columnValue)}</p>}
                <div className="flex-1 space-y-2">
                  {columnItems.length === 0 && (
                    <p className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400 dark:border-gray-700">Arraste um card para cá</p>
                  )}
                  {columnItems.map(item => (
                    <article
                      key={item.id}
                      draggable
                      onDragStart={e => onCardDragStart(e, item.id)}
                      onClick={() => openEdit(item)}
                      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.customer?.name || item.contactName || 'Sem cliente'}</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{money(item.value)}</p>
                      <p className="text-xs text-gray-500"><TrendingUp className="mr-1 inline h-3 w-3" aria-hidden="true" />{item.probability}%</p>
                      {(item.tags && item.tags.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{tag}</span>
                          ))}
                        </div>
                      )}
                      {item.source && (
                        <p className="mt-1 text-[11px] text-gray-400">{sourceOptions.find(([k]) => k === item.source)?.[1] || item.source}</p>
                      )}
                      <select
                        aria-label="Mover etapa"
                        value={item.stage}
                        onClick={e => e.stopPropagation()}
                        onChange={e => requestStageChange(item, e.target.value)}
                        className="input mt-2 text-xs"
                      >
                        {stages.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Nova oportunidade"
        onClose={() => setCreateOpen(false)}
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button onClick={submitCreate} loading={saving}>Salvar</Button>
        </>}
      >
        <OpportunityFormFields form={createForm} onChange={setCreateForm} customers={customers} />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Editar oportunidade"
        onClose={() => setEditing(null)}
        size="lg"
        footer={<>
          {isAdmin && <Button variant="danger" onClick={handleDelete}><Trash2 className="h-4 w-4" aria-hidden="true" />Excluir</Button>}
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
          <Button onClick={submitEdit} loading={saving}>Salvar</Button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Etapa</label>
            <select className="input" value={editStage} onChange={e => setEditStage(e.target.value)}>
              {stages.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          {editStage === 'perdido' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Motivo da perda *</label>
              <textarea className="input" rows={2} value={editLostReason} onChange={e => setEditLostReason(e.target.value)} placeholder="Por que essa oportunidade foi perdida?" />
            </div>
          )}
          <OpportunityFormFields form={editForm} onChange={setEditForm} customers={customers} />
        </div>
      </Modal>

      <Modal
        open={Boolean(lostReasonTarget)}
        title="Motivo da perda"
        description="Antes de mover para Perdido, registre o motivo."
        onClose={() => setLostReasonTarget(null)}
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setLostReasonTarget(null)}>Cancelar</Button>
          <Button variant="danger" disabled={!lostReasonText.trim()} onClick={confirmLostReason}>Confirmar perda</Button>
        </>}
      >
        <textarea className="input" rows={3} autoFocus value={lostReasonText} onChange={e => setLostReasonText(e.target.value)} placeholder="Ex: cliente optou pelo concorrente, orçamento cancelado..." />
      </Modal>
    </div>
  )
}
