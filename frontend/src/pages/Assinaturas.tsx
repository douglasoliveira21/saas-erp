import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Search, CreditCard, DollarSign, Users } from 'lucide-react'

export function Assinaturas() {
  const [assinaturas, setAssinaturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [salesRes, contractsRes] = await Promise.all([
        api.get('/sales'),
        api.get('/contracts'),
      ])
      const recorrentes = salesRes.data.filter((s: any) => s.saleType === 'recorrente')
      const contratosAtivos = contractsRes.data.filter((c: any) => c.status === 'ativo' && c.monthlyValue)
      setAssinaturas([
        ...recorrentes.map((s: any) => ({ id: s.id, type: 'venda', name: s.customer?.name, value: s.totalAmount, status: 'ativo', since: s.createdAt })),
        ...contratosAtivos.map((c: any) => ({ id: c.id, type: 'contrato', name: c.customer?.name, value: c.monthlyValue, status: c.status, since: c.startDate })),
      ])
    } catch {} finally { setLoading(false) }
  }

  const filtered = assinaturas.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()))
  const totalMensal = filtered.reduce((s, a) => s + Number(a.value), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Assinaturas</h1>
          <p className="text-sm text-gray-500 mt-1">Vendas recorrentes e contratos com cobrança mensal</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Assinantes Ativos</p><p className="text-xl font-bold">{filtered.length}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">MRR (Receita Mensal)</p><p className="text-xl font-bold text-green-600">R$ {totalMensal.toFixed(2)}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs text-gray-500">ARR (Receita Anual)</p><p className="text-xl font-bold text-purple-600">R$ {(totalMensal * 12).toFixed(2)}</p></div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhuma assinatura encontrada</p>
          </div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700">Cliente</th>
                <th className="table-cell font-semibold text-gray-700">Tipo</th>
                <th className="table-cell font-semibold text-gray-700">Valor Mensal</th>
                <th className="table-cell font-semibold text-gray-700">Status</th>
                <th className="table-cell font-semibold text-gray-700">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{a.name}</td>
                  <td className="table-cell"><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (a.type === 'contrato' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>{a.type === 'contrato' ? 'Contrato' : 'Venda Recorrente'}</span></td>
                  <td className="table-cell font-semibold text-green-600">R$ {Number(a.value).toFixed(2)}</td>
                  <td className="table-cell"><span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span></td>
                  <td className="table-cell text-sm text-gray-500">{new Date((a.since || '') + (a.since?.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
