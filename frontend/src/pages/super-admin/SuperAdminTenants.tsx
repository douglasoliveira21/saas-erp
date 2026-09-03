import { useEffect, useState } from 'react'
import { Plus, X, Copy } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'

interface Plan { id: string; name: string }
interface Tenant {
  id: string; name: string; slug: string; document: string | null; status: string
  planId: string | null; plan?: Plan; userCount: number; createdAt: string
}

const statusColors: Record<string, string> = {
  ativo: 'bg-green-500/20 text-green-300',
  suspenso: 'bg-yellow-500/20 text-yellow-300',
  cancelado: 'bg-red-500/20 text-red-300',
}

const emptyForm = { name: '', document: '', planId: '', adminName: '', adminEmail: '' }

export function SuperAdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ adminEmail: string; tempPassword: string } | null>(null)

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
    </div>
  )
}
