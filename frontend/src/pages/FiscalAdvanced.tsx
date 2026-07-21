import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { AlertTriangle, FileText, RefreshCw, RotateCw, XCircle } from 'lucide-react'

type Tab = 'queue' | 'rejections' | 'events' | 'invalidate'

export function FiscalAdvanced() {
  const [tab, setTab] = useState<Tab>('queue')
  const [queue, setQueue] = useState<any[]>([])
  const [rejections, setRejections] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [correctionText, setCorrectionText] = useState('')
  const [invalidateForm, setInvalidateForm] = useState({ model: '55', certId: '', series: '1', startNumber: '', endNumber: '', reason: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { load() }, [tab])
  useEffect(() => { api.get('/fiscal/certificates').then(({ data }) => { setCertificates(data); const active = data.find((item: any) => item.isActive); if (active) setInvalidateForm((form) => ({ ...form, certId: active.id })) }) }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (tab === 'queue') setQueue((await api.get('/fiscal/queue')).data)
      if (tab === 'rejections') setRejections((await api.get('/fiscal/rejections')).data)
      if (tab === 'events') setEvents((await api.get('/fiscal/events')).data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar fiscal')
    } finally {
      setLoading(false)
    }
  }

  async function retry(id: string) {
    await act(() => api.post(`/fiscal/invoices/${id}/retry`), 'Retry enviado')
  }

  async function checkStatus(id: string) {
    await act(() => api.post(`/fiscal/invoices/${id}/check-status`), 'Consulta registrada')
  }

  async function correctionLetter(e: React.FormEvent) {
    e.preventDefault()
    await act(() => api.post(`/fiscal/invoices/${selectedInvoiceId}/correction-letter`, { text: correctionText }), 'Carta de correção registrada')
    setCorrectionText('')
  }

  async function invalidate(e: React.FormEvent) {
    e.preventDefault()
    await act(() => api.post('/fiscal/numbering/invalidate', invalidateForm), 'Inutilização registrada')
  }

  async function act(request: () => Promise<any>, message: string) {
    setError('')
    setSuccess('')
    try {
      await request()
      setSuccess(message)
      await load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha na operação')
    }
  }

  const invoices = tab === 'queue' ? queue : rejections

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fiscal Avançado</h1>
          <p className="text-sm text-gray-500">Fila, rejeições, retry, status, carta de correção e inutilização.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {[
          ['queue', 'Fila'],
          ['rejections', 'Rejeições'],
          ['events', 'Eventos'],
          ['invalidate', 'Inutilização'],
        ].map(([id, label]) => <button key={id} onClick={() => setTab(id as Tab)} className={`px-3 py-2 text-sm font-medium ${tab === id ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}`}>{label}</button>)}
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      {(tab === 'queue' || tab === 'rejections') && (
        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">
              {tab === 'queue' ? <RotateCw className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {tab === 'queue' ? 'Fila fiscal' : 'Rejeições fiscais'}
            </div>
            <Table loading={loading} rows={invoices} cols={['type', 'number', 'series', 'status', 'queueStatus', 'retryCount', 'rejectionReason']} labels={['Tipo', 'Número', 'Série', 'Status', 'Fila', 'Retry', 'Motivo']} actions={(row) => (
              <div className="flex gap-2">
                <button onClick={() => retry(row.id)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">Retry</button>
                <button onClick={() => checkStatus(row.id)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">Status</button>
                <button onClick={() => setSelectedInvoiceId(row.id)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">CC-e</button>
              </div>
            )} />
          </div>

          <form onSubmit={correctionLetter} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><FileText className="h-4 w-4" /> Carta de correção</div>
            <input required value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)} placeholder="ID da nota" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <textarea required value={correctionText} onChange={(e) => setCorrectionText(e.target.value)} placeholder="Correção" className="min-h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">Registrar</button>
          </form>
        </section>
      )}

      {tab === 'events' && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <Table loading={loading} rows={events} cols={['createdAt', 'type', 'status', 'message', 'invoiceId']} labels={['Data', 'Tipo', 'Status', 'Mensagem', 'Nota']} />
        </div>
      )}

      {tab === 'invalidate' && (
        <form onSubmit={invalidate} className="max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><XCircle className="h-4 w-4" /> Inutilização de numeração</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">Modelo</span><select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={invalidateForm.model} onChange={(e) => setInvalidateForm({ ...invalidateForm, model: e.target.value })}><option value="55">55 - NF-e</option><option value="65">65 - NFC-e</option></select></label>
            <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">Certificado</span><select required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={invalidateForm.certId} onChange={(e) => setInvalidateForm({ ...invalidateForm, certId: e.target.value })}><option value="">Selecione</option>{certificates.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <Field label="Série" value={invalidateForm.series} onChange={(v) => setInvalidateForm({ ...invalidateForm, series: v })} />
            <Field label="Número inicial" value={invalidateForm.startNumber} onChange={(v) => setInvalidateForm({ ...invalidateForm, startNumber: v })} />
            <Field label="Número final" value={invalidateForm.endNumber} onChange={(v) => setInvalidateForm({ ...invalidateForm, endNumber: v })} />
          </div>
          <textarea required value={invalidateForm.reason} onChange={(e) => setInvalidateForm({ ...invalidateForm, reason: e.target.value })} placeholder="Justificativa" className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">Registrar inutilização</button>
        </form>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{label}</span><input required value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
}

function Table({ rows, cols, labels, loading = false, actions }: { rows: any[]; cols: string[]; labels: string[]; loading?: boolean; actions?: (row: any) => React.ReactNode }) {
  return <div className="overflow-auto"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50"><tr>{labels.map((l) => <th key={l} className="px-3 py-2 text-left font-semibold text-gray-600">{l}</th>)}{actions && <th className="px-3 py-2 text-left font-semibold text-gray-600">Ações</th>}</tr></thead><tbody className="divide-y divide-gray-100">{loading && <tr><td colSpan={cols.length + (actions ? 1 : 0)} className="px-3 py-8 text-center text-gray-500">Carregando...</td></tr>}{!loading && rows.length === 0 && <tr><td colSpan={cols.length + (actions ? 1 : 0)} className="px-3 py-8 text-center text-gray-500">Nenhum registro</td></tr>}{!loading && rows.map((row) => <tr key={row.id}>{cols.map((col) => <td key={col} className="max-w-xs truncate px-3 py-2 text-gray-700" title={String(row[col] ?? '')}>{col === 'createdAt' && row[col] ? new Date(row[col]).toLocaleString('pt-BR') : String(row[col] ?? '-')}</td>)}{actions && <td className="px-3 py-2">{actions(row)}</td>}</tr>)}</tbody></table></div>
}
