import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'
import { PLAN_MODULE_GROUPS } from '../../data/planModules'

interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  billingCycle: string
  modules: string[]
  limits: { maxUsers?: number; maxInvoicesPerMonth?: number; maxServiceOrdersPerMonth?: number }
  active: boolean
}

const emptyForm = {
  name: '', description: '', price: '0', billingCycle: 'mensal',
  modules: [] as string[],
  maxUsers: '5', maxInvoicesPerMonth: '100', maxServiceOrdersPerMonth: '50',
}

function money(value: any) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function SuperAdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await superAdminApi.get('/plans')
      setPlans(res.data)
    } catch {
      setError('Erro ao carregar planos')
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

  function openEdit(plan: Plan) {
    setEditing(plan)
    setForm({
      name: plan.name, description: plan.description || '', price: String(plan.price), billingCycle: plan.billingCycle,
      modules: plan.modules || [],
      maxUsers: String(plan.limits?.maxUsers ?? 5),
      maxInvoicesPerMonth: String(plan.limits?.maxInvoicesPerMonth ?? 100),
      maxServiceOrdersPerMonth: String(plan.limits?.maxServiceOrdersPerMonth ?? 50),
    })
    setModalOpen(true)
  }

  function toggleModule(key: string) {
    setForm(current => ({
      ...current,
      modules: current.modules.includes(key) ? current.modules.filter(m => m !== key) : [...current.modules, key],
    }))
  }

  async function save() {
    if (!form.name.trim()) { setError('Informe o nome do plano'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name, description: form.description, price: Number(form.price || 0), billingCycle: form.billingCycle,
        modules: form.modules,
        limits: {
          maxUsers: Number(form.maxUsers || 0),
          maxInvoicesPerMonth: Number(form.maxInvoicesPerMonth || 0),
          maxServiceOrdersPerMonth: Number(form.maxServiceOrdersPerMonth || 0),
        },
      }
      if (editing) await superAdminApi.patch(`/plans/${editing.id}`, payload)
      else await superAdminApi.post('/plans', payload)
      setModalOpen(false)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar plano')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(plan: Plan) {
    await superAdminApi.patch(`/plans/${plan.id}`, { active: !plan.active })
    load()
  }

  async function remove(plan: Plan) {
    if (!confirm(`Remover o plano "${plan.name}"? Se estiver em uso por algum cliente, ele só será desativado.`)) return
    await superAdminApi.delete(`/plans/${plan.id}`)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planos</h1>
        <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400">
          <Plus className="h-4 w-4" aria-hidden="true" />Novo plano
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.id} className={`rounded-xl border p-4 ${plan.active ? 'border-gray-700 bg-gray-900' : 'border-gray-800 bg-gray-900/50 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{plan.name}</h2>
                  <p className="text-xs text-gray-400">{plan.description}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(plan)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(plan)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 text-lg font-bold text-amber-400">{money(plan.price)}<span className="text-xs font-normal text-gray-400">/{plan.billingCycle}</span></p>
              <div className="mt-2 space-y-0.5 text-xs text-gray-400">
                <p>{plan.modules?.length || 0} módulos habilitados</p>
                <p>Até {plan.limits?.maxUsers ?? '-'} usuários</p>
                <p>Até {plan.limits?.maxInvoicesPerMonth ?? '-'} notas/mês</p>
                <p>Até {plan.limits?.maxServiceOrdersPerMonth ?? '-'} OS/mês</p>
              </div>
              <button onClick={() => toggleActive(plan)} className={`mt-3 rounded-full px-2 py-1 text-xs font-medium ${plan.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                {plan.active ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-gray-900 p-6 text-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? 'Editar plano' : 'Novo plano'}</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Nome *</label>
                <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Descrição</label>
                <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Preço (R$)</label>
                  <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Ciclo</label>
                  <select className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })}>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Limites</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Usuários</label>
                    <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" type="number" min="0" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Notas/mês</label>
                    <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" type="number" min="0" value={form.maxInvoicesPerMonth} onChange={e => setForm({ ...form, maxInvoicesPerMonth: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">OS/mês</label>
                    <input className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" type="number" min="0" value={form.maxServiceOrdersPerMonth} onChange={e => setForm({ ...form, maxServiceOrdersPerMonth: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-300">Módulos habilitados</h3>
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-gray-700 p-3">
                  {PLAN_MODULE_GROUPS.map(group => (
                    <div key={group.group}>
                      <p className="mb-1 text-xs font-semibold uppercase text-gray-500">{group.group}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {group.modules.map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-sm text-gray-300">
                            <input type="checkbox" checked={form.modules.includes(key)} onChange={() => toggleModule(key)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
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
