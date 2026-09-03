import { useEffect, useState } from 'react'
import { Plus, X, Copy, Users, Trash2, KeyRound, Ban, CheckCircle2 } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'

interface Plan { id: string; name: string }
interface Tenant {
  id: string; name: string; slug: string; document: string | null; status: string
  planId: string | null; plan?: Plan; userCount: number; createdAt: string
}
interface TenantUser { id: string; name: string; email: string; role: string; active: boolean }

const statusColors: Record<string, string> = {
  ativo: 'bg-green-500/20 text-green-300',
  suspenso: 'bg-yellow-500/20 text-yellow-300',
  cancelado: 'bg-red-500/20 text-red-300',
}

const emptyForm = { name: '', document: '', planId: '', adminName: '', adminEmail: '' }

function TenantUsersModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [users, setUsers] = useState<TenantUser[] | null>(null)
  const [error, setError] = useState('')
  const [resetTarget, setResetTarget] = useState<TenantUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  async function load() {
    try {
      const { data } = await superAdminApi.get(`/tenants/${tenant.id}/users`)
      setUsers(data)
    } catch {
      setError('Erro ao carregar usuários')
    }
  }

  useEffect(() => { load() }, [])

  async function toggleActive(user: TenantUser) {
    await superAdminApi.patch(`/tenants/${tenant.id}/users/${user.id}`, { active: !user.active })
    load()
  }

  async function removeUser(user: TenantUser) {
    if (!confirm(`Remover o usuário "${user.name}" (${user.email})?`)) return
    await superAdminApi.delete(`/tenants/${tenant.id}/users/${user.id}`)
    load()
  }

  async function resetPassword() {
    if (!resetTarget || newPassword.length < 6) { setError('A nova senha deve ter pelo menos 6 caracteres'); return }
    try {
      await superAdminApi.patch(`/tenants/${tenant.id}/users/${resetTarget.id}`, { password: newPassword })
      setResetTarget(null); setNewPassword(''); setError('')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao trocar senha')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-gray-900 p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Usuários de {tenant.name}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {error && <div className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        {resetTarget && (
          <div className="mb-4 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-200">Nova senha para <strong>{resetTarget.email}</strong>:</p>
            <div className="flex gap-2">
              <input type="text" className="flex-1 rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              <button onClick={resetPassword} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-gray-900">Salvar</button>
              <button onClick={() => { setResetTarget(null); setNewPassword('') }} className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
            </div>
          </div>
        )}

        {!users ? (
          <p className="text-gray-400">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-500">Nenhum usuário cadastrado neste cliente.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-left text-xs uppercase text-gray-500">
                <tr><th className="p-2">Nome</th><th className="p-2">Email</th><th className="p-2">Papel</th><th className="p-2">Status</th><th className="p-2" /></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="p-2">{user.name}</td>
                    <td className="p-2 text-gray-400">{user.email}</td>
                    <td className="p-2 text-gray-400">{user.role}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-700 text-gray-300'}`}>{user.active ? 'Ativo' : 'Suspenso'}</span>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <button title="Trocar senha" onClick={() => { setResetTarget(user); setNewPassword('') }} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><KeyRound className="h-4 w-4" /></button>
                        <button title={user.active ? 'Suspender' : 'Reativar'} onClick={() => toggleActive(user)} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
                          {user.active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </button>
                        <button title="Remover" onClick={() => removeUser(user)} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function DeleteTenantModal({ tenant, onClose, onDeleted }: { tenant: Tenant; onClose: () => void; onDeleted: () => void }) {
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function doDelete() {
    setDeleting(true); setError('')
    try {
      await superAdminApi.delete(`/tenants/${tenant.id}`, { data: { confirmName } })
      onDeleted()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao excluir cliente')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-gray-900 p-6 text-white">
        <h2 className="mb-2 text-lg font-semibold text-red-300">Excluir cliente permanentemente</h2>
        <p className="mb-4 text-sm text-gray-300">
          Isso apaga <strong>todos os dados</strong> de "{tenant.name}" (vendas, financeiro, usuários, ordens de serviço, etc). Não pode ser desfeito.
        </p>
        {error && <div className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        <label className="mb-1 block text-sm text-gray-300">Digite o nome do cliente para confirmar:</label>
        <input className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={tenant.name} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
          <button onClick={doDelete} disabled={deleting || confirmName !== tenant.name} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40">
            {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SuperAdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ adminEmail: string; tempPassword: string } | null>(null)
  const [usersModalTenant, setUsersModalTenant] = useState<Tenant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [t, p] = await Promise.all([superAdminApi.get('/tenants'), superAdminApi.get('/plans')])
      setTenants(t.data)
      setPlans(p.data)
    } catch {
      setError('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim()) {
      setError('Preencha nome do cliente, nome e email do administrador')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await superAdminApi.post('/tenants', form)
      setCreated({ adminEmail: res.data.adminEmail, tempPassword: res.data.tempPassword })
      setModalOpen(false)
      setForm(emptyForm)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao criar cliente')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(tenant: Tenant, status: string) {
    await superAdminApi.patch(`/tenants/${tenant.id}`, { status })
    load()
  }

  async function changePlan(tenant: Tenant, planId: string) {
    await superAdminApi.patch(`/tenants/${tenant.id}`, { planId: planId || null })
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes (tenants)</h1>
        <button onClick={() => { setForm(emptyForm); setError(''); setModalOpen(true) }} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400">
          <Plus className="h-4 w-4" aria-hidden="true" />Novo cliente
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {created && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div>
            <p className="font-semibold">Cliente criado! Repasse esse acesso agora — a senha não aparece de novo.</p>
            <p className="mt-1">Login: <strong>{created.adminEmail}</strong> · Senha temporária: <strong>{created.tempPassword}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigator.clipboard.writeText(`${created.adminEmail} / ${created.tempPassword}`)} className="rounded p-1.5 hover:bg-amber-500/20" title="Copiar"><Copy className="h-4 w-4" /></button>
            <button onClick={() => setCreated(null)} className="rounded p-1.5 hover:bg-amber-500/20"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Status</th>
                <th className="p-3">Plano</th>
                <th className="p-3">Usuários</th>
                <th className="p-3">Criado em</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tenants.map(tenant => (
                <tr key={tenant.id} className="text-gray-200">
                  <td className="p-3">
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-xs text-gray-500">{tenant.slug}{tenant.document ? ` · ${tenant.document}` : ''}</p>
                  </td>
                  <td className="p-3">
                    <select value={tenant.status} onChange={e => changeStatus(tenant, e.target.value)} className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${statusColors[tenant.status] || ''}`}>
                      <option value="ativo">Ativo</option>
                      <option value="suspenso">Suspenso</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select value={tenant.planId || ''} onChange={e => changePlan(tenant, e.target.value)} className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs">
                      <option value="">Sem plano</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="p-3">{tenant.userCount}</td>
                  <td className="p-3 text-xs text-gray-500">{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button title="Gerenciar usuários" onClick={() => setUsersModalTenant(tenant)} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><Users className="h-4 w-4" /></button>
                      <button title="Excluir cliente" onClick={() => setDeleteTarget(tenant)} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-gray-900 p-6 text-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Novo cliente</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Nome do cliente *</label>
                <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">CNPJ/CPF</label>
                <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Plano</label>
                <select className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}>
                  <option value="">Selecione depois</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Primeiro administrador do cliente</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Nome *</label>
                    <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Email *</label>
                    <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Uma senha temporária será gerada — você vai vê-la uma única vez depois de criar.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancelar</button>
                <button onClick={create} disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-50">
                  {saving ? 'Criando...' : 'Criar cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {usersModalTenant && <TenantUsersModal tenant={usersModalTenant} onClose={() => setUsersModalTenant(null)} />}
      {deleteTarget && (
        <DeleteTenantModal
          tenant={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load() }}
        />
      )}
    </div>
  )
}
