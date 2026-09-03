import { useEffect, useState } from 'react'
import { Plus, Trash2, X, Ban, CheckCircle2, KeyRound } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'

interface Admin { id: string; name: string; email: string; active: boolean; lastLoginAt: string | null; createdAt: string }

const emptyForm = { name: '', email: '', password: '' }

export function SuperAdminAdmins() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [me, setMe] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [resetTarget, setResetTarget] = useState<Admin | null>(null)
  const [newPassword, setNewPassword] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [adminsRes, meRes] = await Promise.all([superAdminApi.get('/admins'), superAdminApi.get('/auth/me')])
      setAdmins(adminsRes.data)
      setMe(meRes.data)
    } catch {
      setError('Erro ao carregar administradores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setError('Preencha nome, email e uma senha com pelo menos 8 caracteres')
      return
    }
    setSaving(true)
    setError('')
    try {
      await superAdminApi.post('/admins', form)
      setModalOpen(false)
      setForm(emptyForm)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao criar administrador')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(admin: Admin) {
    try {
      await superAdminApi.patch(`/admins/${admin.id}`, { active: !admin.active })
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao atualizar')
    }
  }

  async function remove(admin: Admin) {
    if (!confirm(`Remover o administrador "${admin.name}"?`)) return
    try {
      await superAdminApi.delete(`/admins/${admin.id}`)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao remover')
    }
  }

  async function resetPassword() {
    if (!resetTarget || newPassword.length < 8) { setError('A nova senha deve ter pelo menos 8 caracteres'); return }
    try {
      await superAdminApi.patch(`/admins/${resetTarget.id}`, { password: newPassword })
      setResetTarget(null); setNewPassword(''); setError('')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao trocar senha')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administradores</h1>
          <p className="text-sm text-gray-400">Quem tem acesso a este painel do super admin.</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(''); setModalOpen(true) }} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400">
          <Plus className="h-4 w-4" aria-hidden="true" />Novo administrador
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {resetTarget && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm text-amber-200">Nova senha para <strong>{resetTarget.email}</strong>:</p>
          <div className="flex gap-2">
            <input type="text" className="flex-1 rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            <button onClick={resetPassword} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-gray-900">Salvar</button>
            <button onClick={() => { setResetTarget(null); setNewPassword('') }} className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase text-gray-500">
              <tr><th className="p-3">Nome</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Último acesso</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {admins.map(admin => (
                <tr key={admin.id} className="text-gray-200">
                  <td className="p-3 font-medium">{admin.name}{admin.id === me?.id && <span className="ml-2 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">você</span>}</td>
                  <td className="p-3 text-gray-400">{admin.email}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${admin.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-700 text-gray-300'}`}>{admin.active ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="p-3 text-xs text-gray-500">{admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button title="Trocar senha" onClick={() => { setResetTarget(admin); setNewPassword('') }} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><KeyRound className="h-4 w-4" /></button>
                      {admin.id !== me?.id && (
                        <>
                          <button title={admin.active ? 'Desativar' : 'Ativar'} onClick={() => toggleActive(admin)} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
                            {admin.active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </button>
                          <button title="Remover" onClick={() => remove(admin)} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">Nenhum administrador</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 p-6 text-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Novo administrador</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Nome *</label>
                <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Email *</label>
                <input type="email" className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Senha inicial *</label>
                <input type="text" className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
                <button onClick={create} disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-50">
                  {saving ? 'Criando...' : 'Criar administrador'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
