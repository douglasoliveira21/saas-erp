import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Trash2, ArrowLeft, Check } from 'lucide-react'

interface Customer { id: string; name: string }
interface Product { id: string; name: string; code: string; salePrice: number; taxPercentage: number; purchasePrice: number; quantity: number }
interface Service { id: string; name: string; salePrice: number; taxPercentage: number; operationalCost: number }
interface Item { type: 'product' | 'service'; id: string; name: string; quantity: number; unitPrice: number; taxPercentage: number; costPrice: number }

export function NewSale() {
  const navigate = useNavigate()
  const { user, isAdmin, isFinanceiro } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [installments, setInstallments] = useState(1)
  const [dueDay, setDueDay] = useState(10)
  const [multaPercentage, setMultaPercentage] = useState(2.00)
  const [moraPercentage, setMoraPercentage] = useState(0.03)
  const [saleType, setSaleType] = useState<'eventual' | 'recorrente'>('eventual')
  const [commissionPct, setCommissionPct] = useState(10)
  const [observations, setObservations] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [itemType, setItemType] = useState<'product' | 'service'>('product')
  const [selectedId, setSelectedId] = useState('')
  const [qty, setQty] = useState(1)
  const [itemUnitPrice, setItemUnitPrice] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)
  const [discountPct, setDiscountPct] = useState(0)
  const [orderNumber, setOrderNumber] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/customers').then(r => setCustomers(r.data)),
      api.get('/products').then(r => setProducts(r.data)),
      api.get('/services').then(r => setServices(r.data)),
    ]).then(() => {
      // Check if editing an existing sale
      const params = new URLSearchParams(window.location.search)
      const editId = params.get('edit')
      if (editId) {
        loadSaleForEdit(editId)
      }
    })
  }, [])

  async function loadSaleForEdit(saleId: string) {
    try {
      const res = await api.get('/sales/' + saleId)
      const sale = res.data
      setEditingSaleId(saleId)
      setCustomerId(sale.customer?.id || '')
      setPaymentMethod(sale.paymentMethod || 'pix')
      setInstallments(sale.installments || 1)
      setDueDay(sale.dueDay || 10)
      setMultaPercentage(sale.multaPercentage != null ? Number(sale.multaPercentage) : 2.00)
      setMoraPercentage(sale.moraPercentage != null ? Number(sale.moraPercentage) : 0.03)
      setSaleType(sale.saleType || 'eventual')
      setObservations(sale.observations || '')
      setCommissionPct(sale.commissionPercentage || 10)
      if (sale.items?.length > 0) {
        setItems(sale.items.map((i: any) => ({
          type: i.productId ? 'product' : 'service',
          id: i.productId || i.serviceId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          taxPercentage: Number(i.taxPercentage || 0),
          costPrice: Number(i.costPrice || 0),
        })))
      }
    } catch {
      setError('Erro ao carregar venda para edição')
    }
  }

  function addItem() {
    if (!selectedId) { setError('Selecione um item'); return }
    if (itemUnitPrice < 0) { setError('O valor unitário não pode ser negativo'); return }
    setError('')
    if (itemType === 'product') {
      const p = products.find(x => x.id === selectedId)!
      setItems([...items, { type: 'product', id: p.id, name: p.name, quantity: qty, unitPrice: itemUnitPrice, taxPercentage: Number(p.taxPercentage), costPrice: Number(p.purchasePrice) }])
    } else {
      const s = services.find(x => x.id === selectedId)!
      setItems([...items, { type: 'service', id: s.id, name: s.name, quantity: qty, unitPrice: Number(s.salePrice), taxPercentage: Number(s.taxPercentage), costPrice: Number(s.operationalCost) }])
    }
    setSelectedId(''); setQty(1); setItemUnitPrice(0)
  }

  function selectItem(id: string) {
    setSelectedId(id)
    if (!id) {
      setItemUnitPrice(0)
      return
    }
    const selected = itemType === 'product'
      ? products.find(product => product.id === id)
      : services.find(service => service.id === id)
    setItemUnitPrice(Number(selected?.salePrice || 0))
  }

  function changeItemType(type: 'product' | 'service') {
    setItemType(type)
    setSelectedId('')
    setItemUnitPrice(0)
  }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const taxAmount = items.reduce((s, i) => s + (i.unitPrice * i.quantity * i.taxPercentage / 100), 0)
  const discountValue = subtotal * discountPct / 100
  const totalAmount = subtotal + taxAmount - discountValue
  const netProfit = items.reduce((s, i) => s + ((i.unitPrice - i.costPrice) * i.quantity), 0)
  const commissionAmount = totalAmount * commissionPct / 100

  async function submit() {
    if (!customerId) { setError('Selecione um cliente'); return }
    if (items.length === 0) { setError('Adicione pelo menos um item'); return }

    // Validação: data de vencimento não pode ser menor que 5 dias
    if (paymentMethod === 'boleto') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const currentDay = today.getDate()
      let vencDate: Date
      if (dueDay > currentDay) {
        vencDate = new Date(today.getFullYear(), today.getMonth(), dueDay)
      } else {
        vencDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay)
      }
      const diffDays = Math.ceil((vencDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 5) {
        setError('A data de vencimento deve ser no mínimo 5 dias a partir de hoje. Escolha outro dia.')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        customerId,
        technicianId: user?.id,
        paymentMethod,
        installments: paymentMethod === 'boleto' ? installments : 1,
        dueDay: paymentMethod === 'boleto' ? dueDay : null,
        multaPercentage,
        moraPercentage,
        saleType,
        observations: orderNumber ? `Pedido #${orderNumber}${observations ? ' | ' + observations : ''}` : observations,
        subtotal,
        taxAmount,
        totalAmount,
        discount: discountPct,
        discountValue,
        netProfit,
        commissionPercentage: commissionPct,
        commissionAmount,
        items: items.map(i => ({
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
      if (editingSaleId) {
        await api.patch('/sales/' + editingSaleId, payload)
      } else {
        await api.post('/sales', payload)
      }
      navigate('/sales')
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao registrar venda') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/sales')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{editingSaleId ? 'Editar Venda' : 'Nova Venda'}</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente e pagamento */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Dados da Venda</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
                <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartao de Credito</option>
                  <option value="cartao_debito">Cartao de Debito</option>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
            </div>

            {/* Campos de boleto */}
            {paymentMethod === 'boleto' && (<>
              <div className="grid grid-cols-2 gap-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parcelas</label>
                  <select className="input" value={installments} onChange={e => setInstallments(parseInt(e.target.value))}>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}x de R$ {(totalAmount / n).toFixed(2)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dia do Vencimento</label>
                  <select className="input" value={dueDay} onChange={e => setDueDay(parseInt(e.target.value))}>
                    {[5,10,15,20,25,28].map(d => {
                      const today = new Date()
                      today.setHours(0,0,0,0)
                      const currentDay = today.getDate()
                      
                      // Calcular a data real de vencimento para este dia
                      let vencDate: Date
                      if (d > currentDay) {
                        // Dia ainda não passou neste mês -> vencimento é neste mês
                        vencDate = new Date(today.getFullYear(), today.getMonth(), d)
                      } else {
                        // Dia já passou -> vencimento é no próximo mês
                        vencDate = new Date(today.getFullYear(), today.getMonth() + 1, d)
                      }
                      
                      // Regra: mínimo 5 dias de distância
                      const diffDays = Math.ceil((vencDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      const disabled = diffDays < 5
                      
                      // Label descritivo
                      const mesLabel = vencDate.getMonth() === today.getMonth() ? '(este mês)' : '(próx. mês)'
                      
                      return (
                        <option key={d} value={d} disabled={disabled}>
                          Dia {d} {mesLabel}{disabled ? ' - muito próximo' : ''}
                        </option>
                      )
                    })}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Mínimo 5 dias de antecedência. Dias indisponíveis aparecem bloqueados.</p>
                </div>
              </div>

              {/* Multa e Mora */}
              <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Multa após vencimento (%)</label>
                  {(isAdmin || isFinanceiro) ? (
                    <input className="input text-sm" type="number" step="0.01" min="0" value={multaPercentage} onChange={e => setMultaPercentage(parseFloat(e.target.value) || 0)} />
                  ) : (
                    <div className="input bg-gray-100 text-gray-600 cursor-not-allowed text-sm">{multaPercentage.toFixed(2)}%</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mora/Juros mensal (%)</label>
                  {(isAdmin || isFinanceiro) ? (
                    <input className="input text-sm" type="number" step="0.01" min="0" value={moraPercentage} onChange={e => setMoraPercentage(parseFloat(e.target.value) || 0)} />
                  ) : (
                    <div className="input bg-gray-100 text-gray-600 cursor-not-allowed text-sm">{moraPercentage.toFixed(2)}%</div>
                  )}
                </div>
                <p className="col-span-2 text-xs text-orange-600">Multa e juros aplicados automaticamente no boleto após o vencimento.</p>
              </div>
            </>)}

            {/* Tipo de venda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Venda</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="saleType" value="eventual" checked={saleType === 'eventual'} onChange={() => setSaleType('eventual')} className="w-4 h-4 text-primary-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Eventual</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="saleType" value="recorrente" checked={saleType === 'recorrente'} onChange={() => setSaleType('recorrente')} className="w-4 h-4 text-primary-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Recorrente</span>
                </label>
              </div>
              {saleType === 'recorrente' && <p className="text-xs text-blue-600 mt-1">Venda recorrente: sera cobrada mensalmente do cliente.</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observacoes</label>
              <textarea className="input" rows={2} value={observations} onChange={e => setObservations(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nº Pedido</label>
                <input className="input" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Número do pedido real (opcional)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desconto (%)</label>
                <input className="input" type="number" min="0" max="100" step="0.5" value={discountPct} onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Adicionar itens */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Adicionar Itens</h2>
            <div className="flex gap-2 mb-2">
              <button onClick={() => changeItemType('product')} className={`px-3 py-1 rounded-lg text-sm font-medium ${itemType === 'product' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Produto</button>
              <button onClick={() => changeItemType('service')} className={`px-3 py-1 rounded-lg text-sm font-medium ${itemType === 'service' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Serviço</button>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Item</label>
                <select className="input" value={selectedId} onChange={e => selectItem(e.target.value)}>
                  <option value="">Selecione {itemType === 'product' ? 'produto' : 'serviço'}...</option>
                  {itemType === 'product'
                    ? products.map(p => <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.salePrice).toFixed(2)} (estoque: {p.quantity})</option>)
                    : services.map(s => <option key={s.id} value={s.id}>{s.name} — R$ {Number(s.salePrice).toFixed(2)}</option>)
                  }
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-gray-500 mb-1">Qtd.</label>
                <input className="input" type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} placeholder="Qtd" />
              </div>
              {itemType === 'product' && (
                <div className="w-36">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Valor unitário</label>
                  <input className="input" type="number" min={0} step="0.01" value={itemUnitPrice} onChange={e => setItemUnitPrice(parseFloat(e.target.value) || 0)} disabled={!selectedId} />
                </div>
              )}
              <button onClick={addItem} className="btn btn-primary flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
            </div>
            {itemType === 'product' && selectedId && (
              <p className="text-xs text-gray-500">Este valor será usado somente nesta venda e não altera o preço cadastrado do produto.</p>
            )}
            {/* Lista de itens */}
            {items.length > 0 && (
              <table className="w-full text-sm mt-2">
                <thead><tr className="border-b text-gray-600"><th className="text-left py-2">Item</th><th className="text-right py-2">Qtd</th><th className="text-right py-2">Unit.</th><th className="text-right py-2">Total</th><th></th></tr></thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2">
                        <span className={`text-xs px-1 rounded mr-1 ${item.type === 'product' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{item.type === 'product' ? 'P' : 'S'}</span>
                        {item.name}
                      </td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">R$ {item.unitPrice.toFixed(2)}</td>
                      <td className="text-right py-2 font-medium">R$ {(item.unitPrice * item.quantity).toFixed(2)}</td>
                      <td className="text-right py-2"><button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Resumo */}
        <div className="space-y-6">
          <div className="card space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Resumo</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Impostos:</span><span>R$ {taxAmount.toFixed(2)}</span></div>
              {discountPct > 0 && <div className="flex justify-between text-red-500"><span>Desconto ({discountPct}%):</span><span>-R$ {discountValue.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total:</span><span className="text-green-600">R$ {totalAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-500 border-t pt-2"><span>Lucro liquido:</span><span>R$ {netProfit.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-500 items-center">
                <span>Comissao ({commissionPct}%):</span>
                <span>R$ {commissionAmount.toFixed(2)}</span>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 mt-1">
                  <label className="text-xs text-gray-400">% comissao:</label>
                  <input className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center" type="number" min={0} max={100} step={0.5} value={commissionPct} onChange={e => setCommissionPct(parseFloat(e.target.value) || 0)} />
                </div>
              )}
            </div>
          </div>

          <button onClick={submit} disabled={saving || items.length === 0} className="btn btn-primary w-full flex items-center justify-center gap-2 py-3">
            {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <Check className="w-5 h-5" />}
            {editingSaleId ? 'Salvar Alterações' : 'Registrar Venda'}
          </button>
        </div>
      </div>
    </div>
  )
}
