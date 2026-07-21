import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Building2, Landmark, ListTree, Lock, RefreshCw, Save } from 'lucide-react'

type Tab = 'cost-centers' | 'chart-accounts' | 'bank-accounts' | 'closings'

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'cost-centers', label: 'Centro de custo' },
  { id: 'chart-accounts', label: 'Plano de contas' },
  { id: 'bank-accounts', label: 'Contas/caixa' },
  { id: 'closings', label: 'Fechamento' },
]

function currency(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function FinancialAdvanced() {
  const [tab, setTab] = useState<Tab>('cost-centers')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [chartAccounts, setChartAccounts] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [closings, setClosings] = useState<any[]>([])
  const [costCenterForm, setCostCenterForm] = useState({ code: '', name: '', description: '' })
  const [chartForm, setChartForm] = useState({ code: '', name: '', type: 'despesa', parentId: '' })
  const [bankForm, setBankForm] = useState({ name: '', type: 'banco', bankName: '', agency: '', account: '', openingBalance: '' })
  const [closingForm, setClosingForm] = useState(() => {
    const d = new Date()
    return { period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, notes: '' }
  })

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (tab === 'cost-centers') setCostCenters((await api.get('/financial/cost-centers')).data)
      if (tab === 'chart-accounts') setChartAccounts((await api.get('/financial/chart-accounts')).data)
      if (tab === 'bank-accounts') setBankAccounts((await api.get('/financial/bank-accounts')).data)
      if (tab === 'closings') setClosings((await api.get('/financial/monthly-closings')).data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function saveCostCenter(e: React.FormEvent) {
    e.preventDefault()
    await submit(() => api.post('/financial/cost-centers', costCenterForm), () => setCostCenterForm({ code: '', name: '', description: '' }))
  }

  async function saveChartAccount(e: React.FormEvent) {
    e.preventDefault()
    await submit(() => api.post('/financial/chart-accounts', { ...chartForm, parentId: chartForm.parentId || null }), () => setChartForm({ code: '', name: '', type: 'despesa', parentId: '' }))
  }

  async function saveBankAccount(e: React.FormEvent) {
    e.preventDefault()
    await submit(() => api.post('/financial/bank-accounts', { ...bankForm, openingBalance: Number(bankForm.openingBalance || 0) }), () => setBankForm({ name: '', type: 'banco', bankName: '', agency: '', account: '', openingBalance: '' }))
  }

  async function closeMonth(e: React.FormEvent) {
    e.preventDefault()
    await submit(() => api.post('/financial/monthly-closings', closingForm), () => setClosingForm({ ...closingForm, notes: '' }))
  }

  async function submit(request: () => Promise<any>, reset: () => void) {
    setError('')
    setSuccess('')
    try {
      await request()
      reset()
      setSuccess('Registro salvo')
      await load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao salvar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro Avançado</h1>
          <p className="text-sm text-gray-500">Cadastros estruturais, competência e fechamento mensal.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((item) => (
          <button key={item.id} onClick={() => setTab(item.id)} className={`px-3 py-2 text-sm font-medium ${tab === item.id ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`}>
            {item.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      {tab === 'cost-centers' && (
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <FormPanel icon={<Building2 />} title="Novo centro de custo" onSubmit={saveCostCenter}>
            <Input label="Código" value={costCenterForm.code} onChange={(v) => setCostCenterForm({ ...costCenterForm, code: v })} required />
            <Input label="Nome" value={costCenterForm.name} onChange={(v) => setCostCenterForm({ ...costCenterForm, name: v })} required />
            <Input label="Descrição" value={costCenterForm.description} onChange={(v) => setCostCenterForm({ ...costCenterForm, description: v })} />
          </FormPanel>
          <DataTable loading={loading} rows={costCenters} columns={['code', 'name', 'description', 'active']} labels={['Código', 'Nome', 'Descrição', 'Ativo']} />
        </section>
      )}

      {tab === 'chart-accounts' && (
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <FormPanel icon={<ListTree />} title="Nova conta do plano" onSubmit={saveChartAccount}>
            <Input label="Código" value={chartForm.code} onChange={(v) => setChartForm({ ...chartForm, code: v })} required />
            <Input label="Nome" value={chartForm.name} onChange={(v) => setChartForm({ ...chartForm, name: v })} required />
            <Select label="Tipo" value={chartForm.type} onChange={(v) => setChartForm({ ...chartForm, type: v })} options={['receita', 'despesa', 'ativo', 'passivo', 'patrimonio']} />
            <Input label="Conta pai" value={chartForm.parentId} onChange={(v) => setChartForm({ ...chartForm, parentId: v })} />
          </FormPanel>
          <DataTable loading={loading} rows={chartAccounts} columns={['code', 'name', 'type', 'active']} labels={['Código', 'Nome', 'Tipo', 'Ativo']} />
        </section>
      )}

      {tab === 'bank-accounts' && (
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <FormPanel icon={<Landmark />} title="Nova conta/caixa" onSubmit={saveBankAccount}>
            <Input label="Nome" value={bankForm.name} onChange={(v) => setBankForm({ ...bankForm, name: v })} required />
            <Select label="Tipo" value={bankForm.type} onChange={(v) => setBankForm({ ...bankForm, type: v })} options={['banco', 'caixa', 'carteira', 'inter']} />
            <Input label="Banco" value={bankForm.bankName} onChange={(v) => setBankForm({ ...bankForm, bankName: v })} />
            <Input label="Agência" value={bankForm.agency} onChange={(v) => setBankForm({ ...bankForm, agency: v })} />
            <Input label="Conta" value={bankForm.account} onChange={(v) => setBankForm({ ...bankForm, account: v })} />
            <Input label="Saldo inicial" type="number" value={bankForm.openingBalance} onChange={(v) => setBankForm({ ...bankForm, openingBalance: v })} />
          </FormPanel>
          <DataTable loading={loading} rows={bankAccounts.map((b) => ({ ...b, openingBalance: currency(b.openingBalance) }))} columns={['name', 'type', 'bankName', 'openingBalance', 'active']} labels={['Nome', 'Tipo', 'Banco', 'Saldo inicial', 'Ativo']} />
        </section>
      )}

      {tab === 'closings' && (
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <FormPanel icon={<Lock />} title="Fechar mês" onSubmit={closeMonth}>
            <Input label="Competência" type="month" value={closingForm.period} onChange={(v) => setClosingForm({ ...closingForm, period: v })} required />
            <Input label="Observações" value={closingForm.notes} onChange={(v) => setClosingForm({ ...closingForm, notes: v })} />
          </FormPanel>
          <DataTable loading={loading} rows={closings.map((c) => ({ ...c, closedAt: c.closedAt ? new Date(c.closedAt).toLocaleString('pt-BR') : '-' }))} columns={['period', 'closedAt', 'notes']} labels={['Competência', 'Fechado em', 'Observações']} />
        </section>
      )}
    </div>
  )
}

function FormPanel({ icon, title, children, onSubmit }: { icon: React.ReactNode; title: string; children: React.ReactNode; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">{icon}<span>{title}</span></div>
      {children}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
        <Save className="h-4 w-4" /> Salvar
      </button>
    </form>
  )
}

function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{label}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
}

function DataTable({ loading, rows, columns, labels }: { loading: boolean; rows: any[]; columns: string[]; labels: string[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50"><tr>{labels.map((label) => <th key={label} className="px-4 py-3 text-left font-semibold text-gray-600">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {loading && <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={columns.length}>Carregando...</td></tr>}
          {!loading && rows.length === 0 && <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={columns.length}>Nenhum registro</td></tr>}
          {!loading && rows.map((row) => <tr key={row.id}>{columns.map((col) => <td key={col} className="px-4 py-3 text-gray-700">{String(row[col] ?? '-')}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
