import { Plus, Trash2 } from 'lucide-react'
import { Button, Card, TableContainer } from '../ui'

export interface SaleProduct { id: string; name: string; code: string; salePrice: number; taxPercentage: number; purchasePrice: number; quantity: number }
export interface SaleService { id: string; name: string; salePrice: number; taxPercentage: number; operationalCost: number }
export interface SaleItem { type: 'product' | 'service'; id: string; name: string; quantity: number; unitPrice: number; taxPercentage: number; costPrice: number }

interface SaleItemsEditorProps {
  itemType: 'product' | 'service'
  selectedId: string
  quantity: number
  unitPrice: number
  products: SaleProduct[]
  services: SaleService[]
  items: SaleItem[]
  onTypeChange: (type: 'product' | 'service') => void
  onSelect: (id: string) => void
  onQuantityChange: (quantity: number) => void
  onUnitPriceChange: (price: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

export function SaleItemsEditor({ itemType, selectedId, quantity, unitPrice, products, services, items, onTypeChange, onSelect, onQuantityChange, onUnitPriceChange, onAdd, onRemove }: SaleItemsEditorProps) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Adicionar itens</h2>
        <p className="mt-1 text-xs text-gray-500">O valor informado é exclusivo desta venda e não altera o cadastro.</p>
      </div>
      <div className="flex gap-2" role="group" aria-label="Tipo do item">
        <Button size="sm" variant={itemType === 'product' ? 'primary' : 'secondary'} aria-pressed={itemType === 'product'} onClick={() => onTypeChange('product')}>Produto</Button>
        <Button size="sm" variant={itemType === 'service' ? 'primary' : 'secondary'} aria-pressed={itemType === 'service'} onClick={() => onTypeChange('service')}>Serviço</Button>
      </div>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto]">
        <div>
          <label htmlFor="sale-item" className="mb-1 block text-xs font-medium text-gray-600">Item</label>
          <select id="sale-item" className="input" value={selectedId} onChange={event => onSelect(event.target.value)}>
            <option value="">Selecione {itemType === 'product' ? 'produto' : 'serviço'}...</option>
            {itemType === 'product'
              ? products.map(product => <option key={product.id} value={product.id}>{product.name} — R$ {Number(product.salePrice).toFixed(2)} (estoque: {product.quantity})</option>)
              : services.map(service => <option key={service.id} value={service.id}>{service.name} — R$ {Number(service.salePrice).toFixed(2)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sale-quantity" className="mb-1 block text-xs font-medium text-gray-600">Quantidade</label>
          <input id="sale-quantity" className="input" type="number" min={1} value={quantity} onChange={event => onQuantityChange(parseInt(event.target.value) || 1)} />
        </div>
        <div>
          <label htmlFor="sale-unit-price" className="mb-1 block text-xs font-medium text-gray-600">Valor unitário</label>
          <input id="sale-unit-price" className="input" type="number" min={0} step="0.01" value={unitPrice} onChange={event => onUnitPriceChange(parseFloat(event.target.value) || 0)} disabled={!selectedId} />
        </div>
        <Button onClick={onAdd} disabled={!selectedId} aria-label="Adicionar item à venda"><Plus className="h-4 w-4" aria-hidden="true" />Adicionar</Button>
      </div>
      {items.length > 0 && (
        <TableContainer aria-label="Itens adicionados à venda">
          <table className="min-w-[640px] w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-gray-600"><th scope="col" className="px-4 py-3 text-left">Item</th><th scope="col" className="px-4 py-3 text-right">Qtd.</th><th scope="col" className="px-4 py-3 text-right">Unitário</th><th scope="col" className="px-4 py-3 text-right">Total</th><th scope="col" className="w-12"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.type}-${item.id}-${index}`} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3"><span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${item.type === 'product' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{item.type === 'product' ? 'Produto' : 'Serviço'}</span>{item.name}</td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium">R$ {(item.unitPrice * item.quantity).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label={`Remover ${item.name}`}><Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}
    </Card>
  )
}
