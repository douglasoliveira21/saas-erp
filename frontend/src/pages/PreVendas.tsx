import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Search, ClipboardList, Plus, Check, X } from 'lucide-react'

export function PreVendas() {
  const { user } = useAuth()
  const [preVendas, setPreVendas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/sales')
      setPreVendas(res.data.filter((s: any) => s.saleType === 'pre_venda' || s.status === 'pendente'))
    } catch { setError('Erro ao carregar') }
    finally { setLoading(false) }
  }

  const filtered = preVendas.filter((s: any) =>
    s.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.technician?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pré-vendas</h1>
          <p className="text-sm text-gray-500 mt-1">Vendas pendentes de confirmação e pagamento</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhuma pré-venda encontrada</p>
          </div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700">Data</th>
                <th className="table-cell font-semibold text-gray-700">Cliente</th>
                <th className="table-cell font-semibold text-gray-700">Vendedor</th>
                <th className="table-cell font-semibold text-gray-700">Total</th>
                <th className="table-cell font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell text-sm text-gray-600">{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="table-cell font-medium">{s.customer?.name}</td>
                  <td className="table-cell text-gray-600">{s.technician?.name}</td>
                  <td className="table-cell font-semibold">R$ {Number(s.totalAmount).toFixed(2)}</td>
                  <td className="table-cell"><span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pendente</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
