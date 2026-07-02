import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TickerItem {
  label: string
  value: string
  change?: string
  positive?: boolean
  icon?: string
}

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMarketData()
    const dataInterval = setInterval(fetchMarketData, 300000)
    return () => clearInterval(dataInterval)
  }, [])

  function scrollLeft() {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' })
  }
  function scrollRight() {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' })
  }

  async function fetchMarketData() {
    try {
      const [currencyRes, selicRes, ipcaRes, igpmRes] = await Promise.all([
        fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL,GBP-BRL').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
      ])

      const newItems: TickerItem[] = []

      if (currencyRes?.EURBRL) {
        const eur = currencyRes.EURBRL
        newItems.push({ label: 'Euro', value: `R$ ${Number(eur.bid).toFixed(2)}`, change: `${Number(eur.pctChange) >= 0 ? '+' : ''}${Number(eur.pctChange).toFixed(2)}%`, positive: Number(eur.pctChange) >= 0, icon: '🇪🇺' })
      }
      if (currencyRes?.BTCBRL) {
        const btc = currencyRes.BTCBRL
        const btcVal = Number(btc.bid)
        newItems.push({ label: 'Bitcoin', value: `R$ ${(btcVal / 1000).toFixed(1)}k`, change: `${Number(btc.pctChange) >= 0 ? '+' : ''}${Number(btc.pctChange).toFixed(2)}%`, positive: Number(btc.pctChange) >= 0, icon: '₿' })
      }
      if (currencyRes?.GBPBRL) {
        const gbp = currencyRes.GBPBRL
        newItems.push({ label: 'Libra', value: `R$ ${Number(gbp.bid).toFixed(2)}`, change: `${Number(gbp.pctChange) >= 0 ? '+' : ''}${Number(gbp.pctChange).toFixed(2)}%`, positive: Number(gbp.pctChange) >= 0, icon: '🇬🇧' })
      }
      if (selicRes?.[0]) {
        newItems.push({ label: 'Selic/CDI', value: `${Number(selicRes[0].valor).toFixed(2)}% a.a.`, icon: '📊', positive: true })
      }
      if (ipcaRes?.[0]) {
        newItems.push({ label: 'IPCA (mês)', value: `${ipcaRes[0].valor}%`, icon: '📈' })
      }
      if (igpmRes?.[0]) {
        const val = Number(igpmRes[0].valor)
        newItems.push({ label: 'IGP-M (mês)', value: `${val >= 0 ? '' : ''}${igpmRes[0].valor}%`, icon: '📉', positive: val <= 0 })
      }
      if (currencyRes?.USDBRL) {
        const usd = currencyRes.USDBRL
        newItems.push({ label: 'Dólar', value: `R$ ${Number(usd.bid).toFixed(2)}`, change: `${Number(usd.pctChange) >= 0 ? '+' : ''}${Number(usd.pctChange).toFixed(2)}%`, positive: Number(usd.pctChange) >= 0, icon: '🇺🇸' })
      }

      setItems(newItems)
    } catch {
      setItems([
        { label: 'Euro', value: 'R$ 6,32', change: '+0.60%', positive: true, icon: '🇪🇺' },
        { label: 'Bitcoin', value: 'R$ 323k', change: '-2.35%', positive: false, icon: '₿' },
        { label: 'Libra', value: 'R$ 6,97', change: '+0.51%', positive: true, icon: '🇬🇧' },
        { label: 'Selic/CDI', value: '14.15% a.a.', icon: '📊', positive: true },
        { label: 'IPCA (mês)', value: '0.58%', icon: '📈' },
        { label: 'IGP-M (mês)', value: '-0.50%', icon: '📉', positive: true },
        { label: 'Dólar', value: 'R$ 5.22', change: '+0.00%', positive: true, icon: '🇺🇸' },
      ])
    }
  }

  if (items.length === 0) return null

  return (
    <div className="relative mb-6">
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center">
          <button onClick={scrollLeft} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors mr-3">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-hide flex gap-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {items.map((item, i) => (
              <div key={i} className="flex-shrink-0 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 min-w-[140px] border border-white/10">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-base">{item.icon}</span>
                  <span className="text-xs text-indigo-200 font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">{item.value}</span>
                  {item.change && (
                    <span className={`text-xs font-semibold ${item.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {item.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={scrollRight} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ml-3">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
