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
    const interval = setInterval(fetchMarketData, 300000)
    return () => clearInterval(interval)
  }, [])

  function scroll(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' })
  }

  async function fetchMarketData() {
    try {
      const [currencyRes, selicRes, ipcaRes, igpmRes] = await Promise.all([
        fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL,GBP-BRL').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
      ])

      const n: TickerItem[] = []
      if (currencyRes?.EURBRL) { const e = currencyRes.EURBRL; n.push({ label: 'Euro', value: `R$ ${Number(e.bid).toFixed(2)}`, change: `${Number(e.pctChange) >= 0 ? '+' : ''}${Number(e.pctChange).toFixed(2)}%`, positive: Number(e.pctChange) >= 0, icon: '🇪🇺' }) }
      if (currencyRes?.BTCBRL) { const b = currencyRes.BTCBRL; n.push({ label: 'Bitcoin', value: `R$ ${(Number(b.bid)/1000).toFixed(1)}k`, change: `${Number(b.pctChange) >= 0 ? '+' : ''}${Number(b.pctChange).toFixed(2)}%`, positive: Number(b.pctChange) >= 0, icon: '₿' }) }
      if (currencyRes?.GBPBRL) { const g = currencyRes.GBPBRL; n.push({ label: 'Libra', value: `R$ ${Number(g.bid).toFixed(2)}`, change: `${Number(g.pctChange) >= 0 ? '+' : ''}${Number(g.pctChange).toFixed(2)}%`, positive: Number(g.pctChange) >= 0, icon: '🇬🇧' }) }
      if (selicRes?.[0]) n.push({ label: 'Selic/CDI', value: `${Number(selicRes[0].valor).toFixed(2)}% a.a.`, icon: '📊', positive: true })
      if (ipcaRes?.[0]) n.push({ label: 'IPCA (mês)', value: `${ipcaRes[0].valor}%`, icon: '📈' })
      if (igpmRes?.[0]) { const v = Number(igpmRes[0].valor); n.push({ label: 'IGP-M (mês)', value: `${igpmRes[0].valor}%`, icon: '📉', positive: v <= 0 }) }
      if (currencyRes?.USDBRL) { const u = currencyRes.USDBRL; n.push({ label: 'Dólar', value: `R$ ${Number(u.bid).toFixed(2)}`, change: `${Number(u.pctChange) >= 0 ? '+' : ''}${Number(u.pctChange).toFixed(2)}%`, positive: Number(u.pctChange) >= 0, icon: '🇺🇸' }) }
      setItems(n)
    } catch {
      setItems([
        { label: 'Euro', value: 'R$ 6,32', change: '+0.60%', positive: true, icon: '🇪🇺' },
        { label: 'Bitcoin', value: 'R$ 550k', change: '-2.35%', positive: false, icon: '₿' },
        { label: 'Libra', value: 'R$ 6,97', change: '+0.51%', positive: true, icon: '🇬🇧' },
        { label: 'Selic/CDI', value: '14.75% a.a.', icon: '📊', positive: true },
        { label: 'IPCA (mês)', value: '0.58%', icon: '📈' },
        { label: 'IGP-M (mês)', value: '-0.50%', icon: '📉', positive: true },
        { label: 'Dólar', value: 'R$ 5.65', change: '+0.12%', positive: true, icon: '🇺🇸' },
      ])
    }
  }

  if (items.length === 0) return null

  return (
    <div className="relative mb-8 group">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl px-2 py-3 shadow-elevated">
        <div className="flex items-center">
          <button onClick={() => scroll(-1)} className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div ref={scrollRef} className="flex-1 overflow-x-auto flex gap-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {items.map((item, i) => (
              <div key={i} className="flex-shrink-0 bg-white/[0.06] hover:bg-white/[0.1] backdrop-blur rounded-2xl px-4 py-2.5 min-w-[145px] border border-white/[0.06] transition-all duration-200 cursor-default">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-[11px] text-slate-400 font-medium">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-semibold text-sm">{item.value}</span>
                  {item.change && (
                    <span className={`text-[10px] font-semibold ${item.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => scroll(1)} className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
