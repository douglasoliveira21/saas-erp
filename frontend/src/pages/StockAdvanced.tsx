import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Archive, ClipboardCheck, LockKeyhole, RefreshCw, Search } from 'lucide-react'

export function StockAdvanced() {
  const [products, setProducts] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [kardex, setKardex] = useState<any>(null)
  const [countedQuantity, setCountedQuantity] = useState('')
  const [justification, setJustification] = useState('')
  const [reserveQuantity, setReserveQuantity] = useState('')
  const [reserveReason, setReserveReason] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [productsRes, lowStockRes] = await Promise.all([
        api.get('/products'),
        api.get('/stock/low-stock'),
      ])
      setProducts(productsRes.data)
      setLowStock(lowStockRes.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar estoque')
    } finally {
      setLoading(false)
    }
  }

  async function loadKardex(productId = selectedProduct) {
    if (!productId) return
    setError('')
    try {
      setKardex((await api.get(`/stock/kardex/${productId}`)).data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar Kardex')
    }
  }

  async function inventoryAdjust(e: React.FormEvent) {
    e.preventDefault()
    await submit(
      () => api.post(`/stock/inventory/${selectedProduct}`, { countedQuantity: Number(countedQuantity), justification }),
      () => { setCountedQuantity(''); setJustification(''); loadKardex() },
    )
  }

  async function reserve(action: 'reserve' | 'release-reservation') {
    await submit(
      () => api.post(`/stock/${action}/${selectedProduct}`, { quantity: Number(reserveQuantity), reason: reserveReason }),
      () => { setReserveQuantity(''); setReserveReason(''); loadKardex() },
    )
  }

  async function submit(request: () => Promise<any>, after: () => void) {
    setError('')
    setSuccess('')
    try {
      await request()
      setSuccess('Operação realizada')
      after()
      await load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha na operação')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque Avançado</h1>
          <p className="text-sm text-gray-500">Inventário, Kardex, reservas e alertas de reposição.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Search className="h-4 w-4" /> Produto</div>
            <select value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); loadKardex(e.target.value) }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
          </div>

          <form onSubmit={inventoryAdjust} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ClipboardCheck className="h-4 w-4" /> Inventário</div>
            <input required type="number" value={countedQuantity} onChange={(e) => setCountedQuantity(e.target.value)} placeholder="Quantidade contada" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <textarea required value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Justificativa" className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button disabled={!selectedProduct} className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Ajustar estoque</button>
          </form>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><LockKeyhole className="h-4 w-4" /> Reserva</div>
            <input type="number" value={reserveQuantity} onChange={(e) => setReserveQuantity(e.target.value)} placeholder="Quantidade" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input value={reserveReason} onChange={(e) => setReserveReason(e.target.value)} placeholder="Motivo" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!selectedProduct} onClick={() => reserve('reserve')} className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Reservar</button>
              <button disabled={!selectedProduct} onClick={() => reserve('release-reservation')} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50">Liberar</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Archive className="h-4 w-4" /> Kardex</div>
            {!kardex ? <p className="text-sm text-gray-500">Selecione um produto.</p> : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="Atual" value={kardex.currentQuantity} />
                  <Metric label="Reservado" value={kardex.reservedQuantity} />
                  <Metric label="Disponível" value={kardex.availableQuantity} />
                </div>
                <Table rows={kardex.movements || []} cols={['createdAt', 'type', 'quantity', 'previousQuantity', 'newQuantity', 'reason']} labels={['Data', 'Tipo', 'Qtd.', 'Antes', 'Depois', 'Motivo']} />
              </>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-gray-900">Reposição</div>
            <Table loading={loading} rows={lowStock} cols={['code', 'name', 'quantity', 'minStock']} labels={['Código', 'Produto', 'Atual', 'Mínimo']} />
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div className="rounded-md bg-gray-50 p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-lg font-semibold text-gray-900">{value}</div></div>
}

function Table({ rows, cols, labels, loading = false }: { rows: any[]; cols: string[]; labels: string[]; loading?: boolean }) {
  return <div className="overflow-auto rounded-md border border-gray-200"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50"><tr>{labels.map((l) => <th key={l} className="px-3 py-2 text-left font-semibold text-gray-600">{l}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{loading && <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-gray-500">Carregando...</td></tr>}{!loading && rows.length === 0 && <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-gray-500">Nenhum registro</td></tr>}{!loading && rows.map((row) => <tr key={row.id}>{cols.map((col) => <td key={col} className="px-3 py-2 text-gray-700">{col === 'createdAt' && row[col] ? new Date(row[col]).toLocaleString('pt-BR') : String(row[col] ?? '-')}</td>)}</tr>)}</tbody></table></div>
}
