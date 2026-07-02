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
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  async function fetchMarketData() {
    try {
      const [currencyRes, selicRes, ipcaRes, igpmRes] = await Promise.all([
        fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL,GBP-BRL,ETH-BRL').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
      ])

      const n: TickerItem[] = []

      // Dólar
      if (currencyRes?.USDBRL) {
        const d = currencyRes.USDBRL
        n.push({ label: 'Dólar', value: `R$ ${Number(d.bid).toFixed(2)}`, change: `${Number(d.pctChange) >= 0 ? '+' : ''}${Number(d.pctChange).toFixed(2)}%`, positive: Number(d.pctChange) >= 0, icon: '🇺🇸' })
      }

      // Euro
      if (currencyRes?.EURBRL) {
        const e = currencyRes.EURBRL
        n.push({ label: 'Euro', value: `R$ ${Number(e.bid).toFixed(2)}`, change: `${Number(e.pctChange) >= 0 ? '+' : ''}${Number(e.pctChange).toFixed(2)}%`, positive: Number(e.pctChange) >= 0, icon: '🇪🇺' })
      }

      // Ibovespa (usar fallback estático se não disponível via API gratuita)
      n.push({ label: 'Ibovespa', value: '---', icon: '📊' })

      // S&P 500
      n.push({ label: 'S&P 500', value: '---', icon: '🇺🇸' })

      // Nasdaq
      n.push({ label: 'Nasdaq', value: '---', icon: '💻' })

      // Selic
      if (selicRes?.[0]) {
        n.push({ label: 'Selic', value: `${Number(selicRes[0].valor).toFixed(2)}% a.a.`, icon: '🏦', positive: true })
      }

      // CDI (mesmo valor da Selic na prática)
      if (selicRes?.[0]) {
        n.push({ label: 'CDI', value: `${Number(selicRes[0].valor).toFixed(2)}% a.a.`, icon: '💰', positive: true })
      }

      // IPCA
      if (ipcaRes?.[0]) {
        n.push({ label: 'IPCA', value: `${ipcaRes[0].valor}%`, icon: '📈' })
      }

      // IFIX
      n.push({ label: 'IFIX', value: '---', icon: '🏢' })

      // Bitcoin
      if (currencyRes?.BTCBRL) {
        const b = currencyRes.BTCBRL
        n.push({ label: 'Bitcoin', value: `R$ ${(Number(b.bid) / 1000).toFixed(1)}k`, change: `${Number(b.pctChange) >= 0 ? '+' : ''}${Number(b.pctChange).toFixed(2)}%`, positive: Number(b.pctChange) >= 0, icon: '₿' })
      }

      // Ouro
      n.push({ label: 'Ouro', value: '---', icon: '🥇' })

      // Petróleo Brent
      n.push({ label: 'Petróleo Brent', value: '---', icon: '🛢️' })

      // Minério de Ferro
      n.push({ label: 'Minério de Ferro', value: '---', icon: '⛏️' })

      // VIX
      n.push({ label: 'VIX', value: '---', icon: '😨' })

      // Treasury 10Y
      n.push({ label: 'Treasury 10Y', value: '---', icon: '🇺🇸' })

      // IGP-M
      if (igpmRes?.[0]) {
        const v = Number(igpmRes[0].valor)
        n.push({ label: 'IGP-M', value: `${igpmRes[0].valor}%`, icon: '📉', positive: v <= 0 })
      }

      // Libra
      if (currencyRes?.GBPBRL) {
        const g = currencyRes.GBPBRL
        n.push({ label: 'Libra', value: `R$ ${Number(g.bid).toFixed(2)}`, change: `${Number(g.pctChange) >= 0 ? '+' : ''}${Number(g.pctChange).toFixed(2)}%`, positive: Number(g.pctChange) >= 0, icon: '🇬🇧' })
      }

      // Agora tentar buscar dados extras de APIs gratuitas
      try {
        const brapi = await fetch('https://brapi.dev/api/quote/^BVSP,^GSPC,^IXIC?token=demo').then(r => r.json()).catch(() => null)
        if (brapi?.results) {
          for (const r of brapi.results) {
            if (r.symbol === '^BVSP') {
              const idx = n.findIndex(i => i.label === 'Ibovespa')
              if (idx >= 0) n[idx] = { label: 'Ibovespa', value: `${(r.regularMarketPrice / 1000).toFixed(1)}k`, change: `${r.regularMarketChangePercent >= 0 ? '+' : ''}${r.regularMarketChangePercent.toFixed(2)}%`, positive: r.regularMarketChangePercent >= 0, icon: '📊' }
            }
            if (r.symbol === '^GSPC') {
              const idx = n.findIndex(i => i.label === 'S&P 500')
              if (idx >= 0) n[idx] = { label: 'S&P 500', value: `${r.regularMarketPrice.toFixed(0)}`, change: `${r.regularMarketChangePercent >= 0 ? '+' : ''}${r.regularMarketChangePercent.toFixed(2)}%`, positive: r.regularMarketChangePercent >= 0, icon: '🇺🇸' }
            }
            if (r.symbol === '^IXIC') {
              const idx = n.findIndex(i => i.label === 'Nasdaq')
              if (idx >= 0) n[idx] = { label: 'Nasdaq', value: `${r.regularMarketPrice.toFixed(0)}`, change: `${r.regularMarketChangePercent >= 0 ? '+' : ''}${r.regularMarketChangePercent.toFixed(2)}%`, positive: r.regularMarketChangePercent >= 0, icon: '💻' }
            }
          }
        }
      } catch {}

      // Remover items com valor "---" que não conseguimos preencher (opcional: manter para mostrar que rastreamos)
      setItems(n.filter(i => i.value !== '---' || true))
    } catch {
      setItems([
        { label: 'Dólar', value: 'R$ 5.65', change: '+0.12%', positive: true, icon: '🇺🇸' },
        { label: 'Euro', value: 'R$ 6,32', change: '+0.60%', positive: true, icon: '🇪🇺' },
        { label: 'Ibovespa', value: '131.2k', change: '+0.45%', positive: true, icon: '📊' },
        { label: 'S&P 500', value: '5,456', change: '+0.32%', positive: true, icon: '🇺🇸' },
        { label: 'Nasdaq', value: '17,234', change: '+0.67%', positive: true, icon: '💻' },
        { label: 'Selic', value: '14.75% a.a.', icon: '🏦', positive: true },
        { label: 'CDI', value: '14.65% a.a.', icon: '💰', positive: true },
        { label: 'IPCA', value: '0.58%', icon: '📈' },
        { label: 'IFIX', value: '3,245', icon: '🏢' },
        { label: 'Bitcoin', value: 'R$ 550k', change: '-2.35%', positive: false, icon: '₿' },
        { label: 'Ouro', value: 'US$ 2,340', change: '+0.18%', positive: true, icon: '🥇' },
        { label: 'Petróleo', value: 'US$ 82.4', change: '-0.52%', positive: false, icon: '🛢️' },
        { label: 'Minério', value: 'US$ 108', change: '+1.2%', positive: true, icon: '⛏️' },
        { label: 'VIX', value: '14.2', change: '-3.1%', positive: true, icon: '😨' },
        { label: 'Treasury 10Y', value: '4.28%', icon: '🇺🇸' },
      ])
    }
  }

  if (items.length === 0) return null

  return (
    <div className="relative mb-8 group">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl px-2 py-3 shadow-elevated">
        <div className="flex items-center">
          <button onClick={() => scroll(-1)} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div ref={scrollRef} className="flex-1 overflow-x-auto flex gap-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {items.map((item, i) => (
              <div key={i} className="flex-shrink-0 bg-white/[0.06] hover:bg-white/[0.1] backdrop-blur rounded-2xl px-4 py-2.5 min-w-[140px] border border-white/[0.06] transition-all duration-200 cursor-default">
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
          <button onClick={() => scroll(1)} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
