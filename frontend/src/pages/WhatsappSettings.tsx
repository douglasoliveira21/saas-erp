import { useEffect, useState } from 'react'
import { QrCode, RefreshCw, Power, Save, MessageCircle } from 'lucide-react'
import { api } from '../services/api'
import { Button, PageHeader, useFeedback } from '../components/ui'
import { getErrorMessage } from '../services/errors'

interface Config {
  apiUrl: string
  apiKey: string | null
  instanceName: string
  connectionStatus: string
  phoneNumber: string | null
  lastCheckedAt: string | null
  lastError: string | null
  notifyServiceOrders: boolean
  hasEnvDefaults: boolean
}

const statusLabels: Record<string, string> = { conectado: 'Conectado', conectando: 'Conectando', desconectado: 'Desconectado', erro: 'Erro' }
const statusColors: Record<string, string> = { conectado: 'bg-green-100 text-green-700', conectando: 'bg-yellow-100 text-yellow-700', desconectado: 'bg-gray-100 text-gray-600', erro: 'bg-red-100 text-red-700' }

export function WhatsappSettings() {
  const { notify, confirm } = useFeedback()
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ apiUrl: '', apiKey: '', instanceName: '', notifyServiceOrders: true })
  const [saving, setSaving] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [testing, setTesting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/whatsapp/config')
      setConfig(res.data)
      setForm({
        apiUrl: res.data.apiUrl || '',
        apiKey: '',
        instanceName: res.data.instanceName || '',
        notifyServiceOrders: res.data.notifyServiceOrders,
      })
    } catch {
      notify('Não foi possível carregar a configuração do WhatsApp', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const timer = window.setInterval(load, 60000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveConfig() {
    setSaving(true)
    try {
      const payload: any = { apiUrl: form.apiUrl, instanceName: form.instanceName, notifyServiceOrders: form.notifyServiceOrders }
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim()
      const res = await api.patch('/whatsapp/config', payload)
      setConfig(res.data)
      setForm(prev => ({ ...prev, apiKey: '' }))
      notify('Configuração salva', 'success')
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao salvar configuração'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function generateQrCode() {
    setLoadingQr(true)
    setQrCode(null)
    try {
      const res = await api.get('/whatsapp/qrcode')
      if (!res.data.base64) { notify('A instância já pode estar conectada, ou a API não retornou um QR Code.', 'info'); return }
      setQrCode(res.data.base64)
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao gerar QR Code'), 'error')
    } finally {
      setLoadingQr(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      const res = await api.post('/whatsapp/test-connection')
      setConfig(prev => prev ? { ...prev, ...res.data } : prev)
      notify(`Status: ${statusLabels[res.data.connectionStatus] || res.data.connectionStatus}`, res.data.connectionStatus === 'conectado' ? 'success' : 'info')
      if (res.data.connectionStatus === 'conectado') setQrCode(null)
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao testar conexão'), 'error')
    } finally {
      setTesting(false)
    }
  }

  async function disconnect() {
    const ok = await confirm({ title: 'Desconectar WhatsApp', message: 'A instância será desconectada e será preciso escanear o QR Code novamente.', confirmLabel: 'Desconectar', danger: true })
    if (!ok) return
    try {
      await api.post('/whatsapp/disconnect')
      notify('WhatsApp desconectado', 'success')
      load()
    } catch (e: any) {
      notify(getErrorMessage(e, 'Erro ao desconectar'), 'error')
    }
  }

  if (loading || !config) {
    return <div className="flex justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="WhatsApp"
        description="Integração com a Evolution API para notificações automáticas"
      />

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Status da conexão</p>
          <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${statusColors[config.connectionStatus] || statusColors.desconectado}`}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {statusLabels[config.connectionStatus] || config.connectionStatus}
          </span>
          {config.phoneNumber && <p className="mt-1 text-xs text-gray-500">Número conectado: {config.phoneNumber}</p>}
          {config.lastCheckedAt && <p className="text-xs text-gray-400">Último teste: {new Date(config.lastCheckedAt).toLocaleString('pt-BR')} (testado automaticamente a cada minuto)</p>}
          {config.lastError && <p className="text-xs text-red-500">{config.lastError}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={testConnection} loading={testing}><RefreshCw className="h-4 w-4" aria-hidden="true" />Testar agora</Button>
          {config.connectionStatus === 'conectado' && <Button variant="danger" onClick={disconnect}><Power className="h-4 w-4" aria-hidden="true" />Desconectar</Button>}
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Configuração da API (Evolution)</h2>
        <p className="text-xs text-gray-500">Deixe em branco para usar as variáveis de ambiente do servidor (EVOLUTION_API_URL / EVOLUTION_API_KEY), se configuradas.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">URL da API</label>
            <input className="input" placeholder="https://evolution.vgon.com.br" value={form.apiUrl} onChange={e => setForm({ ...form, apiUrl: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nome da instância</label>
            <input className="input" placeholder="vgon" value={form.instanceName} onChange={e => setForm({ ...form, instanceName: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Chave da API (apikey)</label>
          <input className="input" type="password" placeholder={config.apiKey ? '••••••••  (já configurada, deixe em branco para manter)' : 'Cole a chave da API'} value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={form.notifyServiceOrders} onChange={e => setForm({ ...form, notifyServiceOrders: e.target.checked })} />
          Enviar atualizações de Ordens de Serviço automaticamente pelo WhatsApp do cliente
        </label>
        <div className="flex justify-end">
          <Button onClick={saveConfig} loading={saving}><Save className="h-4 w-4" aria-hidden="true" />Salvar configuração</Button>
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Conectar número via QR Code</h2>
          <p className="text-xs text-gray-500">Abra o WhatsApp no celular do número que vai atender → Aparelhos conectados → Conectar um aparelho → aponte para o código abaixo.</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          {qrCode ? (
            <img src={qrCode} alt="QR Code de conexão do WhatsApp" className="h-64 w-64 rounded-lg border border-gray-200 object-contain dark:border-gray-700" />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-400 dark:border-gray-700">
              Clique em "Gerar QR Code" para conectar
            </div>
          )}
          <Button variant="secondary" onClick={generateQrCode} loading={loadingQr}><QrCode className="h-4 w-4" aria-hidden="true" />Gerar QR Code</Button>
        </div>
      </div>
    </div>
  )
}
