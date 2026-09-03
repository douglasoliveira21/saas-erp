import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Download, Trash2, Upload, X, CheckCircle2, Ban, Save } from 'lucide-react'
import { api } from '../services/api'
import { Button, PageHeader, useFeedback } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { getErrorMessage } from '../services/errors'

interface Status { id: string; key: string; label: string; color: string; sortOrder: number; isFinal: boolean; active: boolean }
interface Technician { id: string; name: string; active?: boolean }
interface Attachment { id: string; type: string; filename: string; mimeType: string; createdAt: string }
interface Event { id: string; type: string; statusKey: string | null; description: string; createdAt: string }
interface Customer {
  id: string; name: string; cpfCnpj?: string; phone?: string; email?: string
  address?: string; city?: string; uf?: string; neighborhood?: string; cep?: string
}
interface Order {
  id: string
  number: number
  customerId: string
  customer?: Customer
  technicianId: string | null
  technician?: { id: string; name: string }
  serviceType: string
  equipment: string | null
  brand: string | null
  model: string | null
  serialNumber: string | null
  accessories: string | null
  customerReport: string
  diagnosis: string | null
  observations: string | null
  statusKey: string
  openedAt: string
  startedAt: string | null
  completedAt: string | null
  conclusionDescription: string | null
  partsCost: number
  laborCost: number
  totalCost: number
  attachments: Attachment[]
}

const attachmentGroups: [string, string, string][] = [
  ['foto_antes', 'Fotos - Antes', 'Registre o estado inicial do equipamento/local.'],
  ['foto_depois', 'Fotos - Depois', 'Registre o resultado final do serviço.'],
  ['documento', 'Documentos', 'Notas, laudos, comprovantes ou outros arquivos.'],
]

function money(value: any) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ServiceOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notify, confirm } = useFeedback()
  const { isAdmin } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    technicianId: '', serviceType: '',
    equipment: '', brand: '', model: '', serialNumber: '', accessories: '',
    customerReport: '', diagnosis: '', observations: '',
  })
  const [savingInfo, setSavingInfo] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const fileInputs = { foto_antes: useRef<HTMLInputElement>(null), foto_depois: useRef<HTMLInputElement>(null), documento: useRef<HTMLInputElement>(null) }

  const [concludeOpen, setConcludeOpen] = useState(false)
  const [conclusionDescription, setConclusionDescription] = useState('')
  const [partsCost, setPartsCost] = useState('0')
  const [laborCost, setLaborCost] = useState('0')
  const [concluding, setConcluding] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const [o, s, t, e] = await Promise.all([
        api.get(`/service-orders/${id}`),
        api.get('/service-orders/statuses', { params: { all: true } }),
        api.get('/users'),
        api.get(`/service-orders/${id}/events`),
      ])
      setOrder(o.data)
      setStatuses(s.data)
      setTechnicians(t.data.filter((u: any) => u.active))
      setEvents(e.data)
      setEditForm({
        technicianId: o.data.technicianId || '', serviceType: o.data.serviceType,
        equipment: o.data.equipment || '', brand: o.data.brand || '', model: o.data.model || '',
        serialNumber: o.data.serialNumber || '', accessories: o.data.accessories || '',
        customerReport: o.data.customerReport, diagnosis: o.data.diagnosis || '', observations: o.data.observations || '',
      })
      setConclusionDescription(o.data.conclusionDescription || '')
      setPartsCost(String(o.data.partsCost ?? 0))
      setLaborCost(String(o.data.laborCost ?? 0))
    } catch {
      notify('Não foi possível carregar a ordem de serviço', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading || !order) {
    return <div className="flex justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" /></div>
  }

  const currentStatus = statuses.find(s => s.key === order.statusKey)
  const isClosed = Boolean(currentStatus?.isFinal)
  const openStatusOptions = statuses.filter(s => !s.isFinal && s.active)

  async function saveInfo() {
    if (!order) return
    setSavingInfo(true)
    try {
      const res = await api.patch(`/service-orders/${order.id}`, {
        technicianId: editForm.technicianId || null,
        serviceType: editForm.serviceType,
        equipment: editForm.equipment,
        brand: editForm.brand,
        model: editForm.model,
        serialNumber: editForm.serialNumber,
        accessories: editForm.accessories,
        customerReport: editForm.customerReport,
        diagnosis: editForm.diagnosis,
        observations: editForm.observations,
      })
      setOrder(res.data)
      setEditing(false)
      notify('Ordem de serviço atualizada', 'success')
      load()
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao salvar alterações'), 'error')
    } finally {
      setSavingInfo(false)
    }
  }

  async function changeStatus(statusKey: string) {
    if (!order || statusKey === order.statusKey) return
    setChangingStatus(true)
    try {
      const res = await api.patch(`/service-orders/${order.id}`, { statusKey })
      setOrder(res.data)
      notify('Status atualizado', 'success')
      load()
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao atualizar status'), 'error')
    } finally {
      setChangingStatus(false)
    }
  }

  async function cancelOrder() {
    if (!order) return
    const ok = await confirm({ title: 'Cancelar ordem de serviço', message: 'Isso encerra a OS sem conclusão de serviço. Deseja continuar?', confirmLabel: 'Cancelar OS', danger: true })
    if (!ok) return
    try {
      await api.patch(`/service-orders/${order.id}`, { statusKey: 'cancelada' })
      notify('Ordem de serviço cancelada', 'success')
      load()
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao cancelar ordem de serviço'), 'error')
    }
  }

  async function submitConclusion() {
    if (!order) return
    if (!conclusionDescription.trim()) { notify('Descreva o que foi feito', 'error'); return }
    setConcluding(true)
    try {
      await api.patch(`/service-orders/${order.id}/conclude`, {
        conclusionDescription: conclusionDescription.trim(),
        partsCost: Number(partsCost || 0),
        laborCost: Number(laborCost || 0),
      })
      notify('Ordem de serviço concluída', 'success')
      setConcludeOpen(false)
      load()
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao concluir ordem de serviço'), 'error')
    } finally {
      setConcluding(false)
    }
  }

  async function uploadFiles(type: string, fileList: FileList | null) {
    if (!order || !fileList?.length) return
    setUploadingType(type)
    try {
      const formData = new FormData()
      Array.from(fileList).forEach(file => formData.append('files', file))
      formData.append('type', type)
      await api.post(`/service-orders/${order.id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      notify('Anexo(s) enviado(s)', 'success')
      load()
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao enviar anexo'), 'error')
    } finally {
      setUploadingType(null)
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!order) return
    const ok = await confirm({ title: 'Remover anexo', message: 'Este arquivo será removido definitivamente.', confirmLabel: 'Remover', danger: true })
    if (!ok) return
    try {
      await api.delete(`/service-orders/${order.id}/attachments/${attachmentId}`)
      notify('Anexo removido', 'success')
      load()
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao remover anexo'), 'error')
    }
  }

  async function deleteOrder() {
    if (!order) return
    const ok = await confirm({ title: 'Excluir ordem de serviço', message: `Excluir a OS #${order.number} e todos os seus anexos definitivamente?`, confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    try {
      await api.delete(`/service-orders/${order.id}`)
      notify('Ordem de serviço excluída', 'success')
      navigate('/service-orders')
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao excluir ordem de serviço'), 'error')
    }
  }

  function openPdf(download: boolean) {
    window.open(`/api/service-orders/${order!.id}/pdf${download ? '?download=1' : ''}`, '_blank')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={`Ordem de Serviço #${String(order.number).padStart(5, '0')}`}
        description={order.customer?.name}
        leading={<Button variant="ghost" size="icon" onClick={() => navigate('/service-orders')} aria-label="Voltar"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Button>}
        actions={<>
          <Button variant="secondary" onClick={() => openPdf(false)}><Printer className="h-4 w-4" aria-hidden="true" />Imprimir</Button>
          <Button variant="secondary" onClick={() => openPdf(true)}><Download className="h-4 w-4" aria-hidden="true" />Baixar PDF</Button>
          {isAdmin && <Button variant="danger" onClick={deleteOrder}><Trash2 className="h-4 w-4" aria-hidden="true" />Excluir</Button>}
        </>}
      />

      {/* Status */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Status atual</p>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: `${currentStatus?.color || '#6b7280'}1a`, color: currentStatus?.color || '#6b7280' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentStatus?.color || '#6b7280' }} />
              {currentStatus?.label || order.statusKey}
            </span>
          </div>
          {!isClosed && (
            <div className="flex flex-wrap items-center gap-2">
              <select className="input w-auto" value={order.statusKey} disabled={changingStatus} onChange={e => changeStatus(e.target.value)}>
                {openStatusOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <Button variant="secondary" onClick={cancelOrder}><Ban className="h-4 w-4" aria-hidden="true" />Cancelar OS</Button>
              <Button onClick={() => setConcludeOpen(true)}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Concluir OS</Button>
            </div>
          )}
        </div>
      </div>

      {/* Dados do cliente */}
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Cliente</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><span className="text-xs text-gray-500">Nome</span><p className="font-medium text-gray-900 dark:text-white">{order.customer?.name}</p></div>
          <div><span className="text-xs text-gray-500">Documento</span><p className="font-medium text-gray-900 dark:text-white">{order.customer?.cpfCnpj || '-'}</p></div>
          <div><span className="text-xs text-gray-500">Telefone</span><p className="font-medium text-gray-900 dark:text-white">{order.customer?.phone || '-'}</p></div>
          <div><span className="text-xs text-gray-500">Email</span><p className="font-medium text-gray-900 dark:text-white">{order.customer?.email || '-'}</p></div>
          <div><span className="text-xs text-gray-500">Cidade/UF</span><p className="font-medium text-gray-900 dark:text-white">{[order.customer?.city, order.customer?.uf].filter(Boolean).join('/') || '-'}</p></div>
          <div><span className="text-xs text-gray-500">CEP</span><p className="font-medium text-gray-900 dark:text-white">{order.customer?.cep || '-'}</p></div>
          {order.customer?.address && <div className="sm:col-span-2"><span className="text-xs text-gray-500">Endereço</span><p className="font-medium text-gray-900 dark:text-white">{order.customer.address}{order.customer.neighborhood ? ` - ${order.customer.neighborhood}` : ''}</p></div>}
        </div>
      </div>

      {/* Ordem de serviço */}
      <div className="card space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Ordem de serviço</h2>
          {!editing && !isClosed && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>}
        </div>
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Atendente responsável</label>
              <select className="input" value={editForm.technicianId} onChange={e => setEditForm({ ...editForm, technicianId: e.target.value })}>
                <option value="">A definir</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de serviço</label>
              <input className="input" value={editForm.serviceType} onChange={e => setEditForm({ ...editForm, serviceType: e.target.value })} />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-gray-700">Informações do produto</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Equipamento</label>
                <input className="input" value={editForm.equipment} onChange={e => setEditForm({ ...editForm, equipment: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Marca</label>
                <input className="input" value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Modelo</label>
                <input className="input" value={editForm.model} onChange={e => setEditForm({ ...editForm, model: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Número de série</label>
                <input className="input" value={editForm.serialNumber} onChange={e => setEditForm({ ...editForm, serialNumber: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Acessórios entregues</label>
              <input className="input" value={editForm.accessories} onChange={e => setEditForm({ ...editForm, accessories: e.target.value })} />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-gray-700">Relato, diagnóstico e observações</h3>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Relato do cliente</label>
              <textarea className="input" rows={3} value={editForm.customerReport} onChange={e => setEditForm({ ...editForm, customerReport: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Diagnóstico e serviço a ser prestado</label>
              <textarea className="input" rows={3} value={editForm.diagnosis} onChange={e => setEditForm({ ...editForm, diagnosis: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
              <textarea className="input" rows={2} value={editForm.observations} onChange={e => setEditForm({ ...editForm, observations: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button onClick={saveInfo} loading={savingInfo}><Save className="h-4 w-4" aria-hidden="true" />Salvar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><span className="text-xs text-gray-500">Atendente responsável</span><p className="font-medium text-gray-900 dark:text-white">{order.technician?.name || 'A definir'}</p></div>
              <div><span className="text-xs text-gray-500">Tipo de serviço</span><p className="font-medium text-gray-900 dark:text-white">{order.serviceType}</p></div>
            </div>

            {(order.equipment || order.brand || order.model || order.serialNumber || order.accessories) && (
              <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 dark:border-gray-700 sm:grid-cols-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 sm:col-span-2">Informações do produto</h3>
                {order.equipment && <div><span className="text-xs text-gray-500">Equipamento</span><p className="font-medium text-gray-900 dark:text-white">{order.equipment}</p></div>}
                {(order.brand || order.model) && <div><span className="text-xs text-gray-500">Marca/Modelo</span><p className="font-medium text-gray-900 dark:text-white">{[order.brand, order.model].filter(Boolean).join(' / ')}</p></div>}
                {order.serialNumber && <div><span className="text-xs text-gray-500">Número de série</span><p className="font-medium text-gray-900 dark:text-white">{order.serialNumber}</p></div>}
                {order.accessories && <div className="sm:col-span-2"><span className="text-xs text-gray-500">Acessórios entregues</span><p className="font-medium text-gray-900 dark:text-white">{order.accessories}</p></div>}
              </div>
            )}

            <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div><span className="text-xs text-gray-500">Relato do cliente</span><p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{order.customerReport}</p></div>
              {order.diagnosis && <div><span className="text-xs text-gray-500">Diagnóstico e serviço a ser prestado</span><p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{order.diagnosis}</p></div>}
              {order.observations && <div><span className="text-xs text-gray-500">Observações</span><p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{order.observations}</p></div>}
            </div>
          </div>
        )}
      </div>

      {/* Anexos */}
      {attachmentGroups.map(([type, title, hint]) => {
        const items = order.attachments.filter(a => a.type === type)
        // Fotos de "Depois" só liberam depois que a OS é concluída — evita registrar o "depois"
        // no meio do serviço, antes de realmente terminar.
        const locked = type === 'foto_depois' && !isClosed
        return (
          <div key={type} className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
                <p className="text-xs text-gray-500">{locked ? 'Disponível após concluir a OS (clique em "Concluir OS" acima).' : hint}</p>
              </div>
              <Button variant="secondary" size="sm" disabled={locked} loading={uploadingType === type} onClick={() => fileInputs[type as keyof typeof fileInputs].current?.click()}>
                <Upload className="h-4 w-4" aria-hidden="true" />Enviar
              </Button>
              <input ref={fileInputs[type as keyof typeof fileInputs]} type="file" multiple hidden disabled={locked} accept={type === 'documento' ? undefined : 'image/*'} onChange={e => { uploadFiles(type, e.target.files); e.target.value = '' }} />
            </div>
            {locked ? (
              <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-gray-700">Envie as fotos de "Depois" depois de concluir a ordem de serviço.</p>
            ) : items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-gray-700">Nenhum arquivo enviado</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {items.map(att => (
                  <div key={att.id} className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    {att.mimeType?.startsWith('image/') ? (
                      <a href={`/api/service-orders/${order.id}/attachments/${att.id}/inline`} target="_blank" rel="noreferrer">
                        <img src={`/api/service-orders/${order.id}/attachments/${att.id}/inline`} alt={att.filename} className="h-28 w-full object-cover" />
                      </a>
                    ) : (
                      <a href={`/api/service-orders/${order.id}/attachments/${att.id}/inline`} target="_blank" rel="noreferrer" className="flex h-28 flex-col items-center justify-center gap-1 bg-gray-50 p-2 text-center text-xs text-gray-500 dark:bg-gray-900">
                        <span className="line-clamp-2">{att.filename}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteAttachment(att.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="Remover anexo"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Conclusão */}
      {(order.conclusionDescription || isClosed) && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Conclusão</h2>
          {order.conclusionDescription ? (
            <>
              <div><span className="text-xs text-gray-500">O que foi feito</span><p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{order.conclusionDescription}</p></div>
              <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <div><span className="text-xs text-gray-500">Peças/materiais</span><p className="font-medium text-gray-900 dark:text-white">{money(order.partsCost)}</p></div>
                <div><span className="text-xs text-gray-500">Mão de obra</span><p className="font-medium text-gray-900 dark:text-white">{money(order.laborCost)}</p></div>
                <div><span className="text-xs text-gray-500">Total</span><p className="font-semibold text-primary-600">{money(order.totalCost)}</p></div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Ordem cancelada sem registro de conclusão.</p>
          )}
        </div>
      )}

      {/* Histórico */}
      <div className="card space-y-2 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Histórico</h2>
        <ul className="space-y-2 text-sm">
          {events.map(event => (
            <li key={event.id} className="flex justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-300">{event.description}</span>
              <span className="shrink-0 text-xs text-gray-400">{new Date(event.createdAt).toLocaleString('pt-BR')}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Modal de conclusão */}
      {concludeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Concluir ordem de serviço</h2>
              <button onClick={() => setConcludeOpen(false)} aria-label="Fechar"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">O que foi feito *</label>
              <textarea className="input" rows={4} value={conclusionDescription} onChange={e => setConclusionDescription(e.target.value)} placeholder="Descreva o serviço executado, peças trocadas, testes realizados..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Peças/materiais (R$)</label>
                <input className="input" type="number" min="0" step="0.01" value={partsCost} onChange={e => setPartsCost(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Mão de obra (R$)</label>
                <input className="input" type="number" min="0" step="0.01" value={laborCost} onChange={e => setLaborCost(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-gray-500">Total: <strong className="text-gray-900 dark:text-white">{money(Number(partsCost || 0) + Number(laborCost || 0))}</strong></p>
            <p className="text-xs text-gray-400">Após confirmar, a seção "Fotos - Depois" será liberada para você registrar o resultado final.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConcludeOpen(false)}>Cancelar</Button>
              <Button onClick={submitConclusion} loading={concluding}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Confirmar conclusão</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
