import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Plus, Search, FileText } from 'lucide-react'

interface Orcamento {
  id: string
  customer: { id: string; name: string }
  items: any[]
  totalAmount: number
  status: string
  validUntil: string
  observations: string
  createdAt: string
}

export function Orcamentos() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/sales', { params: { status: 'orcamento' } }).catch(() => ({ data: [] }))
      setOrcamentos(res.data.filter((s: any) => s.saleType === 'orcamento' || s.status === 'orcamento'))
    } catch {
      setError('Erro ao carregar orcamentos')
    } finally {
      setLoading(false)
    }
  }

  const filtered = orcamentos.filter(o =>
    o.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.observations?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Orcamentos</h1>
        <button onClick={() => setError('Fluxo de novo orcamento ainda nao implementado.')} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Orcamento
        </button>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="card text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">Orcamentos</p>
        <p className="text-sm mt-1">Crie orcamentos para enviar aos clientes. Quando aprovados, converta em venda.</p>
        <p className="text-sm mt-1">{loading ? 'Carregando...' : `${filtered.length} orcamento(s) encontrado(s)`}</p>
      </div>
    </div>
  )
}
