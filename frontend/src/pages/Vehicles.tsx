import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, X, Check, Car, Trash2, Edit, User, Bike, Truck } from 'lucide-react'

type VehicleType = 'carro' | 'moto' | 'caminhao' | 'van'

interface Vehicle {
  id: string
  plate: string
  brand: string
  model: string
  color: string
  year: number
  yearModel: number
  fuel: string
  vehicleType: VehicleType
  technicianId: string
  technician: { id: string; name: string } | null
  ratePerKm: number
  active: boolean
  observations: string
}

interface UserOption {
  id: string
  name: string
  role: string
}

export function Vehicles() {
  const { isAdmin } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchingPlate, setSearchingPlate] = useState(false)

  // Form fields
  const [plate, setPlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [year, setYear] = useState('')
  const [yearModel, setYearModel] = useState('')
  const [fuel, setFuel] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('carro')
  const [technicianId, setTechnicianId] = useState('')
  const [ratePerKm, setRatePerKm] = useState('1.30')
  const [observations, setObservations] = useState('')

  const vehicleTypeLabels: Record<VehicleType, string> = { carro: 'Carro', moto: 'Moto', caminhao: 'Caminhão', van: 'Van' }

  function getVehicleIcon(type: VehicleType) {
    switch (type) {
      case 'moto': return <Bike className="w-5 h-5 text-purple-600" />
      case 'caminhao': return <Truck className="w-5 h-5 text-orange-600" />
      case 'van': return <Truck className="w-5 h-5 text-teal-600" />
      default: return <Car className="w-5 h-5 text-blue-600" />
    }
  }

  function getVehicleIconBg(type: VehicleType) {
    switch (type) {
      case 'moto': return 'bg-purple-100'
      case 'caminhao': return 'bg-orange-100'
      case 'van': return 'bg-teal-100'
      default: return 'bg-blue-100'
    }
  }

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [v, u] = await Promise.all([
        api.get('/vehicles'),
        api.get('/users'),
      ])
      setVehicles(v.data)
      setUsers(u.data.filter((u: UserOption) => u.role === 'tecnico'))
    } catch {
      setError('Erro ao carregar veículos')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setPlate(''); setBrand(''); setModel(''); setColor('')
    setYear(''); setYearModel(''); setFuel(''); setVehicleType('carro')
    setTechnicianId(''); setRatePerKm('1.30'); setObservations('')
    setError('')
  }

  function openNew() {
    resetForm()
    setEditingVehicle(null)
    setShowModal(true)
  }

  function openEdit(v: Vehicle) {
    setEditingVehicle(v)
    setPlate(v.plate)
    setBrand(v.brand || '')
    setModel(v.model || '')
    setColor(v.color || '')
    setYear(v.year ? String(v.year) : '')
    setYearModel(v.yearModel ? String(v.yearModel) : '')
    setFuel(v.fuel || '')
    setVehicleType(v.vehicleType || 'carro')
    setTechnicianId(v.technicianId || '')
    setRatePerKm(String(v.ratePerKm))
    setObservations(v.observations || '')
    setError('')
    setShowModal(true)
  }

  async function searchPlate() {
    if (!plate.trim()) { setError('Digite a placa'); return }
    setSearchingPlate(true)
    setError('')
    try {
      const res = await api.get('/vehicles/search-plate?plate=' + plate.trim())
      const data = res.data
      if (data.found) {
        if (data.brand) setBrand(data.brand)
        if (data.model) setModel(data.model)
        if (data.color) setColor(data.color)
        if (data.year) setYear(String(data.year))
        if (data.yearModel) setYearModel(String(data.yearModel))
        if (data.fuel) setFuel(data.fuel)
      } else {
        setError(data.message || 'Placa não encontrada. Preencha os dados manualmente.')
      }
    } catch (e: any) {
      setError('Consulta indisponível. Preencha os dados manualmente.')
    } finally {
      setSearchingPlate(false)
    }
  }

  async function save() {
    if (!plate.trim()) { setError('Placa é obrigatória'); return }
    if (!ratePerKm || Number(ratePerKm) <= 0) { setError('Valor por KM deve ser maior que zero'); return }

    setSaving(true)
    setError('')
    try {
      const data = {
        plate: plate.trim(),
        brand: brand || null,
        model: model || null,
        color: color || null,
        year: year ? parseInt(year) : null,
        yearModel: yearModel ? parseInt(yearModel) : null,
        fuel: fuel || null,
        vehicleType,
        technicianId: technicianId || null,
        ratePerKm: Number(ratePerKm),
        observations: observations || null,
      }

      if (editingVehicle) {
        await api.patch('/vehicles/' + editingVehicle.id, data)
      } else {
        await api.post('/vehicles', data)
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remover este veículo?')) return
    try {
      await api.delete('/vehicles/' + id)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao remover')
    }
  }

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    (v.model || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.brand || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.technician?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Car className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2">Apenas administradores podem gerenciar veículos.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Veículos</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro de veículos e valor de reembolso por KM</p>
        </div>
        <button onClick={openNew} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Cadastrar Veículo
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por placa, modelo ou técnico..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {/* List */}
      {loading ? (
        <div className="card flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          <Car className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Nenhum veículo cadastrado
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(v => (
            <div key={v.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${getVehicleIconBg(v.vehicleType || 'carro')} rounded-lg flex items-center justify-center`}>
                    {getVehicleIcon(v.vehicleType || 'carro')}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-lg">{v.plate}</div>
                    <div className="text-sm text-gray-500">{[v.brand, v.model].filter(Boolean).join(' ') || 'Sem modelo'}</div>
                    {v.vehicleType && <div className="text-xs text-gray-400">{vehicleTypeLabels[v.vehicleType]}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(v)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(v.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                {v.color && <div className="text-gray-500">Cor: <span className="text-gray-700 dark:text-gray-300">{v.color}</span></div>}
                {v.year && <div className="text-gray-500">Ano: <span className="text-gray-700 dark:text-gray-300">{v.year}{v.yearModel && v.yearModel !== v.year ? '/' + v.yearModel : ''}</span></div>}
                {v.fuel && <div className="text-gray-500">Combustível: <span className="text-gray-700 dark:text-gray-300">{v.fuel}</span></div>}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{v.technician?.name || 'Sem técnico'}</span>
                </div>
                <div className="text-lg font-bold text-green-600">
                  R$ {Number(v.ratePerKm).toFixed(2)}/km
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingVehicle ? 'Editar Veículo' : 'Cadastrar Veículo'}
              </h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              {/* Placa + busca */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placa *</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1 uppercase"
                    placeholder="ABC1D23 ou ABC-1234"
                    value={plate}
                    onChange={e => setPlate(e.target.value.toUpperCase())}
                    maxLength={8}
                  />
                  <button
                    onClick={searchPlate}
                    disabled={searchingPlate}
                    className="btn btn-secondary flex items-center gap-1 whitespace-nowrap"
                  >
                    {searchingPlate ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" /> : <Search className="w-4 h-4" />}
                    Buscar
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Digite a placa e clique em Buscar para preencher automaticamente</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marca</label>
                  <input className="input" value={brand} onChange={e => setBrand(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo</label>
                  <input className="input" value={model} onChange={e => setModel(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cor</label>
                  <input className="input" value={color} onChange={e => setColor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Combustível</label>
                  <input className="input" value={fuel} onChange={e => setFuel(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ano</label>
                  <input className="input" type="number" value={year} onChange={e => setYear(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ano Modelo</label>
                  <input className="input" type="number" value={yearModel} onChange={e => setYearModel(e.target.value)} />
                </div>
              </div>

              {/* Tipo de veículo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo do Veículo *</label>
                <select className="input" value={vehicleType} onChange={e => setVehicleType(e.target.value as VehicleType)}>
                  <option value="carro">🚗 Carro</option>
                  <option value="moto">🏍️ Moto</option>
                  <option value="caminhao">🚛 Caminhão</option>
                  <option value="van">🚐 Van</option>
                </select>
              </div>

              {/* Técnico */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vincular ao Técnico</label>
                <select className="input" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
                  <option value="">Nenhum (frota geral)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {/* Valor por KM */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Reembolso por KM (R$) *</label>
                <input
                  className="input text-lg font-bold"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={ratePerKm}
                  onChange={e => setRatePerKm(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Este valor será usado para calcular o reembolso nas rotas deste veículo</p>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                <textarea className="input" rows={2} value={observations} onChange={e => setObservations(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                {editingVehicle ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
