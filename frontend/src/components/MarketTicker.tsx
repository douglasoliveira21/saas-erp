import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../services/api'

interface TickerItem {
  label: string
  value: string
  change?: string
  positive?: boolean
  icon?: string
}

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
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
      const { data: serverQuotes } = await api.get('/market/quotes')
      const quotes = { ...(serverQuotes || {}) }
      if (!quotes.USD || !quotes.EUR || !quotes.BTC || !quotes.GBP || !quotes.ETH) {
        try {
          const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL,GBP-BRL,ETH-BRL')
          if (response.ok) {
            const currencies = await response.json()
            if (!quotes.USD && currencies?.USDBRL) quotes.USD = { value: currencies.USDBRL.bid, change: currencies.USDBRL.pctChange }
            if (!quotes.EUR && currencies?.EURBRL) quotes.EUR = { value: currencies.EURBRL.bid, change: currencies.EURBRL.pctChange }
            if (!quotes.BTC && currencies?.BTCBRL) quotes.BTC = { value: currencies.BTCBRL.bid, change: currencies.BTCBRL.pctChange }
            if (!quotes.GBP && currencies?.GBPBRL) quotes.GBP = { value: currencies.GBPBRL.bid, change: currencies.GBPBRL.pctChange }
            if (!quotes.ETH && currencies?.ETHBRL) quotes.ETH = { value: currencies.ETHBRL.bid, change: currencies.ETHBRL.pctChange }
          }
        } catch {}
      }
      const next: TickerItem[] = []
      const add = (key: string, label: string, icon: string, format: (value: number | string) => string) => {
        const quote = quotes?.[key]
        if (!quote || quote.value === undefined || quote.value === null) return
        const change = quote.change === undefined ? undefined : Number(quote.change)
        const hasChange = typeof change === 'number' && Number.isFinite(change)
        next.push({
          label,
          icon,
          value: format(quote.value),
          change: hasChange ? `${change! >= 0 ? '+' : ''}${change!.toFixed(2)}%` : undefined,
          positive: hasChange ? change! >= 0 : undefined,
        })
      }

      add('USD', 'Dólar', '🇺🇸', value => `R$ ${Number(value).toFixed(2)}`)
      add('EUR', 'Euro', '🇪🇺', value => `R$ ${Number(value).toFixed(2)}`)
      add('IBOV', 'Ibovespa', '📊', value => `${(Number(value) / 1000).toFixed(1)}k`)
      add('SP500', 'S&P 500', '🇺🇸', value => Number(value).toFixed(0))
      add('NASDAQ', 'Nasdaq', '💻', value => Number(value).toFixed(0))
      add('SELIC', 'Selic', '🏦', value => `${Number(value).toFixed(2)}% a.a.`)
      add('SELIC', 'CDI', '💰', value => `${Number(value).toFixed(2)}% a.a.`)
      add('IPCA', 'IPCA mensal', '📈', value => `${value}%`)
      add('IPCA12', 'IPCA 12 meses', '📊', value => `${value}%`)
      add('INPC', 'INPC', '🧾', value => `${value}%`)
      add('IPCA15', 'IPCA-15', '📅', value => `${value}%`)
      add('IFIX', 'IFIX', '🏢', value => Number(value).toFixed(0))
      add('BTC', 'Bitcoin', '₿', value => `R$ ${(Number(value) / 1000).toFixed(1)}k`)
      add('ETH', 'Ethereum', '◆', value => `R$ ${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`)
      add('IGPM', 'IGP-M mensal', '📉', value => `${value}%`)
      add('IGPM12', 'IGP-M 12 meses', '📋', value => `${value}%`)
      add('GBP', 'Libra', '🇬🇧', value => `R$ ${Number(value).toFixed(2)}`)
      setItems(next)
      setLastUpdated(quotes.updatedAt || new Date().toISOString())
    } catch {
      setItems([])
      setLastUpdated(null)
    }
  }

  if (items.length === 0) return null

  return (
    <div className="relative mb-8 group">
      <div className="bg-white border border-gray-200 rounded-3xl px-2 py-3 shadow-elevated">
        {lastUpdated && <div className="px-10 pb-2 text-right text-[10px] text-gray-500">Atualizado em {new Date(lastUpdated).toLocaleString('pt-BR')}</div>}
        <div className="flex items-center">
          <button onClick={() => scroll(-1)} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div ref={scrollRef} className="flex-1 overflow-x-auto flex gap-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {items.map((item, i) => (
              <div key={i} className="flex-shrink-0 bg-gray-50 hover:bg-gray-100 rounded-2xl px-4 py-2.5 min-w-[140px] border border-gray-200 transition-all duration-200 cursor-default">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-[11px] text-gray-500 font-medium">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-900 font-semibold text-sm">{item.value}</span>
                  {item.change && (
                    <span className={`text-[10px] font-semibold ${item.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => scroll(1)} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
