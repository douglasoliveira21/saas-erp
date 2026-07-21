import { useEffect, useState } from 'react'
import { Check, Search, RefreshCw, Bell, ShieldCheck, AlertTriangle, CalendarClock, Settings2 } from 'lucide-react'
import { api } from '../services/api'
import { PageHeader, Button } from '../components/ui'
import { useFeedback } from '../components/ui/FeedbackProvider'

type Tab = 'search' | 'quality' | 'approvals' | 'collections' | 'notifications' | 'closings' | 'parameters'
const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'search', label: 'Pesquisa', icon: Search }, { id: 'quality', label: 'Qualidade', icon: AlertTriangle },
  { id: 'approvals', label: 'Aprovacoes', icon: ShieldCheck }, { id: 'collections', label: 'Cobranca', icon: RefreshCw },
  { id: 'notifications', label: 'Notificacoes', icon: Bell }, { id: 'closings', label: 'Fechamento fiscal', icon: CalendarClock },
  { id: 'parameters', label: 'Parametros fiscais', icon: Settings2 },
]

export function Operations() {
  const [tab, setTab] = useState<Tab>('search')
  const [rows, setRows] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const feedback = useFeedback()
  const endpoints: Record<Tab, string> = {
    search: `operations/search?q=${encodeURIComponent(query)}`, quality: 'operations/data-quality', approvals: 'operations/approvals',
    collections: 'operations/collections', notifications: 'operations/notifications', closings: 'operations/fiscal-closings', parameters: 'operations/fiscal-parameters',
  }
  async function load() {
    if (tab === 'search' && query.trim().length < 2) { setRows([]); return }
    setLoading(true)
    try { setRows((await api.get(endpoints[tab])).data || []) } catch (e:any) { feedback.notify(e.response?.data?.message || 'Falha ao carregar dados','error') } finally { setLoading(false) }
  }
  useEffect(() => { if (tab !== 'search') load() }, [tab])
  async function review(id:string) { await api.post(`operations/approvals/${id}/review`,{}); feedback.notify('Aprovacao registrada','success'); load() }
  async function notify(id:string, action:string) { await api.patch(`operations/notifications/${id}/${action}`,{}); load() }
  async function closePeriod() {
    const period = window.prompt('Periodo fiscal (AAAA-MM)')
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return
    await api.post('operations/fiscal-closings',{period}); feedback.notify('Periodo fiscal fechado','success'); load()
  }
  return <div className="space-y-5">
    <PageHeader title="Controles ERP" description="Governanca, pesquisa e operacoes administrativas" />
    <div className="flex gap-1 overflow-x-auto border-b border-gray-200">{tabs.map(t => <button key={t.id} onClick={()=>setTab(t.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm ${tab===t.id?'border-primary-600 text-primary-700':'border-transparent text-gray-600'}`}><t.icon size={16}/>{t.label}</button>)}</div>
    {tab==='search' && <form className="flex max-w-2xl gap-2" onSubmit={e=>{e.preventDefault();load()}}><input value={query} onChange={e=>setQuery(e.target.value)} className="input flex-1" placeholder="Cliente, venda, boleto, nota ou documento"/><Button type="submit"><Search size={16}/>Pesquisar</Button></form>}
    {tab==='closings' && <Button onClick={closePeriod}><CalendarClock size={16}/>Fechar periodo</Button>}
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">{loading ? <div className="p-8 text-center text-gray-500">Carregando...</div> : rows.length===0 ? <div className="p-8 text-center text-gray-500">Nenhum registro</div> : <div className="divide-y divide-gray-100">{rows.map((r,i)=><div key={r.id||i} className="flex items-start justify-between gap-4 p-4"><div className="min-w-0"><div className="font-medium text-gray-900">{r.title||r.name||r.description||r.period||r.message||r.type}</div><div className="mt-1 text-sm text-gray-500">{r.subtitle||r.reason||r.notes||r.category||r.status||''}</div>{r.missing && <div className="mt-1 text-sm text-red-600">Faltando: {r.missing.join(', ')}</div>}{r.code && <span className="mt-1 inline-block font-mono text-xs text-gray-500">{r.code}</span>}</div><div className="flex shrink-0 gap-2">{tab==='approvals' && !['aprovada','rejeitada'].includes(r.status) && <Button size="sm" onClick={()=>review(r.id)}><Check size={15}/>Aprovar etapa</Button>}{tab==='notifications' && r.status==='nova' && <Button size="sm" variant="secondary" onClick={()=>notify(r.id,'read')}>Marcar lida</Button>}{tab==='notifications' && r.status!=='resolvida' && <Button size="sm" onClick={()=>notify(r.id,'resolve')}>Resolver</Button>}</div></div>)}</div>}</div>
  </div>
}
