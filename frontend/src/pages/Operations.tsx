import { useEffect, useState } from 'react'
import { Activity, Check, Search, RefreshCw, Bell, ShieldCheck, AlertTriangle, CalendarClock, Settings2, Eye, XCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { api } from '../services/api'
import { PageHeader, Button, Modal } from '../components/ui'
import { useFeedback } from '../components/ui/FeedbackProvider'

type Tab = 'executions' | 'search' | 'quality' | 'approvals' | 'collections' | 'notifications' | 'closings' | 'parameters'
const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'executions', label: 'Operações', icon: Activity }, { id: 'search', label: 'Pesquisa', icon: Search }, { id: 'quality', label: 'Qualidade', icon: AlertTriangle },
  { id: 'approvals', label: 'Aprovações', icon: ShieldCheck }, { id: 'collections', label: 'Cobrança', icon: RefreshCw },
  { id: 'notifications', label: 'Notificações', icon: Bell }, { id: 'closings', label: 'Fechamento fiscal', icon: CalendarClock },
  { id: 'parameters', label: 'Parâmetros fiscais', icon: Settings2 },
]
const statusStyle: Record<string,string> = { concluida:'bg-green-50 text-green-700 border-green-200', parcial:'bg-amber-50 text-amber-700 border-amber-200', falha:'bg-red-50 text-red-700 border-red-200', processando:'bg-blue-50 text-blue-700 border-blue-200' }
const statusLabel: Record<string,string> = { concluida:'Concluída', parcial:'Concluída parcialmente', falha:'Falhou', processando:'Processando' }
const statusIcon: Record<string,any> = { concluida:CheckCircle2, parcial:AlertTriangle, falha:XCircle, processando:Loader2 }

export function Operations() {
  const [tab, setTab] = useState<Tab>('executions')
  const [rows, setRows] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const feedback = useFeedback()
  const endpoints: Record<Tab, string> = {
    executions: `operations/executions${statusFilter ? `?status=${statusFilter}` : ''}`,
    search: `operations/search?q=${encodeURIComponent(query)}`, quality: 'operations/data-quality', approvals: 'operations/approvals',
    collections: 'operations/collections', notifications: 'operations/notifications', closings: 'operations/fiscal-closings', parameters: 'operations/fiscal-parameters',
  }
  async function load(silent=false) {
    if (tab === 'search' && query.trim().length < 2) { setRows([]); return }
    if (!silent) setLoading(true)
    try { setRows((await api.get(endpoints[tab])).data || []) } catch (e:any) { if(!silent) feedback.notify(e.response?.data?.message || 'Falha ao carregar dados','error') } finally { if(!silent) setLoading(false) }
  }
  useEffect(() => { if (tab !== 'search') load(); if(tab!=='executions') return; const timer=window.setInterval(()=>load(true),10000); return()=>window.clearInterval(timer) }, [tab,statusFilter])
  async function showExecution(id:string) { try { setDetail((await api.get(`operations/executions/${id}`)).data) } catch(e:any){ feedback.notify(e.response?.data?.message||'Falha ao abrir operação','error') } }
  async function review(id:string) { await feedback.runOperation(()=>api.post(`operations/approvals/${id}/review`,{}),{title:'Registrando aprovação',successMessage:'Aprovação registrada com sucesso'}); load() }
  async function notify(id:string, action:string) { await api.patch(`operations/notifications/${id}/${action}`,{}); load() }
  async function closePeriod() {
    const period = window.prompt('Período fiscal (AAAA-MM)')
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return
    await feedback.runOperation(()=>api.post('operations/fiscal-closings',{period}),{title:'Fechando período fiscal',processingMessage:'Validando movimentos e registrando o fechamento.',successMessage:'Período fiscal fechado e confirmado.'}); load()
  }
  return <div className="space-y-5">
    <PageHeader title="Central de Operações" description="Confirmação, rastreabilidade e diagnóstico das ações executadas no ERP" />
    <div className="flex gap-1 overflow-x-auto border-b border-gray-200">{tabs.map(t => <button key={t.id} onClick={()=>setTab(t.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm ${tab===t.id?'border-primary-600 text-primary-700':'border-transparent text-gray-600'}`}><t.icon size={16}/>{t.label}</button>)}</div>
    {tab==='executions' && <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4"><select className="input max-w-xs" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Todos os estados</option><option value="processando">Processando</option><option value="concluida">Concluídas</option><option value="parcial">Parciais</option><option value="falha">Falhas</option></select><Button variant="secondary" onClick={()=>load()}><RefreshCw size={16}/>Atualizar</Button><span className="text-xs text-gray-500">Atualização automática a cada 10 segundos</span></div>}
    {tab==='search' && <form className="flex max-w-2xl gap-2" onSubmit={e=>{e.preventDefault();load()}}><input value={query} onChange={e=>setQuery(e.target.value)} className="input flex-1" placeholder="Cliente, venda, boleto, nota ou documento"/><Button type="submit"><Search size={16}/>Pesquisar</Button></form>}
    {tab==='closings' && <Button onClick={closePeriod}><CalendarClock size={16}/>Fechar período</Button>}
    {tab==='executions' ? <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{loading?<div className="p-10 text-center text-gray-500">Carregando operações...</div>:rows.length===0?<div className="p-10 text-center text-gray-500">Nenhuma operação registrada.</div>:<div className="divide-y divide-gray-100">{rows.map(r=>{const Icon=statusIcon[r.status]||Activity;return <button key={r.id} onClick={()=>showExecution(r.id)} className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-gray-50"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${statusStyle[r.status]||'bg-gray-50'}`}><Icon className={`h-5 w-5 ${r.status==='processando'?'animate-spin':''}`}/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-gray-900">{r.title}</strong><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle[r.status]||''}`}>{statusLabel[r.status]||r.status}</span></span><span className="mt-1 block truncate text-xs text-gray-500">{r.module} · {r.userName||'Sistema'} · {new Date(r.startedAt).toLocaleString('pt-BR')}</span>{r.message&&<span className="mt-1 block text-xs text-gray-600">{r.message}</span>}</span><span className="shrink-0 text-right text-xs text-gray-400">{r.durationMs!=null?`${(r.durationMs/1000).toFixed(1)}s`:'em andamento'}<Eye className="ml-auto mt-1 h-4 w-4"/></span></button>})}</div>}</div>:
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">{loading ? <div className="p-8 text-center text-gray-500">Carregando...</div> : rows.length===0 ? <div className="p-8 text-center text-gray-500">Nenhum registro</div> : <div className="divide-y divide-gray-100">{rows.map((r,i)=><div key={r.id||i} className="flex items-start justify-between gap-4 p-4"><div className="min-w-0"><div className="font-medium text-gray-900">{r.title||r.name||r.description||r.period||r.message||r.type}</div><div className="mt-1 text-sm text-gray-500">{r.subtitle||r.reason||r.notes||r.category||r.status||''}</div>{r.missing && <div className="mt-1 text-sm text-red-600">Faltando: {r.missing.join(', ')}</div>}{r.code && <span className="mt-1 inline-block font-mono text-xs text-gray-500">{r.code}</span>}</div><div className="flex shrink-0 gap-2">{tab==='approvals' && !['aprovada','rejeitada'].includes(r.status) && <Button size="sm" onClick={()=>review(r.id)}><Check size={15}/>Aprovar etapa</Button>}{tab==='notifications' && r.status==='nova' && <Button size="sm" variant="secondary" onClick={()=>notify(r.id,'read')}>Marcar lida</Button>}{tab==='notifications' && r.status!=='resolvida' && <Button size="sm" onClick={()=>notify(r.id,'resolve')}>Resolver</Button>}</div></div>)}</div>}</div>}
    <Modal open={Boolean(detail)} title={detail?.title||'Detalhes da operação'} description={detail?`${detail.module} · ${statusLabel[detail.status]||detail.status}`:undefined} onClose={()=>setDetail(null)} size="lg" footer={<Button variant="secondary" onClick={()=>setDetail(null)}>Fechar</Button>}><div className="space-y-4">{detail&&<><div className={`rounded-xl border p-4 ${statusStyle[detail.status]||''}`}><strong>{statusLabel[detail.status]||detail.status}</strong><p className="mt-1 text-sm">{detail.message||detail.error_message||'Sem mensagem adicional.'}</p></div><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">Usuário</dt><dd className="font-medium">{detail.userName||'Sistema'}</dd></div><div><dt className="text-gray-500">Duração</dt><dd className="font-medium">{detail.duration_ms!=null?`${(detail.duration_ms/1000).toFixed(2)} segundos`:'Em andamento'}</dd></div><div><dt className="text-gray-500">Entidade</dt><dd className="font-medium">{detail.entity_type||'-'} {detail.entity_id||''}</dd></div><div><dt className="text-gray-500">Início</dt><dd className="font-medium">{new Date(detail.started_at).toLocaleString('pt-BR')}</dd></div></dl>{detail.error_message&&<div className="rounded-xl bg-red-50 p-4 text-sm text-red-700"><strong>Erro confirmado</strong><p className="mt-1 whitespace-pre-wrap">{detail.error_message}</p></div>}<details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Resposta técnica resumida</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-gray-600">{JSON.stringify(detail.response_summary||{},null,2)}</pre></details></>}</div></Modal>
  </div>
}