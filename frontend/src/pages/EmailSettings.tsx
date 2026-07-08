import { useEffect, useState } from 'react'
import { Mail, Save, ShieldCheck, Cloud, Plug, Unplug } from 'lucide-react'
import { api } from '../services/api'

export function EmailSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state') || ''

    api.get('/mail/config')
      .then(async r => {
        let next = { ...r.data, authPass: '', microsoftClientSecret: '' }
        if (code) {
          setConnecting(true)
          const redirectUri = window.location.origin + window.location.pathname
          const connected = await api.post('/mail/microsoft/callback', { code, state, redirectUri })
          next = { ...connected.data, authPass: '', microsoftClientSecret: '' }
          window.history.replaceState({}, '', window.location.pathname)
          setMessage('Conta Microsoft 365 conectada com sucesso.')
          setConnecting(false)
        }
        setCfg(next)
      })
      .catch(() => {
        setConnecting(false)
        setError('Erro ao carregar configuracao de email')
      })
  }, [])

  async function save() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.patch('/mail/config', cfg)
      setCfg({ ...res.data, authPass: '', microsoftClientSecret: '' })
      setMessage('Configuracao de email salva com sucesso.')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar configuracao')
    } finally {
      setSaving(false)
    }
  }

  async function connectMicrosoft() {
    setConnecting(true)
    setMessage('')
    setError('')
    try {
      await api.patch('/mail/config', cfg)
      const redirectUri = window.location.origin + window.location.pathname
      const res = await api.get('/mail/microsoft/auth-url', { params: { redirectUri } })
      window.location.href = res.data.url
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao iniciar conexao Microsoft 365')
      setConnecting(false)
    }
  }

  async function disconnectMicrosoft() {
    if (!confirm('Desconectar a conta Microsoft 365?')) return
    setConnecting(true)
    setMessage('')
    setError('')
    try {
      const res = await api.post('/mail/microsoft/disconnect')
      setCfg({ ...res.data, authPass: '', microsoftClientSecret: '' })
      setMessage('Conta Microsoft 365 desconectada.')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao desconectar Microsoft 365')
    } finally {
      setConnecting(false)
    }
  }

  if (!cfg) return <div className="card text-center py-8">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configuracao de Email</h1>
          <p className="text-sm text-gray-500 mt-1">Conta usada para enviar boletos, notas e comunicados aos clientes.</p>
        </div>
      </div>

      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Forma de envio</label>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setCfg({ ...cfg, provider: 'smtp' })}
              className={'px-4 py-2 text-sm font-medium flex items-center gap-2 ' + ((cfg.provider || 'smtp') === 'smtp' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700')}
            >
              <Mail className="w-4 h-4" /> SMTP
            </button>
            <button
              onClick={() => setCfg({ ...cfg, provider: 'microsoft365' })}
              className={'px-4 py-2 text-sm font-medium flex items-center gap-2 border-l border-gray-200 ' + (cfg.provider === 'microsoft365' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700')}
            >
              <Cloud className="w-4 h-4" /> Microsoft 365
            </button>
          </div>
        </div>

        {(cfg.provider || 'smtp') === 'smtp' && <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900">Servidor SMTP</h2>
        </div>}

        {(cfg.provider || 'smtp') === 'smtp' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servidor</label>
            <input className="input" value={cfg.host || ''} onChange={e => setCfg({ ...cfg, host: e.target.value })} placeholder="smtp.seudominio.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
            <input className="input" type="number" value={cfg.port || 587} onChange={e => setCfg({ ...cfg, port: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input className="input" type="email" value={cfg.authUser || ''} onChange={e => setCfg({ ...cfg, authUser: e.target.value })} placeholder="financeiro@empresa.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input className="input" type="password" value={cfg.authPass || ''} onChange={e => setCfg({ ...cfg, authPass: e.target.value })} placeholder={cfg.hasPassword ? 'Senha ja cadastrada' : 'Senha do email'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email remetente</label>
            <input className="input" type="email" value={cfg.fromEmail || ''} onChange={e => setCfg({ ...cfg, fromEmail: e.target.value })} placeholder="financeiro@empresa.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome remetente</label>
            <input className="input" value={cfg.fromName || ''} onChange={e => setCfg({ ...cfg, fromName: e.target.value })} placeholder="VGON" />
          </div>
        </div>}

        {(cfg.provider || 'smtp') === 'smtp' && <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={Boolean(cfg.secure)} onChange={e => setCfg({ ...cfg, secure: e.target.checked })} />
          Usar conexao segura SSL/TLS
        </label>}

        {cfg.provider === 'microsoft365' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-gray-900">Microsoft 365</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                <input className="input" value={cfg.microsoftTenantId || 'common'} onChange={e => setCfg({ ...cfg, microsoftTenantId: e.target.value })} placeholder="common ou tenant-id" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input className="input" value={cfg.microsoftClientId || ''} onChange={e => setCfg({ ...cfg, microsoftClientId: e.target.value })} placeholder="Application (client) ID" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                <input className="input" type="password" value={cfg.microsoftClientSecret || ''} onChange={e => setCfg({ ...cfg, microsoftClientSecret: e.target.value })} placeholder={cfg.hasMicrosoftClientSecret ? 'Secret ja cadastrado' : 'Client secret'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URI</label>
                <input className="input" value={cfg.microsoftRedirectUri || (window.location.origin + window.location.pathname)} onChange={e => setCfg({ ...cfg, microsoftRedirectUri: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome remetente</label>
                <input className="input" value={cfg.fromName || ''} onChange={e => setCfg({ ...cfg, fromName: e.target.value })} placeholder="VGON" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conta conectada</label>
                <div className="input flex items-center">{cfg.microsoftConnected ? (cfg.microsoftUserEmail || 'Conectada') : 'Nao conectada'}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={connectMicrosoft} disabled={connecting || !cfg.microsoftClientId} className="btn btn-primary flex items-center gap-2">
                <Plug className="w-4 h-4" /> {connecting ? 'Conectando...' : 'Conectar Microsoft 365'}
              </button>
              {cfg.microsoftConnected && (
                <button onClick={disconnectMicrosoft} disabled={connecting} className="btn btn-secondary flex items-center gap-2">
                  <Unplug className="w-4 h-4" /> Desconectar
                </button>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Copia automatica</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={Boolean(cfg.copyEnabled)} onChange={e => setCfg({ ...cfg, copyEnabled: e.target.checked })} />
            Enviar copia de todos os emails
          </label>
          {cfg.copyEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email em copia</label>
              <input className="input" type="email" value={cfg.copyEmail || ''} onChange={e => setCfg({ ...cfg, copyEmail: e.target.value })} placeholder="copia@empresa.com.br" />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
