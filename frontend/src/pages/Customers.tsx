import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Plus, Search, Edit, Trash2, X, Check, Loader2 } from 'lucide-react'

interface Customer {
  id: string
  name: string
  cpfCnpj: string
  phone: string
  email: string
  address: string
  stateRegistration: string
  city: string
  uf: string
  neighborhood: string
  cep: string
  observations: string
  active: boolean
  glpiEntityId: number | null
  glpiEntityName: string | null
}

interface GlpiEntity { id: number; name: string }

const emptyForm = { name: '', cpf_cnpj: '', phone: '', email: '', address: '', stateRegistration: '', city: '', uf: '', neighborhood: '', cep: '', observations: '', glpiEntityId: '' }

export function Customers() {
  const canEdit = true // Todos os usuários podem visualizar, editar e adicionar clientes
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [glpiEntities, setGlpiEntities] = useState<GlpiEntity[]>([])

  useEffect(() => { load(); loadEntities() }, [])

  async function load() {
    try {
      const res = await api.get('/customers')
      setCustomers(res.data)
    } catch { setError('Erro ao carregar clientes') }
    finally { setLoading(false) }
  }

  async function loadEntities() {
    try {
      const res = await api.get('/glpi/entities')
      console.log('GLPI entities loaded:', res.data)
      setGlpiEntities(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) {
      console.log('GLPI entities error:', e.response?.status, e.response?.data || e.message)
    }
  }

  const [searching, setSearching] = useState(false)

  async function searchCpfCnpj(value: string) {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length !== 11 && cleaned.length !== 14) return

    setSearching(true)
    setError('')
    try {
      if (cleaned.length === 14) {
        // CNPJ - BrasilAPI
        const res = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cleaned)
        if (res.ok) {
          const data = await res.json()
          const endereco = [data.logradouro, data.numero].filter(Boolean).join(', ')
          // Buscar IE nas inscricoes estaduais (se disponivel)
          let ie = ''
          if (data.inscricoes_estaduais && data.inscricoes_estaduais.length > 0) {
            const ieAtiva = data.inscricoes_estaduais.find((i: any) => i.ativo) || data.inscricoes_estaduais[0]
            ie = ieAtiva?.inscricao_estadual || ''
          }
          setForm(prev => ({
            ...prev,
            name: data.razao_social || data.nome_fantasia || prev.name,
            email: data.email || prev.email,
            phone: data.ddd_telefone_1 ? '(' + data.ddd_telefone_1.substring(0,2) + ') ' + data.ddd_telefone_1.substring(2) : prev.phone,
            address: endereco || prev.address,
            city: data.municipio || prev.city,
            uf: data.uf || prev.uf,
            neighborhood: data.bairro || prev.neighborhood,
            cep: data.cep ? data.cep.replace(/\D/g, '') : prev.cep,
            stateRegistration: ie || prev.stateRegistration,
          }))
        } else {
          setError('CNPJ nao encontrado')
        }
      } else {
        // CPF - nao ha API publica gratuita confiavel para CPF
        setError('Busca automatica disponivel apenas para CNPJ')
      }
    } catch {
      setError('Erro ao buscar dados do CNPJ')
    } finally { setSearching(false) }
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ name: c.name, cpf_cnpj: c.cpfCnpj || '', phone: c.phone || '', email: c.email || '', address: c.address || '', stateRegistration: c.stateRegistration || '', city: c.city || '', uf: c.uf || '', neighborhood: c.neighborhood || '', cep: c.cep || '', observations: c.observations || '', glpiEntityId: c.glpiEntityId ? String(c.glpiEntityId) : '' })
    setError('')
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Nome e obrigatorio'); return }
    setSaving(true)
    try {
      const payload: any = {
        name: form.name,
        cpfCnpj: form.cpf_cnpj,
        phone: form.phone,
        email: form.email,
        address: form.address,
        stateRegistration: form.stateRegistration,
        city: form.city,
        uf: form.uf,
        neighborhood: form.neighborhood,
        cep: form.cep,
        observations: form.observations,
        glpiEntityId: form.glpiEntityId ? parseInt(form.glpiEntityId) : null,
        glpiEntityName: form.glpiEntityId ? glpiEntities.find(e => e.id === parseInt(form.glpiEntityId))?.name || null : null,
      }
      if (editing) {
        await api.patch(`/customers/${editing.id}`, payload)
      } else {
        await api.post('/customers', payload)
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remover este cliente?')) return
    try {
      await api.delete(`/customers/${id}`)
      load()
    } catch { setError('Erro ao remover') }
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cpfCnpj || '').includes(search) ||
    (c.phone || '').includes(search)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
        {canEdit && (
          <button onClick={openNew} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Cliente
          </button>
        )}
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por nome, CPF/CNPJ ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Nome</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">CPF/CNPJ</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Telefone</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Email</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                {canEdit && <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center text-gray-500">Nenhum cliente encontrado</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell font-medium text-gray-900 dark:text-white">{c.name}</td>
                  <td className="table-cell text-gray-600 dark:text-gray-400">{c.cpfCnpj || '-'}</td>
                  <td className="table-cell text-gray-600 dark:text-gray-400">{c.phone || '-'}</td>
                  <td className="table-cell text-gray-600 dark:text-gray-400">{c.email || '-'}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.active ? 'Ativo' : 'Inativo'}
                    </span>
                    {c.glpiEntityName && (
                      <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">GLPI</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(c)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => remove(c.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPF/CNPJ</label>
                  <div className="flex gap-2">
                    <input className="input flex-1" placeholder="Digite o CPF ou CNPJ" value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} />
                    <button
                      type="button"
                      onClick={() => searchCpfCnpj(form.cpf_cnpj)}
                      disabled={searching || form.cpf_cnpj.replace(/\D/g, '').length < 11}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1"
                      title="Buscar dados automaticamente"
                    >
                      {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      Buscar
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Digite o CNPJ e clique Buscar para preencher automaticamente</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>

              {/* Inscricao Estadual - so aparece para CNPJ */}
              {form.cpf_cnpj.replace(/\D/g, '').length === 14 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inscricao Estadual</label>
                  <input className="input" value={form.stateRegistration} onChange={e => setForm({ ...form, stateRegistration: e.target.value })} placeholder="IE do cliente" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endereco (Logradouro, Numero)</label>
                <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, Numero" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bairro</label>
                  <input className="input" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CEP</label>
                  <input className="input" value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cidade</label>
                  <input className="input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UF</label>
                  <input className="input" maxLength={2} value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} placeholder="MG" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observacoes</label>
                <textarea className="input" rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
              </div>

              {/* Vinculacao GLPI */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Entidade GLPI (vinculacao chamados)</label>
                <select className="input" value={form.glpiEntityId} onChange={e => setForm({ ...form, glpiEntityId: e.target.value })}>
                  <option value="">Nenhuma (sem vinculacao)</option>
                  {glpiEntities.map(e => <option key={e.id} value={e.id}>{e.name} (ID: {e.id})</option>)}
                </select>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Vincule a entidade do GLPI para controle de SLA e chamados deste cliente.</p>
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
