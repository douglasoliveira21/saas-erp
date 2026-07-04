import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Search, Repeat, DollarSign } from 'lucide-react'

export function VendasRecorrentes() {
  const [vendas, setVendas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/sales')
      setVendas(res.data.filter((s: any) => s.saleType === 'recorrente'))
    } catch {} finally { setLoading(false) }
  }

  const filtered = vendas.filter((s: any) =>
    s.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalMensal = filtered.reduce((s: number, v: any) => s + Number(v.totalAmount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vendas Recorrentes</h1>
          <p className="text-sm text-gray-500 mt-1">Cobranças mensais automáticas</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Repeat className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Assinaturas Ativas</p><p className="text-xl font-bold">{filtered.length}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Receita Recorrente</p><p className="text-xl font-bold text-green-600">R$ {totalMensal.toFixed(2)}/mês</p></div>
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
            <Repeat className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhuma venda recorrente encontrada</p>
            <p className="text-sm mt-1">Crie uma venda com tipo "Recorrente" para ela aparecer aqui.</p>
          </div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700">Cliente</th>
                <th className="table-cell font-semibold text-gray-700">Valor Mensal</th>
                <th className="table-cell font-semibold text-gray-700">Pagamento</th>
                <th className="table-cell font-semibold text-gray-700">Status</th>
                <th className="table-cell font-semibold text-gray-700">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{s.customer?.name}</td>
                  <td className="table-cell font-semibold text-green-600">R$ {Number(s.totalAmount).toFixed(2)}</td>
                  <td className="table-cell text-gray-600">{s.paymentMethod}</td>
                  <td className="table-cell"><span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span></td>
                  <td className="table-cell text-sm text-gray-500">{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
