import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Edit, Trash2, X, Check, AlertTriangle } from 'lucide-react'

interface Product {
  id: string
  name: string
  code: string
  category: string
  quantity: number
  purchasePrice: number
  salePrice: number
  taxPercentage: number
  supplier: string
  minStock: number
  description: string
  ncm: string
  cfop: string
  cest: string
  unit: string
  active: boolean
}

const emptyForm = { name: '', code: '', category: '', quantity: 0, purchasePrice: 0, salePrice: 0, taxPercentage: 0, supplier: '', minStock: 5, description: '', ncm: '', cfop: '5102', cest: '', unit: 'UN' }

export function Products() {
  const { isAdmin } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/products')
      setProducts(res.data)
    } catch { setError('Erro ao carregar produtos') }
    finally { setLoading(false) }
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, code: p.code, category: p.category, quantity: p.quantity, purchasePrice: p.purchasePrice, salePrice: p.salePrice, taxPercentage: p.taxPercentage, supplier: p.supplier || '', minStock: p.minStock, description: p.description || '', ncm: p.ncm || '', cfop: p.cfop || '5102', cest: p.cest || '', unit: p.unit || 'UN' })
    setError('')
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim() || !form.code.trim()) { setError('Nome e código são obrigatórios'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/products/${editing.id}`, form)
      } else {
        await api.post('/products', form)
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remover este produto?')) return
    try {
      await api.delete(`/products/${id}`)
      load()
    } catch { setError('Erro ao remover') }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Produtos</h1>
        {true && (
          <button onClick={openNew} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        )}
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por nome, código ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Produto</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Código</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Categoria</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Estoque</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Preço Venda</th>
                <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Margem</th>
                {true && <th className="table-cell font-semibold text-gray-700 dark:text-gray-300">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-gray-500">Nenhum produto encontrado</td></tr>
              ) : filtered.map(p => {
                const margin = p.purchasePrice > 0 ? ((p.salePrice - p.purchasePrice) / p.purchasePrice * 100).toFixed(0) : 0
                const lowStock = p.quantity <= p.minStock
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
                      {p.supplier && <div className="text-xs text-gray-500">{p.supplier}</div>}
                    </td>
                    <td className="table-cell text-gray-600 dark:text-gray-400 font-mono text-xs">{p.code}</td>
                    <td className="table-cell"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">{p.category}</span></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        {lowStock && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                        <span className={lowStock ? 'text-yellow-600 font-semibold' : 'text-gray-900 dark:text-white'}>{p.quantity}</span>
                        <span className="text-xs text-gray-400">(mín: {p.minStock})</span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-900 dark:text-white font-medium">R$ {Number(p.salePrice).toFixed(2)}</td>
                    <td className="table-cell"><span className="text-green-600 font-medium">{margin}%</span></td>
                    {true && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(p)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => remove(p.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código *</label>
                  <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria *</label>
                  <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço de Compra (R$)</label>
                  <input className="input" type="number" step="0.01" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço de Venda (R$)</label>
                  <input className="input" type="number" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Imposto (%)</label>
                  <input className="input" type="number" step="0.01" value={form.taxPercentage} onChange={e => setForm({ ...form, taxPercentage: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque Atual</label>
                  <input className="input" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque Mínimo</label>
                  <input className="input" type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fornecedor</label>
                  <input className="input" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                  <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              {/* Dados Fiscais */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-3">Dados Fiscais (NF-e)</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">NCM</label>
                    <input className="input" value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} placeholder="00000000" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CFOP</label>
                    <input className="input" value={form.cfop} onChange={e => setForm({ ...form, cfop: e.target.value })} placeholder="5102" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CEST</label>
                    <input className="input" value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value })} placeholder="Opcional" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unidade</label>
                    <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                      <option value="UN">UN - Unidade</option>
                      <option value="PC">PC - Peca</option>
                      <option value="CX">CX - Caixa</option>
                      <option value="KG">KG - Quilograma</option>
                      <option value="MT">MT - Metro</option>
                      <option value="LT">LT - Litro</option>
                      <option value="HR">HR - Hora</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

