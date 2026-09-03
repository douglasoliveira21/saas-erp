import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../services/api'
import { Button, PageHeader, useFeedback } from '../components/ui'
import { getErrorMessage } from '../services/errors'

interface Customer { id: string; name: string; cpfCnpj?: string; phone?: string; email?: string; address?: string; city?: string; uf?: string }
interface Technician { id: string; name: string; active?: boolean }

export function ServiceOrderForm() {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [customerId, setCustomerId] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [equipment, setEquipment] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [accessories, setAccessories] = useState('')
  const [customerReport, setCustomerReport] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [observations, setObservations] = useState('')
  const [beforePhotos, setBeforePhotos] = useState<FileList | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/customers'), api.get('/users')]).then(([c, u]) => {
      setCustomers(c.data)
      setTechnicians(u.data.filter((user: any) => user.active))
    }).catch(() => setError('Erro ao carregar clientes e técnicos'))
  }, [])

  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId])

  async function submit() {
    if (!customerId) { setError('Selecione o cliente'); return }
    if (!serviceType.trim()) { setError('Informe o tipo de serviço'); return }
    if (!customerReport.trim()) { setError('Registre o relato do cliente'); return }
    if (!beforePhotos?.length) { setError('Anexe ao menos uma foto do estado inicial (antes) do equipamento/local'); return }
    setError('')
    setSaving(true)
    try {
      const res = await api.post('/service-orders', {
        customerId, technicianId: technicianId || null, serviceType,
        equipment, brand, model, serialNumber, accessories,
        customerReport, diagnosis, observations,
      })
      try {
        const formData = new FormData()
        Array.from(beforePhotos).forEach(file => formData.append('files', file))
        formData.append('type', 'foto_antes')
        await api.post(`/service-orders/${res.data.id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      } catch (uploadError: unknown) {
        // A OS já foi criada — não desfazemos, só avisamos pra anexar a foto manualmente na tela da OS.
        notify(getErrorMessage(uploadError, 'OS criada, mas houve erro ao enviar a foto do antes. Anexe na tela da OS.'), 'error')
        navigate(`/service-orders/${res.data.id}`)
        return
      }
      notify('Ordem de serviço criada', 'success')
      navigate(`/service-orders/${res.data.id}`)
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Erro ao criar ordem de serviço'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Nova ordem de serviço"
        description="Informe o cliente e o serviço a ser realizado."
        leading={<Button variant="ghost" size="icon" onClick={() => navigate('/service-orders')} aria-label="Voltar"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Button>}
      />

      {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Cliente e atendente</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente *</label>
          <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Selecione o cliente...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedCustomer && (
          <div className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300 sm:grid-cols-2">
            <p><span className="text-gray-400">Documento:</span> {selectedCustomer.cpfCnpj || '-'}</p>
            <p><span className="text-gray-400">Telefone:</span> {selectedCustomer.phone || '-'}</p>
            <p><span className="text-gray-400">Email:</span> {selectedCustomer.email || '-'}</p>
            <p><span className="text-gray-400">Cidade/UF:</span> {[selectedCustomer.city, selectedCustomer.uf].filter(Boolean).join('/') || '-'}</p>
            {selectedCustomer.address && <p className="sm:col-span-2"><span className="text-gray-400">Endereço:</span> {selectedCustomer.address}</p>}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Atendente responsável</label>
          <select className="input" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
            <option value="">A definir depois</option>
            {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Informações do produto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Equipamento</label>
            <input className="input" value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Ex: Notebook, impressora, servidor..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Marca</label>
            <input className="input" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ex: Dell, HP, Epson..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Modelo</label>
            <input className="input" value={model} onChange={e => setModel(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Número de série</label>
            <input className="input" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Acessórios entregues</label>
          <input className="input" value={accessories} onChange={e => setAccessories(e.target.value)} placeholder="Ex: carregador, mouse, cabo de força..." />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Serviço</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de serviço *</label>
          <input className="input" list="service-type-suggestions" value={serviceType} onChange={e => setServiceType(e.target.value)} placeholder="Ex: Manutenção de computador, instalação de rede..." />
          <datalist id="service-type-suggestions">
            <option value="Manutenção de computador" />
            <option value="Formatação e instalação de sistema" />
            <option value="Instalação de rede" />
            <option value="Manutenção de impressora" />
            <option value="Configuração de servidor" />
            <option value="Backup e recuperação de dados" />
            <option value="Suporte técnico presencial" />
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Relato do cliente *</label>
          <textarea className="input" rows={4} value={customerReport} onChange={e => setCustomerReport(e.target.value)} placeholder="O que o cliente relatou/pediu ao trazer o equipamento..." />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Diagnóstico e serviço a ser prestado</label>
          <textarea className="input" rows={3} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Preencha se já souber o que precisa ser feito (pode deixar em branco e completar depois)" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
          <textarea className="input" rows={2} value={observations} onChange={e => setObservations(e.target.value)} />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Foto do antes *</h2>
        <p className="text-xs text-gray-500">Obrigatório: registre o estado inicial do equipamento/local antes de iniciar o serviço.</p>
        <input type="file" multiple accept="image/*" capture="environment" className="input" onChange={e => setBeforePhotos(e.target.files)} />
        {beforePhotos && beforePhotos.length > 0 && (
          <p className="text-xs text-gray-500">{beforePhotos.length} arquivo(s) selecionado(s)</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/service-orders')}>Cancelar</Button>
        <Button onClick={submit} loading={saving}>Criar ordem de serviço</Button>
      </div>
    </div>
  )
}
