import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useFeedback } from '../components/ui'
import { FileSearch, KeyRound, RefreshCw, RotateCw, Trash2 } from 'lucide-react'

const emptyBankForm = { environment: 'sandbox', clientId: '', clientSecret: '', certificate: '', privateKey: '', pixKey: '', account: '', active: true }

function BankConfigForm() {
  const [config, setConfig] = useState<any>(null)
  const [form, setForm] = useState(emptyBankForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await api.get('/inter/bank-config')
    setConfig(data)
    setForm({
      environment: data.environment || 'sandbox', clientId: data.clientId || '', clientSecret: '',
      certificate: '', privateKey: '', pixKey: data.pixKey || '', account: data.account || '', active: data.active ?? true,
    })
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true); setMsg('')
    try {
      await api.post('/inter/bank-config', form)
      setMsg('Credenciais salvas!')
      await load()
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!config) return null

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><KeyRound className="h-4 w-4" /> Credenciais do Banco Inter (por cliente)</div>
      <p className="text-xs text-gray-500">
        {config.configured
          ? 'Este cliente tem credenciais próprias cadastradas.'
          : config.hasEnvDefaults
            ? 'Nenhuma credencial própria cadastrada — usando a configuração padrão do sistema.'
            : 'Nenhuma credencial configurada. Cadastre abaixo para emitir boletos/PIX via Banco Inter.'}
      </p>
      {msg && <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">{msg}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Ambiente</label>
          <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.environment} onChange={e => setForm({ ...form, environment: e.target.value })}>
            <option value="sandbox">Sandbox (testes)</option>
            <option value="production">Produção</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Conta / Chave PIX</label>
          <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.pixKey} onChange={e => setForm({ ...form, pixKey: e.target.value })} placeholder="chave PIX da conta" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Client ID</label>
          <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} placeholder={config.clientId || 'Client ID da aplicação API'} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Client Secret</label>
          <input type="password" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.clientSecret} onChange={e => setForm({ ...form, clientSecret: e.target.value })} placeholder={config.configured ? '••••••••' : 'Client Secret'} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-gray-500">Certificado (.crt/.pem)</label>
          <textarea className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" value={form.certificate} onChange={e => setForm({ ...form, certificate: e.target.value })} placeholder={config.hasCertificate ? 'Certificado já cadastrado — cole um novo para substituir' : '-----BEGIN CERTIFICATE-----'} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-gray-500">Chave privada (.key/.pem)</label>
          <textarea className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" value={form.privateKey} onChange={e => setForm({ ...form, privateKey: e.target.value })} placeholder={config.hasCertificate ? 'Chave já cadastrada — cole uma nova para substituir' : '-----BEGIN PRIVATE KEY-----'} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Integração ativa
      </label>
      <button onClick={save} disabled={saving} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar credenciais'}</button>
    </div>
  )
}

export function InterAdvanced() {
  const { runOperation, confirm: confirmAction } = useFeedback()
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
    await act(() => api.post(`/inter/webhook/reprocess/${id}`), 'Reprocessando webhook', 'Webhook reprocessado com sucesso')
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
    if (!codes.length || !await confirmAction({ title: 'Cancelar boletos', message: `Confirma o cancelamento de ${codes.length} boleto(s) no Banco Inter?`, confirmLabel: 'Cancelar boletos', danger: true })) return
    await act(() => api.post('/inter/cancel-batch', { codigoSolicitacoes: codes, reason: 'ACERTOS' }), 'Cancelando boletos', 'Cancelamento confirmado pelo Banco Inter')
    setBatchCodes('')
  }

  async function handleExpired(e: React.FormEvent) {
    e.preventDefault()
    await act(() => api.post(`/inter/expired/${codigo}`, { action: expiredAction, reason: 'ACERTOS' }), 'Processando boleto vencido', 'Tratamento do boleto vencido concluído')
  }

  async function act(request: () => Promise<any>, title: string, successMessage: string) {
    setError('')
    setSuccess('')
    try {
      await runOperation(request, { title, processingMessage: 'Aguardando a confirmação do Banco Inter.', successMessage, errorMessage: (error: any) => error.response?.data?.message || 'Falha na operação' })
      setSuccess(successMessage)
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

      <BankConfigForm />

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
