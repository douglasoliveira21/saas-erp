import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Eye, Trash2, Check, X, DollarSign, FileText, Send } from 'lucide-react'

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
  const { isAdmin, isFinanceiro, user } = useAuth()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [form, setForm] = useState({ customerId: '', validDays: '30', observations: '' })
  const [items, setItems] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [oRes, cRes, pRes, sRes] = await Promise.all([
        api.get('/sales', { params: { status: 'orcamento' } }).catch(() => ({ data: [] })),
        api.get('/customers'),
        api.get('/products'),
        api.get('/services'),
      ])
      setOrcamentos(oRes.data.filter((s: any) => s.saleType === 'orcamento' || s.status === 'orcamento'))
      setCustomers(cRes.data); setProducts(pRes.data); setServices(sRes.data)
    } catch { setError('Erro ao carregar orçamentos') }
    finally { setLoading(false) }
  }

  async function createOrcamento() {
    if (!form.customerId || items.length === 0) { setError('Selecione cliente e itens'); return }
    setSaving(true)
    try {
      const subtotal = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0)
      const taxAmount = items.reduce((s: number, i: any) => s + (i.unitPrice * i.quantity * (i.taxPercentage || 0) / 100), 0)
      await api.post('/sales', {
        customerId: form.customerId,
        technicianId: user?.id,
        paymentMethod: 'pix',
        saleType: 'orcamento',
        status: 'orcamento',
        observations: form.observations || `Orçamento válido por ${form.validDays} dias`,
        subtotal, taxAmount, totalAmount: subtotal + taxAmount,
        netProfit: 0, commissionPercentage: 0, commissionAmount: 0,
        items: items.map((i: any) => ({
          ...(i.type === 'product' ? { productId: i.id } : { serviceId: i.id }),
          name: i.name, quantity: i.quantity, unitPrice: i.unitPrice,
          totalPrice: i.unitPrice * i.quantity, taxPercentage: i.taxPercentage || 0,
          taxAmount: i.unitPrice * i.quantity * (i.taxPercentage || 0) / 100,
          costPrice: i.costPrice || 0, netProfit: 0,
        }))
      })
      setShowModal(false); setItems([]); load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao criar orçamento') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Orçamentos</h1>
        <button onClick={() => { setForm({ customerId: '', validDays: '30', observations: '' }); setItems([]); setError(''); setShowModal(true) }} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Orçamento</button>
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
        <p className="font-medium">Orçamentos</p>
        <p className="text-sm mt-1">Crie orçamentos para enviar aos clientes. Quando aprovados, converta em venda.</p>
        <p className="text-sm mt-1">{orcamentos.length} orçamento(s) encontrado(s)</p>
      </div>
    </div>
  )
}
