import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Plus, Search, Filter, X, Check, TrendingUp, TrendingDown, RefreshCw, Edit, Trash2 } from 'lucide-react'

interface Movement {
  id: string
  product: { id: string; name: string; code: string }
  type: 'entrada' | 'saida' | 'ajuste' | 'venda'
  quantity: number
  previousQuantity: number
  newQuantity: number
  reason: string
  createdAt: string
}

interface Product { id: string; name: string; code: string; quantity: number; minStock: number }

const typeLabels: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', venda: 'Venda' }
const typeColors: Record<string, string> = { entrada: 'bg-green-100 text-green-700', saida: 'bg-red-100 text-red-700', ajuste: 'bg-yellow-100 text-yellow-700', venda: 'bg-blue-100 text-blue-700' }

export function Stock() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ productId: '', type: 'entrada', quantity: 1, reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'movements' | 'products'>('products')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [mov, prod] = await Promise.all([
        api.get('/stock/movements'),
        api.get('/products'),
      ])
      setMovements(mov.data)
      setProducts(prod.data)
    } catch { setError('Erro ao carregar estoque') }
    finally { setLoading(false) }
  }

  async function save() {
    if (!form.productId) { setError('Selecione um produto'); return }
    if (form.quantity <= 0) { setError('Quantidade deve ser maior que zero'); return }
    setSaving(true)
    try {
      await api.post('/stock/movements', form)
      setShowModal(false); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao registrar') }
    finally { setSaving(false) }
  }

  function openEdit(m: Movement) {
    setForm({ productId: m.product?.id || '', type: m.type, quantity: m.quantity, reason: m.reason || '' })
    setError('')
    setShowModal(true)
  }

  async function deleteMovement(id: string) {
    if (!confirm('Excluir esta movimentação? O estoque será revertido.')) return
    try {
      await api.delete('/stock/movements/' + id)
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir') }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Excluir este produto do estoque?')) return
    try {
      await api.delete('/products/' + id)
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao excluir. Produto pode ter vendas vinculadas.') }
  }

  const filteredMovements = movements.filter(m => {
    const matchSearch = m.product?.name?.toLowerCase().includes(search.toLowerCase()) || m.product?.code?.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || m.type === typeFilter
    return matchSearch && matchType
  })

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockCount = products.filter(p => p.quantity <= p.minStock).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Estoque</h1>
          {lowStockCount > 0 && <p className="text-sm text-yellow-600 mt-1">⚠️ {lowStockCount} produto(s) com estoque baixo</p>}
        </div>
        <button onClick={() => { setForm({ productId: '', type: 'entrada', quantity: 1, reason: '' }); setError(''); setShowModal(true) }} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Movimentação
        </button>
      </div>

      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {tab === 'movements' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select className="input w-36" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('products')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'products' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Produtos em Estoque</button>
        <button onClick={() => setTab('movements')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'movements' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Histórico de Movimentações</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : tab === 'products' ? (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Produto</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Código</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Estoque Atual</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Estoque Mínimo</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center text-gray-500">Nenhum produto encontrado</td></tr>
              ) : filteredProducts.map(p => {
                const low = p.quantity <= p.minStock
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${low ? 'bg-yellow-50/50' : ''}`}>
                    <td className="table-cell font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="table-cell text-gray-500 font-mono text-xs">{p.code}</td>
                    <td className="table-cell">
                      <span className={`text-lg font-bold ${low ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>{p.quantity}</span>
                    </td>
                    <td className="table-cell text-gray-500">{p.minStock}</td>
                    <td className="table-cell">
                      {low
                        ? <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">⚠️ Baixo</span>
                        : <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>
                      }
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => window.location.href = '/products'} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar produto"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => deleteProduct(p.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir produto"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Data</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Produto</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Tipo</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Quantidade</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Antes → Depois</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Motivo</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMovements.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-gray-500">Nenhuma movimentação encontrada</td></tr>
              ) : filteredMovements.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="table-cell font-medium text-gray-900 dark:text-white">{m.product?.name}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      {m.type === 'entrada' && <TrendingUp className="w-4 h-4 text-green-500" />}
                      {m.type === 'saida' && <TrendingDown className="w-4 h-4 text-red-500" />}
                      {m.type === 'ajuste' && <RefreshCw className="w-4 h-4 text-yellow-500" />}
                      {m.type === 'venda' && <TrendingDown className="w-4 h-4 text-blue-500" />}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[m.type]}`}>{typeLabels[m.type]}</span>
                    </div>
                  </td>
                  <td className="table-cell font-semibold text-gray-900 dark:text-white">{m.quantity}</td>
                  <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{m.previousQuantity} → {m.newQuantity}</td>
                  <td className="table-cell text-gray-600 dark:text-gray-400 text-sm">{m.reason || '-'}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(m)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => deleteMovement(m.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nova Movimentação</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto *</label>
                <select className="input" value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (atual: {p.quantity})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                  <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantidade</label>
                  <input className="input" type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
                <input className="input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Ex: Compra de fornecedor, ajuste de inventário..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
