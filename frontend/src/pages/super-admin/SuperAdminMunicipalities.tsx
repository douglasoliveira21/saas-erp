import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'

interface Municipality {
  id: string
  name: string
  uf: string
  ibgeCode: string
  provider: string | null
  nfseApiUrl: string | null
  nfseTestUrl: string | null
  status: 'suportado' | 'em_teste' | 'nao_suportado'
  notes: string | null
}

const emptyForm = { name: '', uf: '', ibgeCode: '', provider: '', nfseApiUrl: '', nfseTestUrl: '', status: 'em_teste', notes: '' }

const statusLabels: Record<string, string> = { suportado: 'Suportado', em_teste: 'Em teste', nao_suportado: 'Não suportado' }
const statusColors: Record<string, string> = { suportado: 'bg-green-500/20 text-green-300', em_teste: 'bg-amber-500/20 text-amber-300', nao_suportado: 'bg-gray-700 text-gray-300' }

export function SuperAdminMunicipalities() {
  const [items, setItems] = useState<Municipality[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Municipality | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await superAdminApi.get('/municipalities')
      setItems(res.data)
    } catch {
      setError('Erro ao carregar municípios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(item: Municipality) {
    setEditing(item)
    setForm({
      name: item.name, uf: item.uf, ibgeCode: item.ibgeCode, provider: item.provider || '',
      nfseApiUrl: item.nfseApiUrl || '', nfseTestUrl: item.nfseTestUrl || '', status: item.status, notes: item.notes || '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim() || !form.uf.trim() || !form.ibgeCode.trim()) { setError('Informe nome, UF e código IBGE'); return }
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, provider: form.provider || null, nfseApiUrl: form.nfseApiUrl || null, nfseTestUrl: form.nfseTestUrl || null, notes: form.notes || null }
      if (editing) await superAdminApi.patch(`/municipalities/${editing.id}`, payload)
      else await superAdminApi.post('/municipalities', payload)
      setModalOpen(false)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar município')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Municipality) {
    if (!confirm(`Remover "${item.name}/${item.uf}" do catálogo?`)) return
    await superAdminApi.delete(`/municipalities/${item.id}`)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Municípios (NFS-e)</h1>
          <p className="text-sm text-gray-400">Catálogo de prefeituras com provedor de nota fiscal já mapeado. Um tenant que escolher um município aqui listado tem a URL da API preenchida automaticamente.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400">
          <Plus className="h-4 w-4" aria-hidden="true" />Novo município
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Município</th>
                <th className="px-4 py-2">Código IBGE</th>
                <th className="px-4 py-2">Provedor</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map(item => (
                <tr key={item.id} className="bg-gray-900/50">
                  <td className="px-4 py-2">{item.name}/{item.uf}</td>
                  <td className="px-4 py-2 text-gray-400">{item.ibgeCode}</td>
                  <td className="px-4 py-2 text-gray-400">{item.provider || '-'}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[item.status]}`}>{statusLabels[item.status]}</span></td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(item)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nenhum município cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-gray-900 p-6 text-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? 'Editar município' : 'Novo município'}</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm text-gray-300">Nome *</label>
                  <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">UF *</label>
                  <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" maxLength={2} value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Código IBGE *</label>
                  <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.ibgeCode} onChange={e => setForm({ ...form, ibgeCode: e.target.value })} placeholder="3118601" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Provedor</label>
                  <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="cidade360, ginfes..." />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">URL API (Produção)</label>
                <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.nfseApiUrl} onChange={e => setForm({ ...form, nfseApiUrl: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">URL API (Homologação)</label>
                <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.nfseTestUrl} onChange={e => setForm({ ...form, nfseTestUrl: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Status</label>
                <select className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="suportado">Suportado</option>
                  <option value="em_teste">Em teste</option>
                  <option value="nao_suportado">Não suportado</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Observações</label>
                <textarea className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
                <button onClick={save} disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
