import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../services/api'
import { Button, PageHeader, useFeedback } from '../components/ui'
import { getErrorMessage } from '../services/errors'

interface Customer { id: string; name: string }
interface Technician { id: string; name: string; active?: boolean }

export function ServiceOrderForm() {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [customerId, setCustomerId] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/customers'), api.get('/users')]).then(([c, u]) => {
      setCustomers(c.data)
      setTechnicians(u.data.filter((user: any) => user.active))
    }).catch(() => setError('Erro ao carregar clientes e técnicos'))
  }, [])

  async function submit() {
    if (!customerId) { setError('Selecione o cliente'); return }
    if (!serviceType.trim()) { setError('Informe o tipo de serviço'); return }
    if (!description.trim()) { setError('Descreva o serviço a ser realizado'); return }
    setError('')
    setSaving(true)
    try {
      const res = await api.post('/service-orders', { customerId, technicianId: technicianId || null, serviceType, description })
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente *</label>
          <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Selecione o cliente...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Atendente responsável</label>
          <select className="input" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
            <option value="">A definir depois</option>
            {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
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
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição do serviço *</label>
          <textarea className="input" rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o problema relatado ou o serviço solicitado pelo cliente..." />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/service-orders')}>Cancelar</Button>
        <Button onClick={submit} loading={saving}>Criar ordem de serviço</Button>
      </div>
    </div>
  )
}
