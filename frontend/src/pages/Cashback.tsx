import { useState } from 'react'
import { DollarSign, Settings, Users } from 'lucide-react'

export function Cashback() {
  const [config, setConfig] = useState({ percentage: 5, minPurchase: 50, maxCashback: 100, expirationDays: 90 })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cashback</h1>
          <p className="text-sm text-gray-500 mt-1">Programa de cashback para clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5" /> Configuração do Cashback</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Percentual de Cashback (%)</label>
                <input className="input" type="number" min="0" max="50" step="0.5" value={config.percentage} onChange={e => setConfig({ ...config, percentage: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compra Mínima (R$)</label>
                <input className="input" type="number" min="0" step="10" value={config.minPurchase} onChange={e => setConfig({ ...config, minPurchase: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cashback Máximo (R$)</label>
                <input className="input" type="number" min="0" step="10" value={config.maxCashback} onChange={e => setConfig({ ...config, maxCashback: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validade (dias)</label>
                <input className="input" type="number" min="1" value={config.expirationDays} onChange={e => setConfig({ ...config, expirationDays: parseInt(e.target.value) || 90 })} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Cliente recebe {config.percentage}% de volta em compras acima de R$ {config.minPurchase.toFixed(2)}, válido por {config.expirationDays} dias.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card text-center py-8">
            <DollarSign className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">R$ 0,00</p>
            <p className="text-sm text-gray-500">Total de cashback distribuído</p>
          </div>
          <div className="card text-center py-8">
            <Users className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Clientes com saldo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
