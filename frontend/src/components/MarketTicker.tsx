import { useEffect, useState } from 'react'

interface TickerItem {
  label: string
  value: string
  change?: string
  positive?: boolean
}

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [dateTime, setDateTime] = useState(new Date())

  useEffect(() => {
    fetchMarketData()
    // Atualizar data/hora a cada segundo
    const clockInterval = setInterval(() => setDateTime(new Date()), 1000)
    // Atualizar dados a cada 5 minutos
    const dataInterval = setInterval(fetchMarketData, 300000)
    return () => { clearInterval(clockInterval); clearInterval(dataInterval) }
  }, [])

  async function fetchMarketData() {
    try {
      // API do Banco Central (ptax/cotacoes) e AwesomeAPI (dólar, bitcoin, etc)
      const [currencyRes, selic] = await Promise.all([
        fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL,GBP-BRL').then(r => r.json()).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json').then(r => r.json()).catch(() => null),
      ])

      const newItems: TickerItem[] = []

      // Dólar
      if (currencyRes?.USDBRL) {
        const usd = currencyRes.USDBRL
        newItems.push({
          label: 'Dólar',
          value: `R$ ${Number(usd.bid).toFixed(2)}`,
          change: `${Number(usd.pctChange) >= 0 ? '+' : ''}${Number(usd.pctChange).toFixed(2)}%`,
          positive: Number(usd.pctChange) >= 0,
        })
      }

      // Euro
      if (currencyRes?.EURBRL) {
        const eur = currencyRes.EURBRL
        newItems.push({
          label: 'Euro',
          value: `R$ ${Number(eur.bid).toFixed(2)}`,
          change: `${Number(eur.pctChange) >= 0 ? '+' : ''}${Number(eur.pctChange).toFixed(2)}%`,
          positive: Number(eur.pctChange) >= 0,
        })
      }

      // Bitcoin
      if (currencyRes?.BTCBRL) {
        const btc = currencyRes.BTCBRL
        const btcVal = Number(btc.bid)
        newItems.push({
          label: 'Bitcoin',
          value: btcVal >= 1000 ? `R$ ${(btcVal / 1000).toFixed(1)}k` : `R$ ${btcVal.toFixed(0)}`,
          change: `${Number(btc.pctChange) >= 0 ? '+' : ''}${Number(btc.pctChange).toFixed(2)}%`,
          positive: Number(btc.pctChange) >= 0,
        })
      }

      // Libra
      if (currencyRes?.GBPBRL) {
        const gbp = currencyRes.GBPBRL
        newItems.push({
          label: 'Libra',
          value: `R$ ${Number(gbp.bid).toFixed(2)}`,
          change: `${Number(gbp.pctChange) >= 0 ? '+' : ''}${Number(gbp.pctChange).toFixed(2)}%`,
          positive: Number(gbp.pctChange) >= 0,
        })
      }

      // CDI/Selic (taxa anual)
      if (selic && selic.length > 0) {
        newItems.push({
          label: 'Selic/CDI',
          value: `${Number(selic[0].valor).toFixed(2)}% a.a.`,
          positive: true,
        })
      }

      // Tentar buscar IPCA, IFIX etc (dados estáticos como fallback)
      try {
        const ipca = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json').then(r => r.json())
        if (ipca?.[0]) {
          newItems.push({ label: 'IPCA', value: `${ipca[0].valor}% (mês)` })
        }
      } catch {}

      try {
        const igpm = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados/ultimos/1?formato=json').then(r => r.json())
        if (igpm?.[0]) {
          newItems.push({ label: 'IGP-M', value: `${igpm[0].valor}% (mês)` })
        }
      } catch {}

      // Adicionar indicadores estáticos como placeholder se APIs não retornarem
      if (newItems.length < 5) {
        if (!newItems.find(i => i.label === 'Selic/CDI')) {
          newItems.push({ label: 'CDI', value: '14,75% a.a.' })
        }
      }

      // Duplicar para loop infinito
      setItems(newItems)
    } catch {
      // Fallback com dados estáticos
      setItems([
        { label: 'Dólar', value: 'R$ 5,65', change: '+0.12%', positive: true },
        { label: 'Euro', value: 'R$ 6,32', change: '-0.05%', positive: false },
        { label: 'Bitcoin', value: 'R$ 550k', change: '+1.20%', positive: true },
        { label: 'CDI', value: '14,75% a.a.', positive: true },
        { label: 'IPCA', value: '0,44% (mês)' },
        { label: 'IGP-M', value: '0,53% (mês)' },
      ])
    }
  }

  const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (items.length === 0) return null

  // Duplicar itens para loop contínuo
  const tickerItems = [...items, ...items, ...items]

  return (
    <div className="mb-6">
      {/* Data e hora */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500 capitalize">{formatDate(dateTime)}</p>
        <p className="text-sm font-mono text-gray-600 dark:text-gray-400">{formatTime(dateTime)}</p>
      </div>

      {/* Ticker bar */}
      <div className="relative overflow-hidden bg-gray-900 dark:bg-gray-800 rounded-lg py-2.5">
        <div className="ticker-scroll flex items-center gap-8 whitespace-nowrap">
          {tickerItems.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-sm">
              <span className="text-gray-400 font-medium">{item.label}</span>
              <span className="text-white font-semibold">{item.value}</span>
              {item.change && (
                <span className={`text-xs font-medium ${item.positive ? 'text-green-400' : 'text-red-400'}`}>
                  {item.change}
                </span>
              )}
              <span className="text-gray-600 mx-2">|</span>
            </span>
          ))}
        </div>
      </div>

      {/* CSS para animação */}
      <style>{`
        .ticker-scroll {
          animation: ticker 40s linear infinite;
        }
        .ticker-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  )
}
