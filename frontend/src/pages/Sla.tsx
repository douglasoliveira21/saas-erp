import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, AlertTriangle, Clock, DollarSign, CheckCircle, XCircle, Filter, Settings, Save, Eye, EyeOff } from 'lucide-react'

interface Ticket {
  id: string
  glpiTicketId: number
  customer: { id: string; name: string }
  contract: { id: string; title: string; slaInternal: number; slaExternal: number } | null
  title: string
  status: number
  slaType: string
  slaLimitHours: number
  timeSpentHours: number
  slaExceeded: boolean
  exceededHours: number
  exceededCharge: number
  dateOpened: string
  dateClosed: string
}

interface SlaReport {
  totalTickets: number
  totalExceeded: number
  totalCharge: number
  byCustomer: { name: string; tickets: number; exceeded: number; charge: number }[]
}

interface GlpiConfig {
  id?: string
  apiUrl: string
  appToken: string
  userToken: string
  lastSync?: string
}

const glpiStatus: Record<number, string> = { 1: 'Novo', 2: 'Em atendimento', 3: 'Planejado', 4: 'Pendente', 5: 'Solucionado', 6: 'Fechado' }

export function Sla() {
  const { isAdmin } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [report, setReport] = useState<SlaReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'exceeded'>('all')
  const [error, setError] = useState('')

  // GLPI Config state
  const [showConfig, setShowConfig] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configError, setConfigError] = useState('')
  const [configSuccess, setConfigSuccess] = useState('')
  const [glpiApiUrl, setGlpiApiUrl] = useState('')
  const [glpiAppToken, setGlpiAppToken] = useState('')
  const [glpiUserToken, setGlpiUserToken] = useState('')
  const [showTokens, setShowTokens] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [t, r] = await Promise.all([
        api.get('/glpi/tickets' + (filter === 'exceeded' ? '?exceeded=true' : '')),
        api.get('/glpi/sla-report'),
      ])
      setTickets(t.data); setReport(r.data)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao carregar dados GLPI. Configure a conexão primeiro.') }
    finally { setLoading(false) }
  }

  async function loadConfig() {
    setConfigLoading(true); setConfigError('')
    try {
      const res = await api.get('/glpi/config')
      setGlpiApiUrl(res.data.apiUrl || '')
      setGlpiAppToken(res.data.appToken || '')
      setGlpiUserToken(res.data.userToken || '')
    } catch {
      // Config não existe ainda - campos ficam vazios
      setGlpiApiUrl('')
      setGlpiAppToken('')
      setGlpiUserToken('')
    } finally { setConfigLoading(false) }
  }

  async function saveConfig() {
    if (!glpiApiUrl.trim()) { setConfigError('URL da API é obrigatória'); return }
    if (!glpiAppToken.trim()) { setConfigError('App-Token é obrigatório'); return }
    setConfigSaving(true); setConfigError(''); setConfigSuccess('')
    try {
      await api.patch('/glpi/config', {
        apiUrl: glpiApiUrl.trim().replace(/\/$/, ''),
        appToken: glpiAppToken.trim(),
        userToken: glpiUserToken.trim() || null,
      })
      setConfigSuccess('Configuração salva com sucesso!')
      setTimeout(() => setConfigSuccess(''), 3000)
    } catch (e: any) {
      setConfigError(e.response?.data?.message || 'Erro ao salvar configuração')
    } finally { setConfigSaving(false) }
  }

  function openConfig() {
    setShowConfig(true)
    loadConfig()
  }

  async function sync() {
    setSyncing(true); setError('')
    try {
      const res = await api.post('/glpi/sync')
      alert('Sincronizado: ' + res.data.synced + ' chamados, ' + res.data.exceeded + ' com SLA estourado, R$ ' + Number(res.data.totalCharge).toFixed(2) + ' a cobrar')
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao sincronizar com GLPI') }
    finally { setSyncing(false) }
  }

  useEffect(() => { if (!loading) load() }, [filter])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Controle de SLA</h1>
          <p className="text-sm text-gray-500 mt-1">Integrado com GLPI - R$ 80,00/hora excedida</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={openConfig} className="btn btn-secondary flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configurar GLPI
            </button>
          )}
          <button onClick={sync} disabled={syncing} className="btn btn-primary flex items-center gap-2">
            <RefreshCw className={'w-4 h-4 ' + (syncing ? 'animate-spin' : '')} />
            {syncing ? 'Sincronizando...' : 'Sincronizar GLPI'}
          </button>
        </div>
      </div>

      {/* Painel de Configuração GLPI */}
      {showConfig && (
        <div className="card mb-6 border-2 border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" /> Configuração GLPI
            </h2>
            <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {configError && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{configError}</div>}
          {configSuccess && <div className="mb-3 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{configSuccess}</div>}

          {configLoading ? (
            <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL da API do GLPI *</label>
                <input
                  className="input"
                  placeholder="https://seuglpi.com.br/apirest.php"
                  value={glpiApiUrl}
                  onChange={e => setGlpiApiUrl(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Ex: https://glpi.suaempresa.com.br/apirest.php</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App-Token *</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1 font-mono text-sm"
                    type={showTokens ? 'text' : 'password'}
                    placeholder="Cole aqui o App-Token do GLPI"
                    value={glpiAppToken}
                    onChange={e => setGlpiAppToken(e.target.value)}
                  />
                  <button onClick={() => setShowTokens(!showTokens)} className="btn btn-secondary px-3" title="Mostrar/ocultar">
                    {showTokens ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Gerado em: GLPI → Configurar → Geral → API → Clientes de API</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Token (API Token do Usuário)</label>
                <input
                  className="input font-mono text-sm"
                  type={showTokens ? 'text' : 'password'}
                  placeholder="Cole aqui o Token de API do usuário"
                  value={glpiUserToken}
                  onChange={e => setGlpiUserToken(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Encontrado em: GLPI → Perfil do usuário → Configurações → Token de API Remota</p>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <button onClick={saveConfig} disabled={configSaving} className="btn btn-primary flex items-center gap-2">
                  {configSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="w-4 h-4" />}
                  Salvar Configuração
                </button>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-800 mb-2">📋 Como obter os tokens no GLPI:</h3>
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li><strong>App-Token:</strong> Acesse GLPI → Configurar → Geral → API → Clientes de API → Adicionar (coloque nome, ative, copie o token gerado)</li>
                  <li><strong>User Token:</strong> Acesse GLPI → clique no seu nome (canto superior direito) → Configurações → aba "Token de API Remota" → Regenerar → copie o token</li>
                  <li><strong>URL da API:</strong> Geralmente é o endereço do seu GLPI + <code>/apirest.php</code></li>
                  <li><strong>Importante:</strong> Ative a API REST em: Configurar → Geral → API → Ativar API Rest = Sim</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Total Chamados</p><p className="text-lg font-bold">{report.totalTickets}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
            <div><p className="text-xs text-gray-500">SLA Estourado</p><p className="text-lg font-bold text-red-600">{report.totalExceeded}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-yellow-600" /></div>
            <div><p className="text-xs text-gray-500">Total a Cobrar</p><p className="text-lg font-bold text-yellow-600">R$ {report.totalCharge.toFixed(2)}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-4 h-4 text-green-600" /></div>
            <div><p className="text-xs text-gray-500">Dentro do SLA</p><p className="text-lg font-bold text-green-600">{report.totalTickets - report.totalExceeded}</p></div>
          </div>
        </div>
      )}

      {/* Cobranca por cliente */}
      {report && report.byCustomer.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Cobranca por Cliente (SLA Excedido)</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="text-left py-2">Cliente</th><th className="text-right py-2">Chamados</th><th className="text-right py-2">Estourados</th><th className="text-right py-2">Valor a Cobrar</th></tr></thead>
            <tbody>
              {report.byCustomer.filter(c => c.charge > 0).map((c, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-right">{c.tickets}</td>
                  <td className="py-2 text-right text-red-600">{c.exceeded}</td>
                  <td className="py-2 text-right font-bold text-yellow-600">R$ {c.charge.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>Todos</button>
        <button onClick={() => setFilter('exceeded')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (filter === 'exceeded' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700')}>SLA Estourado</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {/* Lista de chamados */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : tickets.length === 0 ? (
          <div className="text-center text-gray-500 py-8">Nenhum chamado encontrado. Clique em "Sincronizar GLPI" para importar.</div>
        ) : (
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell font-semibold text-gray-700">#</th>
                <th className="table-cell font-semibold text-gray-700">Chamado</th>
                <th className="table-cell font-semibold text-gray-700">Cliente</th>
                <th className="table-cell font-semibold text-gray-700">Tipo SLA</th>
                <th className="table-cell font-semibold text-gray-700">Limite</th>
                <th className="table-cell font-semibold text-gray-700">Tempo</th>
                <th className="table-cell font-semibold text-gray-700">Status</th>
                <th className="table-cell font-semibold text-gray-700">Cobranca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tickets.map(t => (
                <tr key={t.id} className={'hover:bg-gray-50 ' + (t.slaExceeded ? 'bg-red-50/50' : '')}>
                  <td className="table-cell text-gray-500 font-mono text-xs">#{t.glpiTicketId}</td>
                  <td className="table-cell">
                    <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">{t.title}</div>
                    <div className="text-xs text-gray-400">{t.dateOpened ? new Date(t.dateOpened).toLocaleDateString('pt-BR') : '-'}</div>
                  </td>
                  <td className="table-cell text-gray-600">{t.customer?.name || '-'}</td>
                  <td className="table-cell">
                    <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (t.slaType === 'interno' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
                      {t.slaType === 'interno' ? 'Interno' : 'Externo'}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600">{t.slaLimitHours}h</td>
                  <td className="table-cell">
                    <span className={t.slaExceeded ? 'text-red-600 font-bold' : 'text-gray-900'}>{Number(t.timeSpentHours).toFixed(1)}h</span>
                  </td>
                  <td className="table-cell">
                    {t.slaExceeded
                      ? <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><XCircle className="w-3 h-3" /> +{Number(t.exceededHours).toFixed(0)}h</span>
                      : <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3 h-3" /> OK</span>
                    }
                  </td>
                  <td className="table-cell">
                    {t.slaExceeded
                      ? <span className="font-bold text-yellow-600">R$ {Number(t.exceededCharge).toFixed(2)}</span>
                      : <span className="text-gray-400">-</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
