import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Trash2, Search, ShoppingCart, DollarSign } from 'lucide-react'

interface Product { id: string; name: string; code: string; salePrice: number; taxPercentage: number; purchasePrice: number; quantity: number }
interface Service { id: string; name: string; salePrice: number; taxPercentage: number; operationalCost: number }
interface Customer { id: string; name: string }
interface CartItem { type: 'product' | 'service'; id: string; name: string; quantity: number; unitPrice: number; taxPercentage: number; costPrice: number }

export function Pdv() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('dinheiro')
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [discount, setDiscount] = useState(0)

  useEffect(() => {
    Promise.all([
      api.get('/customers').then(r => setCustomers(r.data)),
      api.get('/products').then(r => setProducts(r.data)),
      api.get('/services').then(r => setServices(r.data)),
    ])
  }, [])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  function addProduct(p: Product) {
    const existing = cart.find(i => i.id === p.id && i.type === 'product')
    if (existing) {
      setCart(cart.map(i => i.id === p.id && i.type === 'product' ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setCart([...cart, { type: 'product', id: p.id, name: p.name, quantity: 1, unitPrice: Number(p.salePrice), taxPercentage: Number(p.taxPercentage), costPrice: Number(p.purchasePrice) }])
    }
  }

  function addService(s: Service) {
    setCart([...cart, { type: 'service', id: s.id, name: s.name, quantity: 1, unitPrice: Number(s.salePrice), taxPercentage: Number(s.taxPercentage), costPrice: Number(s.operationalCost) }])
  }

  function removeItem(idx: number) { setCart(cart.filter((_, i) => i !== idx)) }
  function updateQty(idx: number, qty: number) { if (qty < 1) return; setCart(cart.map((item, i) => i === idx ? { ...item, quantity: qty } : item)) }

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const taxAmount = cart.reduce((s, i) => s + (i.unitPrice * i.quantity * i.taxPercentage / 100), 0)
  const discountValue = subtotal * discount / 100
  const totalAmount = subtotal + taxAmount - discountValue

  async function finalizeSale() {
    if (cart.length === 0) { setError('Adicione itens ao carrinho'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const payload = {
        customerId: customerId || undefined,
        technicianId: user?.id,
        paymentMethod,
        installments: 1,
        saleType: 'eventual',
        observations: orderNumber ? `Pedido #${orderNumber}` : 'Venda PDV',
        subtotal,
        taxAmount,
        totalAmount,
        discount,
        discountValue,
        netProfit: cart.reduce((s, i) => s + ((i.unitPrice - i.costPrice) * i.quantity), 0),
        commissionPercentage: 0,
        commissionAmount: 0,
        items: cart.map(i => ({
          ...(i.type === 'product' ? { productId: i.id } : { serviceId: i.id }),
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.unitPrice * i.quantity,
          taxPercentage: i.taxPercentage,
          taxAmount: i.unitPrice * i.quantity * i.taxPercentage / 100,
          costPrice: i.costPrice,
          netProfit: (i.unitPrice - i.costPrice) * i.quantity,
        }))
      }
      await api.post('/sales', payload)
      setSuccess('Venda realizada com sucesso!')
      setCart([]); setCustomerId(''); setOrderNumber(''); setDiscount(0)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao finalizar venda') }
    finally { setSaving(false) }
  }

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4">
      {/* Left - Products */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PDV - Ponto de Venda</h1>
        </div>

        <div className="card mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar produto ou serviço..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.slice(0, 20).map(p => (
              <button key={p.id} onClick={() => addProduct(p)} className="card p-3 text-left hover:shadow-md hover:border-primary-300 transition-all border border-transparent">
                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.code}</p>
                <p className="text-primary-600 font-bold mt-1">R$ {Number(p.salePrice).toFixed(2)}</p>
                <p className="text-xs text-gray-400">Estoque: {p.quantity}</p>
              </button>
            ))}
            {filteredServices.slice(0, 8).map(s => (
              <button key={s.id} onClick={() => addService(s)} className="card p-3 text-left hover:shadow-md hover:border-green-300 transition-all border border-transparent bg-green-50/50">
                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{s.name}</p>
                <p className="text-xs text-green-600 mt-0.5">Serviço</p>
                <p className="text-green-600 font-bold mt-1">R$ {Number(s.salePrice).toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Cart */}
      <div className="w-96 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Carrinho</h2>
            <span className="text-sm text-gray-500">{cart.length} item(ns)</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Clique nos produtos para adicionar</p>
          ) : cart.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                <p className="text-xs text-gray-500">R$ {item.unitPrice.toFixed(2)} un.</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(i, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs font-bold">-</button>
                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                <button onClick={() => updateQty(i, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs font-bold">+</button>
              </div>
              <span className="text-sm font-semibold w-20 text-right">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
              <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
          {error && <div className="p-2 bg-red-50 text-red-700 rounded text-xs">{error}</div>}
          {success && <div className="p-2 bg-green-50 text-green-700 rounded text-xs">{success}</div>}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Cliente</label>
              <select className="input text-sm py-1.5" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">Consumidor</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Pagamento</label>
              <select className="input text-sm py-1.5" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Crédito</option>
                <option value="cartao_debito">Débito</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Nº Pedido</label>
              <input className="input text-sm py-1.5" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Desconto (%)</label>
              <input className="input text-sm py-1.5" type="number" min="0" max="100" step="0.5" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-1 text-sm pt-2 border-t border-gray-100">
            <div className="flex justify-between text-gray-500"><span>Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Impostos:</span><span>R$ {taxAmount.toFixed(2)}</span></div>
            {discount > 0 && <div className="flex justify-between text-red-500"><span>Desconto ({discount}%):</span><span>-R$ {discountValue.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-white pt-1 border-t"><span>Total:</span><span className="text-green-600">R$ {totalAmount.toFixed(2)}</span></div>
          </div>

          <button onClick={finalizeSale} disabled={saving || cart.length === 0} className="btn btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
            {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <DollarSign className="w-5 h-5" />}
            Finalizar Venda
          </button>
        </div>
      </div>
    </div>
  )
}
