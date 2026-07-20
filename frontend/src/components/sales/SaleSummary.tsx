import { Check } from 'lucide-react'
import { Button, Card } from '../ui'

interface SaleSummaryProps {
  subtotal: number
  taxAmount: number
  discountPct: number
  discountValue: number
  totalAmount: number
  netProfit: number
  commissionPct: number
  commissionAmount: number
  canEditCommission: boolean
  saving: boolean
  disabled: boolean
  editing: boolean
  onCommissionChange: (percentage: number) => void
  onSubmit: () => void
}

export function SaleSummary({ subtotal, taxAmount, discountPct, discountValue, totalAmount, netProfit, commissionPct, commissionAmount, canEditCommission, saving, disabled, editing, onCommissionChange, onSubmit }: SaleSummaryProps) {
  return (
    <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
      <Card className="space-y-3" aria-label="Resumo financeiro da venda">
        <h2 className="font-semibold text-gray-900">Resumo</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-gray-600">Subtotal</dt><dd>R$ {subtotal.toFixed(2)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-600">Impostos</dt><dd>R$ {taxAmount.toFixed(2)}</dd></div>
          {discountPct > 0 && <div className="flex justify-between text-red-600"><dt>Desconto ({discountPct}%)</dt><dd>-R$ {discountValue.toFixed(2)}</dd></div>}
          <div className="flex justify-between border-t pt-3 text-base font-bold"><dt>Total</dt><dd className="text-green-600">R$ {totalAmount.toFixed(2)}</dd></div>
          <div className="flex justify-between border-t pt-2 text-gray-500"><dt>Lucro líquido</dt><dd>R$ {netProfit.toFixed(2)}</dd></div>
          <div className="flex items-center justify-between text-gray-500"><dt>Comissão ({commissionPct}%)</dt><dd>R$ {commissionAmount.toFixed(2)}</dd></div>
        </dl>
        {canEditCommission && (
          <div>
            <label htmlFor="commission-percentage" className="mb-1 block text-xs text-gray-500">Percentual da comissão</label>
            <input id="commission-percentage" className="input" type="number" min={0} max={100} step={0.5} value={commissionPct} onChange={event => onCommissionChange(parseFloat(event.target.value) || 0)} />
          </div>
        )}
      </Card>
      <Button size="lg" loading={saving} disabled={disabled} className="w-full" onClick={onSubmit}>
        {!saving && <Check className="h-5 w-5" aria-hidden="true" />}
        {editing ? 'Salvar alterações' : 'Registrar venda'}
      </Button>
    </aside>
  )
}
