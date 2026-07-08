import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Plus, Search, Edit, Trash2, X, Check, Clock } from 'lucide-react'

interface Service {
  id: string
  name: string
  description: string
  salePrice: number
  operationalCost: number
  taxPercentage: number
  estimatedTime: number
  active: boolean
}

const emptyForm = { name: '', description: '', salePrice: 0, operationalCost: 0, taxPercentage: 0, estimatedTime: 60 }

export function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/services')
      setServices(res.data)
    } catch { setError('Erro ao carregar serviços') }
    finally { setLoading(false) }
  }

  function openNew() { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({ name: s.name, description: s.description || '', salePrice: s.salePrice, operationalCost: s.operationalCost, taxPercentage: s.taxPercentage, estimatedTime: s.estimatedTime || 60 })
    setError(''); setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      if (editing) { await api.patch(`/services/${editing.id}`, form) }
      else { await api.post('/services', form) }
      setShowModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remover este serviço?')) return
    try { await api.delete(`/services/${id}`); load() }
    catch { setError('Erro ao remover') }
  }

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const formatTime = (min: number) => {
    if (!min) return '-'
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Serviços</h1>
        {true && (
          <button onClick={openNew} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Serviço
          </button>
        )}
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar serviços..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Serviço</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Preço</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Custo Op.</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Imposto</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Tempo Est.</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Margem</th>
                {true && <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-gray-500">Nenhum serviço encontrado</td></tr>
              ) : filtered.map(s => {
                const taxOnService = s.salePrice * (s.taxPercentage || 0) / 100
                const margin = s.operationalCost > 0 ? ((s.salePrice - s.operationalCost - taxOnService) / s.salePrice * 100).toFixed(0) : 100
                return (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                      {s.description && <div className="text-xs text-gray-500 truncate max-w-xs">{s.description}</div>}
                    </td>
                    <td className="table-cell font-medium text-gray-900 dark:text-white">R$ {Number(s.salePrice).toFixed(2)}</td>
                    <td className="table-cell text-gray-600 dark:text-gray-400">R$ {Number(s.operationalCost).toFixed(2)}</td>
                    <td className="table-cell text-gray-600 dark:text-gray-400">{s.taxPercentage}%</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Clock className="w-3 h-3" />{formatTime(s.estimatedTime)}
                      </div>
                    </td>
                    <td className="table-cell"><span className="text-green-600 font-medium">{margin}%</span></td>
                    {true && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(s)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => remove(s.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Editar Serviço' : 'Novo Serviço'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço de Venda (R$)</label>
                  <input className="input" type="number" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custo Operacional (R$)</label>
                  <input className="input" type="number" step="0.01" value={form.operationalCost} onChange={e => setForm({ ...form, operationalCost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Imposto (%)</label>
                  <input className="input" type="number" step="0.01" value={form.taxPercentage} onChange={e => setForm({ ...form, taxPercentage: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tempo Estimado (min)</label>
                  <input className="input" type="number" value={form.estimatedTime} onChange={e => setForm({ ...form, estimatedTime: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

