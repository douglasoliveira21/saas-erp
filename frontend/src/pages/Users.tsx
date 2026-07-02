import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Plus, Search, Edit, Trash2, X, Check, Shield } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'financeiro' | 'tecnico'
  active: boolean
  observations: string
}

const roleLabels: Record<string, string> = { admin: 'Administrador', financeiro: 'Financeiro', tecnico: 'Técnico' }
const roleColors: Record<string, string> = { admin: 'bg-purple-100 text-purple-700', financeiro: 'bg-blue-100 text-blue-700', tecnico: 'bg-green-100 text-green-700' }
const emptyForm = { name: '', email: '', password: '', role: 'tecnico', observations: '', active: true }

export function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/users')
      setUsers(res.data)
    } catch { setError('Erro ao carregar usuários') }
    finally { setLoading(false) }
  }

  function openNew() { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }

  function openEdit(u: User) {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, observations: u.observations || '', active: u.active })
    setError(''); setShowModal(true)
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) { setError('Nome e email são obrigatórios'); return }
    if (!editing && !form.password.trim()) { setError('Senha é obrigatória para novo usuário'); return }
    setSaving(true)
    try {
      const payload: any = { name: form.name, email: form.email, role: form.role, observations: form.observations }
      if (form.password) payload.password = form.password
      if (editing) {
        payload.active = form.active
        await api.patch(`/users/${editing.id}`, payload)
      }
      else { await api.post('/users', payload) }
      setShowModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remover este usuário?')) return
    try { await api.delete(`/users/${id}`); load() }
    catch { setError('Erro ao remover') }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Usuários</h1>
        <button onClick={openNew} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Email</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Perfil</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="table-cell text-center text-gray-500">Nenhum usuário encontrado</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-gray-600 dark:text-gray-400">{u.email}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => remove(u.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{editing ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Perfil</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="tecnico">Técnico</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="active" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
                  <label htmlFor="active" className="text-sm text-gray-700 dark:text-gray-300">Usuário ativo</label>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                <textarea className="input" rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} />
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
