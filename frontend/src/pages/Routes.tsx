import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, CheckCircle, XCircle, DollarSign, MapPin, Filter, X, Check, Navigation, Trash2, ChevronDown, ChevronUp, Map, Edit, Calendar, Car } from 'lucide-react'

interface RouteLeg { id?: string; origin: string; destination: string; km: string | number }
interface VehicleOption { id: string; plate: string; brand: string; model: string; ratePerKm: number }
interface Route { id: string; technician: { id: string; name: string }; vehicle: VehicleOption | null; description: string; origin: string; destination: string; km: number; ratePerKm: number; totalValue: number; status: string; observations: string; routeDate: string; legs: RouteLeg[] }
const statusLabels: Record<string, string> = { pendente: 'Pendente', aprovado: 'Aprovado', pago: 'Pago', cancelado: 'Cancelado' }
const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', aprovado: 'bg-blue-100 text-blue-700', pago: 'bg-green-100 text-green-700', cancelado: 'bg-red-100 text-red-700' }
const emptyLeg = (): RouteLeg => ({ origin: '', destination: '', km: '' })

export function Routes() {
  const { isAdmin, isFinanceiro, isTecnico, user } = useAuth()
  const canManage = isAdmin || isFinanceiro
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([])
  const [monthFilter, setMonthFilter] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') })
  const [showModal, setShowModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0])
  const [ratePerKm, setRatePerKm] = useState('1.30')
  const [vehicleId, setVehicleId] = useState('')
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [observations, setObservations] = useState('')
  const [legs, setLegs] = useState<RouteLeg[]>([emptyLeg()])
  const [includeReturn, setIncludeReturn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editRouteDate, setEditRouteDate] = useState('')
  const [editObservations, setEditObservations] = useState('')
  const [editLegs, setEditLegs] = useState<RouteLeg[]>([emptyLeg()])
  const [editIncludeReturn, setEditIncludeReturn] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [r, v, u] = await Promise.all([
        api.get('/routes'),
        api.get('/vehicles/by-technician/' + (user?.id || '')).catch(() => ({ data: [] })),
        canManage ? api.get('/users').then(res => ({ data: res.data.filter((u: any) => u.active) })) : Promise.resolve({ data: [] }),
      ])
      setRoutes(r.data)
      setVehicles(v.data)
      setAllUsers(u.data)
      // Se tem apenas 1 veículo, pré-selecionar e setar o rate
      if (v.data.length === 1) {
        setVehicleId(v.data[0].id)
        setRatePerKm(String(v.data[0].ratePerKm))
      }
    }
    catch { setError('Erro ao carregar rotas') } finally { setLoading(false) }
  }

  function openNew() {
    setDescription(''); setRouteDate(new Date().toISOString().split('T')[0]); setObservations(''); setLegs([emptyLeg()]); setIncludeReturn(false); setError('')
    if (vehicles.length === 1) { setVehicleId(vehicles[0].id); setRatePerKm(String(vehicles[0].ratePerKm)) }
    else if (vehicles.length > 1) { setVehicleId(''); setRatePerKm('1.30') }
    else { setVehicleId(''); setRatePerKm('1.30') }
    setShowModal(true)
  }

  function onVehicleChange(id: string) {
    setVehicleId(id)
    const v = vehicles.find(v => v.id === id)
    if (v) setRatePerKm(String(v.ratePerKm))
  }
  function addLeg() { setLegs(p => [...p, emptyLeg()]) }
  function removeLeg(i: number) { if (legs.length > 1) setLegs(p => p.filter((_, idx) => idx !== i)) }
  function updateLeg(i: number, field: keyof RouteLeg, value: string) { setLegs(p => p.map((l, idx) => idx === i ? { ...l, [field]: value } : l)) }
  function openMap(o: string, d: string) { window.open('https://www.google.com/maps/dir/' + encodeURIComponent(o) + '/' + encodeURIComponent(d), '_blank') }

  function openEdit(r: Route) {
    setEditingRoute(r); setEditDescription(r.description); setEditRouteDate(r.routeDate); setEditObservations(r.observations || '')
    setEditLegs(r.legs?.length > 0 ? r.legs.map(l => ({ origin: l.origin, destination: l.destination, km: l.km })) : [emptyLeg()])
    setEditIncludeReturn(false); setError(''); setShowEdit(true)
  }

  async function saveEdit() {
    if (!editDescription.trim()) { setError('Descricao obrigatoria'); return }
    for (let i = 0; i < editLegs.length; i++) { if (!editLegs[i].origin.trim() || !editLegs[i].destination.trim()) { setError('Trecho ' + (i+1) + ': preencha origem e destino'); return } if (!editLegs[i].km || Number(editLegs[i].km) <= 0) { setError('Trecho ' + (i+1) + ': KM > 0'); return } }
    const el = editLegs[editLegs.length - 1]
    const ret = editIncludeReturn && el.destination && editLegs[0].origin ? { origin: el.destination, destination: editLegs[0].origin, km: el.km } : null
    const final = ret ? [...editLegs, ret] : editLegs
    setEditSaving(true)
    try { await api.patch('/routes/' + editingRoute!.id, { description: editDescription, routeDate: editRouteDate, observations: editObservations, legs: final.map(l => ({ origin: l.origin, destination: l.destination, km: Number(l.km) })) }); setShowEdit(false); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') } finally { setEditSaving(false) }
  }

  const lastLeg = legs[legs.length - 1]
  const returnLeg: RouteLeg | null = includeReturn && lastLeg.destination && legs[0].origin ? { origin: lastLeg.destination, destination: legs[0].origin, km: lastLeg.km } : null
  const effectiveLegs = returnLeg ? [...legs, returnLeg] : legs
  const effectiveTotalKm = effectiveLegs.reduce((s, l) => s + (Number(l.km) || 0), 0)
  const effectiveTotalValue = effectiveTotalKm * Number(ratePerKm || 1.30)

  async function save() {
    if (!description.trim()) { setError('Descricao obrigatoria'); return }
    if (!vehicleId && vehicles.length > 0) { setError('Selecione um veículo'); return }
    for (let i = 0; i < legs.length; i++) { if (!legs[i].origin.trim() || !legs[i].destination.trim()) { setError('Trecho ' + (i+1) + ': preencha'); return } if (!legs[i].km || Number(legs[i].km) <= 0) { setError('Trecho ' + (i+1) + ': KM > 0'); return } }
    setSaving(true)
    try { await api.post('/routes', { description, routeDate, ratePerKm: Number(ratePerKm), vehicleId: vehicleId || undefined, observations, legs: effectiveLegs.map(l => ({ origin: l.origin, destination: l.destination, km: Number(l.km) })) }); setShowModal(false); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro') } finally { setSaving(false) }
  }

  async function pay(id: string) { try { await api.patch('/routes/' + id + '/pay'); load() } catch (e: any) { setError(e.response?.data?.message || 'Erro') } }
  async function cancel(id: string) { if (!confirm('Cancelar?')) return; try { await api.patch('/routes/' + id + '/cancel'); load() } catch (e: any) { setError(e.response?.data?.message || 'Erro') } }
  async function remove(id: string) { if (!confirm('Remover?')) return; try { await api.delete('/routes/' + id); load() } catch (e: any) { setError(e.response?.data?.message || 'Erro') } }

  async function payMonth() {
    const [y, m] = monthFilter.split('-')
    if (!confirm('Pagar todas aprovadas do mes?')) return
    try { const r = await api.patch('/routes/pay-month?year=' + y + '&month=' + m); if (r.data.count === 0) { setError('Nenhuma aprovada neste mes'); return } alert(r.data.count + ' rota(s) pagas - R$ ' + Number(r.data.total).toFixed(2)); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  const filtered = routes.filter(r => {
    const ms = r.description.toLowerCase().includes(search.toLowerCase()) || (r.technician?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchMonth = !monthFilter || (r.routeDate && r.routeDate.startsWith(monthFilter))
    const matchUserFilter = !userFilter || r.technician?.id === userFilter
    return ms && (!statusFilter || r.status === statusFilter) && (isTecnico ? r.technician?.id === user?.id : true) && matchMonth && matchUserFilter
  })

  const monthStats = { pendente: filtered.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.totalValue), 0), aprovado: filtered.filter(r => r.status === 'aprovado').reduce((s, r) => s + Number(r.totalValue), 0), pago: filtered.filter(r => r.status === 'pago').reduce((s, r) => s + Number(r.totalValue), 0), totalKm: filtered.reduce((s, r) => s + Number(r.km), 0) }

  const monthOptions = Array.from({ length: 13 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const v = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); const l = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return { val: v, label: l.charAt(0).toUpperCase() + l.slice(1) } })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Rotas Externas</h1>
          <p className="text-sm text-gray-500 mt-1">Controle de rotas externas e deslocamentos</p>
        </div>
        {isTecnico && <button onClick={openNew} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Registrar Rota</button>}
      </div>

      {/* Filtro por mes */}
      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1"><Calendar className="w-3 h-3 inline mr-1" />Periodo</label>
            <select className="input w-52" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
              <option value="">Todos os meses</option>
              {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {canManage && (
            <div>
              <select className="input w-48" value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                <option value="">Todos os usuários</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Resumo do mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><Navigation className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">KM no mes</p><p className="text-lg font-bold">{monthStats.totalKm.toFixed(1)} km</p></div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-yellow-600" /></div>
          <div><p className="text-xs text-gray-500">Pendente</p><p className="text-lg font-bold text-yellow-600">R$ {monthStats.pendente.toFixed(2)}</p></div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Aprovado</p><p className="text-lg font-bold text-blue-600">R$ {monthStats.aprovado.toFixed(2)}</p></div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Pago</p><p className="text-lg font-bold text-green-600">R$ {monthStats.pago.toFixed(2)}</p></div>
        </div>
      </div>

      {/* Acoes em lote */}
      {canManage && (monthStats.pendente > 0) && (
        <div className="flex gap-3 mb-4">
          {monthStats.pendente > 0 && (
            <button onClick={payMonth} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <DollarSign className="w-4 h-4" /> Pagar todas do mes (R$ {monthStats.pendente.toFixed(2)})
            </button>
          )}
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="card flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="card text-center text-gray-500 py-8">Nenhuma rota encontrada neste periodo</div>
        ) : filtered.map(r => (
          <div key={r.id} className="card p-0 overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white">{r.description}</span>
                  <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[r.status] || '')}>{statusLabels[r.status]}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                  {!isTecnico && <span>{'👤 ' + (r.technician?.name || '')}</span>}
                  {r.vehicle && <span>{'🚗 ' + r.vehicle.plate}</span>}
                  <span>{'📅 ' + new Date(r.routeDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  <span>{'📍 ' + r.origin + ' → ' + r.destination}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-green-600">R$ {Number(r.totalValue).toFixed(2)}</div>
                <div className="text-xs text-gray-500">{Number(r.km).toFixed(1)} km</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {canManage && r.status === 'pendente' && <button onClick={() => pay(r.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Confirmar pagamento"><DollarSign className="w-4 h-4" /></button>}
                {canManage && !['pago','cancelado'].includes(r.status) && <button onClick={() => cancel(r.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Cancelar"><XCircle className="w-4 h-4" /></button>}
                {isTecnico && r.status === 'pendente' && r.technician?.id === user?.id && <button onClick={() => openEdit(r)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded" title="Editar"><Edit className="w-4 h-4" /></button>}
                {isTecnico && r.status === 'pendente' && <button onClick={() => remove(r.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Remover"><Trash2 className="w-4 h-4" /></button>}
                {isAdmin && r.status === 'cancelado' && <button onClick={() => remove(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir do historico"><Trash2 className="w-4 h-4" /></button>}
                {r.legs?.length > 0 && <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">{expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>}
              </div>
            </div>
            {expandedId === r.id && r.legs?.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Trechos</p>
                <div className="space-y-2">
                  {r.legs.map((leg, i) => (
                    <div key={leg.id || i} className="flex items-center gap-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 truncate">{leg.origin}</span>
                      <span className="text-gray-400">{'→'}</span>
                      <span className="text-gray-700 dark:text-gray-300 truncate">{leg.destination}</span>
                      <span className="font-medium flex-shrink-0 ml-auto">{Number(leg.km).toFixed(1)} km</span>
                      <span className="text-gray-500 flex-shrink-0">R$ {(Number(leg.km) * Number(r.ratePerKm)).toFixed(2)}</span>
                      <button onClick={() => openMap(leg.origin, leg.destination)} className="p-1 text-gray-400 hover:text-primary-600 flex-shrink-0" title="Ver no Maps"><Map className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
                {r.observations && <p className="mt-2 text-xs text-gray-500 italic">Obs: {r.observations}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal editar */}
      {showEdit && editingRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Editar Rota</h2>
              <button onClick={() => setShowEdit(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descricao *</label><input className="input" value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label><input className="input" type="date" value={editRouteDate} onChange={e => setEditRouteDate(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor/KM</label><div className="input bg-gray-100 text-gray-500 cursor-not-allowed">R$ {Number(editingRoute.ratePerKm).toFixed(2)}</div></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trechos ({editLegs.length})</span>
                  <button onClick={() => setEditLegs(p => [...p, emptyLeg()])} className="text-sm text-primary-600 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Trecho</button>
                </div>
                <div className="space-y-3">
                  {editLegs.map((leg, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">Trecho {i+1}</span>
                        <div className="flex gap-2">
                          {leg.origin && leg.destination && <button onClick={() => openMap(leg.origin, leg.destination)} className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"><Map className="w-3 h-3" /> Mapa</button>}
                          {editLegs.length > 1 && <button onClick={() => setEditLegs(p => p.filter((_,idx) => idx !== i))} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="block text-xs text-gray-500 mb-1">Origem</label><input className="input text-sm py-1.5" value={leg.origin} onChange={e => setEditLegs(p => p.map((l,idx) => idx===i ? {...l, origin: e.target.value} : l))} /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Destino</label><input className="input text-sm py-1.5" value={leg.destination} onChange={e => setEditLegs(p => p.map((l,idx) => idx===i ? {...l, destination: e.target.value} : l))} /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">KM</label><input className="input text-sm py-1.5" type="number" step="0.1" value={leg.km} onChange={e => setEditLegs(p => p.map((l,idx) => idx===i ? {...l, km: e.target.value} : l))} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-dashed border-gray-300 rounded-lg p-3">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setEditIncludeReturn(!editIncludeReturn)}>
                  <div className={'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ' + (editIncludeReturn ? 'bg-primary-600' : 'bg-gray-300')}><div className={'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ' + (editIncludeReturn ? 'translate-x-5' : 'translate-x-0.5')} /></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Incluir retorno</span>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observacoes</label><textarea className="input" rows={2} value={editObservations} onChange={e => setEditObservations(e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowEdit(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={saveEdit} disabled={editSaving} className="btn btn-primary flex items-center gap-2">{editSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />} Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar Rota Externa</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descricao *</label><input className="input" placeholder="Ex: Visita tecnica cliente" value={description} onChange={e => setDescription(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data *</label><input className="input" type="date" value={routeDate} onChange={e => setRouteDate(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Veículo *</label>
                  {vehicles.length > 0 ? (
                    <select className="input" value={vehicleId} onChange={e => onVehicleChange(e.target.value)}>
                      <option value="">Selecione o veículo</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model} (R$ {Number(v.ratePerKm).toFixed(2)}/km)</option>)}
                    </select>
                  ) : (
                    <div className="input bg-gray-100 text-gray-500 text-sm">Nenhum veículo vinculado. Contate o admin.</div>
                  )}
                </div>
                {vehicleId && <div className="col-span-2 p-2 bg-green-50 rounded-lg flex items-center gap-2"><Car className="w-4 h-4 text-green-600" /><span className="text-sm text-green-700">Valor de reembolso: <strong>R$ {Number(ratePerKm).toFixed(2)}/km</strong> (definido pelo veículo)</span></div>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trechos ({legs.length})</span>
                  <button onClick={addLeg} className="text-sm text-primary-600 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Trecho</button>
                </div>
                <div className="space-y-3">
                  {legs.map((leg, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">Trecho {i+1}</span>
                        <div className="flex gap-2">
                          {leg.origin && leg.destination && <button onClick={() => openMap(leg.origin, leg.destination)} className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"><Map className="w-3 h-3" /> Mapa</button>}
                          {legs.length > 1 && <button onClick={() => removeLeg(i)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="block text-xs text-gray-500 mb-1">Origem *</label><input className="input text-sm py-1.5" placeholder="Endereco origem" value={leg.origin} onChange={e => updateLeg(i, 'origin', e.target.value)} /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">Destino *</label><input className="input text-sm py-1.5" placeholder="Endereco destino" value={leg.destination} onChange={e => updateLeg(i, 'destination', e.target.value)} /></div>
                        <div><label className="block text-xs text-gray-500 mb-1">KM *</label><input className="input text-sm py-1.5" type="number" step="0.1" min="0.1" placeholder="0.0" value={leg.km} onChange={e => updateLeg(i, 'km', e.target.value)} /></div>
                      </div>
                      {Number(leg.km) > 0 && <div className="mt-1 text-xs text-right text-green-600 font-medium">= R$ {(Number(leg.km) * Number(ratePerKm)).toFixed(2)}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-dashed border-gray-300 rounded-lg p-3">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIncludeReturn(!includeReturn)}>
                  <div className={'relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ' + (includeReturn ? 'bg-primary-600' : 'bg-gray-300')}><div className={'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ' + (includeReturn ? 'translate-x-5' : 'translate-x-0.5')} /></div>
                  <div><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Incluir retorno</span>{includeReturn && returnLeg && <p className="text-xs text-gray-400">{returnLeg.origin} {'→'} {returnLeg.destination} ({Number(returnLeg.km).toFixed(1)} km)</p>}</div>
                </div>
              </div>
              {effectiveTotalKm > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex justify-between items-center">
                  <div className="text-sm text-gray-600"><div>{effectiveLegs.length} trecho{effectiveLegs.length > 1 ? 's' : ''}{includeReturn && returnLeg ? ' (c/ retorno)' : ''}</div><div className="text-xs">{effectiveTotalKm.toFixed(1)} km x R$ {Number(ratePerKm).toFixed(2)}/km</div></div>
                  <div className="text-2xl font-bold text-green-600">R$ {effectiveTotalValue.toFixed(2)}</div>
                </div>
              )}
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observacoes</label><textarea className="input" rows={2} value={observations} onChange={e => setObservations(e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">{saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />} Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
