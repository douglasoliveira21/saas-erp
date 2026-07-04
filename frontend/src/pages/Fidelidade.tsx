import { useState } from 'react'
import { Star, Settings, Gift, Users } from 'lucide-react'

export function Fidelidade() {
  const [config, setConfig] = useState({ pointsPerReal: 1, redeemMinPoints: 100, redeemValue: 10 })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Programa de Fidelidade</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de pontos e recompensas para clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5" /> Regras de Pontuação</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pontos por R$ 1,00</label>
                <input className="input" type="number" min="1" value={config.pointsPerReal} onChange={e => setConfig({ ...config, pointsPerReal: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mín. pontos p/ resgate</label>
                <input className="input" type="number" min="1" value={config.redeemMinPoints} onChange={e => setConfig({ ...config, redeemMinPoints: parseInt(e.target.value) || 100 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do resgate (R$)</label>
                <input className="input" type="number" min="1" value={config.redeemValue} onChange={e => setConfig({ ...config, redeemValue: parseInt(e.target.value) || 10 })} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">A cada R$ 1,00 em compras, o cliente ganha {config.pointsPerReal} ponto(s). Com {config.redeemMinPoints} pontos, pode resgatar R$ {config.redeemValue.toFixed(2)} em desconto.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card text-center py-8">
            <Star className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Pontos distribuídos</p>
          </div>
          <div className="card text-center py-8">
            <Gift className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Resgates realizados</p>
          </div>
          <div className="card text-center py-8">
            <Users className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Clientes no programa</p>
          </div>
        </div>
      </div>
    </div>
  )
}
