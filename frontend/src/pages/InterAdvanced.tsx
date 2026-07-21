import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { FileSearch, RefreshCw, RotateCw, Trash2 } from 'lucide-react'

export function InterAdvanced() {
  const [logs, setLogs] = useState<any[]>([])
  const [codigo, setCodigo] = useState('')
  const [compare, setCompare] = useState<any>(null)
  const [batchCodes, setBatchCodes] = useState('')
  const [expiredAction, setExpiredAction] = useState('manter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    setLoading(true)
    setError('')
    try {
      setLogs((await api.get('/inter/webhook-logs')).data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  async function reprocess(id: string) {
    await act(() => api.post(`/inter/webhook/reprocess/${id}`), 'Webhook reprocessado')
  }

  async function comparePayment(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      setCompare((await api.get(`/inter/compare/${codigo}`)).data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao comparar boleto')
    }
  }

  async function cancelBatch(e: React.FormEvent) {
    e.preventDefault()
    const codes = batchCodes.split(/\r?\n|,/).map((c) => c.trim()).filter(Boolean)
    await act(() => api.post('/inter/cancel-batch', { codigoSolicitacoes: codes, reason: 'ACERTOS' }), 'Cancelamento em lote enviado')
    setBatchCodes('')
  }

  async function handleExpired(e: React.FormEvent) {
    e.preventDefault()
    await act(() => api.post(`/inter/expired/${codigo}`, { action: expiredAction, reason: 'ACERTOS' }), 'Tratamento de vencido executado')
  }

  async function act(request: () => Promise<any>, message: string) {
    setError('')
    setSuccess('')
    try {
      await request()
      setSuccess(message)
      await loadLogs()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha na operação')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banco Inter Avançado</h1>
          <p className="text-sm text-gray-500">Logs, reprocessamento, comparação, vencidos e cancelamento em lote.</p>
        </div>
        <button onClick={loadLogs} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900"><RotateCw className="h-4 w-4" /> Logs do webhook</div>
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Ação</th><th className="px-3 py-2 text-left">Entidade</th><th className="px-3 py-2 text-left">Ações</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">Carregando...</td></tr>}
                {!loading && logs.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">Nenhum log</td></tr>}
                {!loading && logs.map((log) => <tr key={log.id}><td className="px-3 py-2">{new Date(log.createdAt).toLocaleString('pt-BR')}</td><td className="px-3 py-2">{log.action}</td><td className="px-3 py-2">{log.entityId || '-'}</td><td className="px-3 py-2"><button onClick={() => reprocess(log.id)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">Reprocessar</button></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={comparePayment} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><FileSearch className="h-4 w-4" /> Comparar local x Inter</div>
            <input required value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código de solicitação" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">Comparar</button>
            {compare && <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(compare, null, 2)}</pre>}
          </form>

          <form onSubmit={handleExpired} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Boleto vencido</div>
            <select value={expiredAction} onChange={(e) => setExpiredAction(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="manter">Manter vencido</option>
              <option value="cancelar">Cancelar</option>
              <option value="segunda_via">Emitir segunda via</option>
            </select>
            <button className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium">Executar</button>
          </form>

          <form onSubmit={cancelBatch} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Trash2 className="h-4 w-4" /> Cancelamento em lote</div>
            <textarea required value={batchCodes} onChange={(e) => setBatchCodes(e.target.value)} placeholder="Um código por linha" className="min-h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white">Cancelar boletos</button>
          </form>
        </div>
      </section>
    </div>
  )
}
