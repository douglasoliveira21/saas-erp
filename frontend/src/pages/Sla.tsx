import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, AlertTriangle, Clock, DollarSign, CheckCircle, XCircle, Settings, Save, Eye, EyeOff, FileText, FileSpreadsheet } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Ticket {
  id: string
  glpiTicketId: number
  customer: { id: string; name: string }
  contract: { id: string; title: string; slaInternal: number; slaExternal: number; slaTotalHours: number; slaOverageRate: number } | null
  title: string
  status: number
  slaType: string
  slaLimitHours: number
  timeSpentHours: number
  slaExceeded: boolean
  exceededHours: number
  exceededCharge: number
  dateOpened: string
  dateSolved: string
  dateClosed: string
}

interface CustomerOption {
  id: string
  name: string
}

interface SlaReport {
  totalTickets: number
  totalExceeded: number
  totalConsumedHours: number
  totalExceededHours: number
  contractsWithoutAllowance: number
  totalCharge: number
  byCustomer: { name: string; tickets: number; exceeded: number; consumedHours: number; includedHours: number; exceededHours: number; overageRate: number; charge: number }[]
}

export function Sla() {
  const { isAdmin } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [report, setReport] = useState<SlaReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'exceeded'>('all')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
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
      const params = new URLSearchParams({ month })
      if (filter === 'exceeded') params.set('exceeded', 'true')
      if (customerId) params.set('customerId', customerId)
      const [r, c] = await Promise.all([
        api.get('/glpi/sla-report?' + params.toString()),
        api.get('/customers'),
      ])
      const t = await api.get('/glpi/tickets?' + params.toString())
      setReport(r.data)
      setCustomers(Array.isArray(c.data) ? c.data : [])
      setTickets(t.data)
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
      const failures = Array.isArray(res.data.failedEntities) ? res.data.failedEntities : []
      const summary = 'Sincronizado: ' + res.data.synced + ' chamados, ' + res.data.exceeded + ' com SLA estourado, R$ ' + Number(res.data.totalCharge).toFixed(2) + ' a cobrar'
      if (failures.length > 0) {
        setError(summary + '. Falha em ' + failures.length + ' entidade(s): ' + failures.map((item: any) => item.customer).join(', '))
      } else {
        alert(summary)
      }
      await load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao sincronizar com GLPI') }
    finally { setSyncing(false) }
  }

  const selectedCustomerName = customerId
    ? customers.find(customer => customer.id === customerId)?.name || 'cliente'
    : 'todos-clientes'
  const exportBaseName = ('sla-' + month + '-' + selectedCustomerName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .toLowerCase()

  function getExportRows() {
    return tickets.map(ticket => ({
      Chamado: ticket.glpiTicketId,
      Titulo: ticket.title,
      Situacao: ticket.status === 6 ? 'Fechado' : 'Solucionado',
      Cliente: ticket.customer?.name || '-',
      TipoSLA: ticket.slaType === 'interno' ? 'Interno' : 'Externo',
      FranquiaMensalHoras: Number(ticket.slaLimitHours || 0),
      Abertura: ticket.dateOpened ? new Date(ticket.dateOpened).toLocaleString('pt-BR') : '-',
      Solucao: ticket.dateSolved ? new Date(ticket.dateSolved).toLocaleString('pt-BR') : (ticket.dateClosed ? new Date(ticket.dateClosed).toLocaleString('pt-BR') : '-'),
      TempoGastoHoras: Number(ticket.timeSpentHours || 0),
      HorasExcedentes: Number(ticket.exceededHours || 0),
      ValorHora: Number(ticket.contract?.slaOverageRate || 0),
      ValorAvulso: Number(ticket.exceededCharge || 0),
    }))
  }

  function exportExcel() {
    const escapeCell = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const table = (headers: string[], rows: unknown[][]) =>
      '<table><thead><tr>' + headers.map(header => '<th>' + escapeCell(header) + '</th>').join('') +
      '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + escapeCell(cell) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table>'

    const summaryHeaders = ['Cliente', 'Chamados', 'Consumo (h)', 'Franquia (h)', 'Excedente (h)', 'Valor/hora', 'Valor a cobrar']
    const summaryRows = (report?.byCustomer || []).map(item => [
      item.name, item.tickets, item.consumedHours, item.includedHours,
      item.exceededHours, item.overageRate, item.charge,
    ])
    const detailRows = getExportRows()
    const detailHeaders = Object.keys(detailRows[0] || {})
    const detailValues = detailRows.map(row => detailHeaders.map(header => row[header as keyof typeof row]))
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
      'body{font-family:Arial,sans-serif}table{border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #bbb;padding:6px}th{background:#4f46e5;color:#fff}' +
      '</style></head><body><h1>Controle mensal de SLA</h1><p>Mes: ' + escapeCell(month) +
      ' | Cliente: ' + escapeCell(customerId ? selectedCustomerName : 'Todos os clientes') +
      '</p><h2>Resumo mensal</h2>' + table(summaryHeaders, summaryRows) +
      '<h2>Chamados</h2>' + table(detailHeaders, detailValues) + '</body></html>'
    const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = exportBaseName + '.xls'
    link.click()
    URL.revokeObjectURL(url)
  }
  function exportPdf() {
    const document = new jsPDF({ orientation: 'landscape' })
    document.setFontSize(15)
    document.text('Controle mensal de SLA', 14, 15)
    document.setFontSize(9)
    document.text('Mes: ' + month + ' | Cliente: ' + (customerId ? selectedCustomerName : 'Todos os clientes'), 14, 21)
    document.text(
      'Consumo: ' + Number(report?.totalConsumedHours || 0).toFixed(2) + 'h | Excedente: ' +
      Number(report?.totalExceededHours || 0).toFixed(2) + 'h | Total: R$ ' +
      Number(report?.totalCharge || 0).toFixed(2),
      14,
      27,
    )
    autoTable(document, {
      startY: 32,
      head: [['Chamado', 'Cliente', 'Situacao', 'Abertura', 'Solucao', 'Tempo', 'Franquia', 'Excedente', 'Valor']],
      body: getExportRows().map(row => [
        '#' + row.Chamado,
        row.Cliente,
        row.Situacao,
        row.Abertura,
        row.Solucao,
        row.TempoGastoHoras.toFixed(2) + 'h',
        row.FranquiaMensalHoras.toFixed(2) + 'h',
        row.HorasExcedentes.toFixed(2) + 'h',
        'R$ ' + row.ValorAvulso.toFixed(2),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [79, 70, 229] },
    })
    document.save(exportBaseName + '.pdf')
  }
  useEffect(() => { if (!loading) load() }, [filter, month, customerId])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Controle de SLA</h1>
          <p className="text-sm text-gray-500 mt-1">Consumo mensal da franquia de horas definida em cada contrato</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Total Chamados</p><p className="text-lg font-bold">{report.totalTickets}</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-purple-600" /></div>
            <div><p className="text-xs text-gray-500">Horas Consumidas</p><p className="text-lg font-bold">{Number(report.totalConsumedHours || 0).toFixed(2)}h</p></div>
          </div>
          <div className="card flex items-center gap-3 py-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
            <div><p className="text-xs text-gray-500">Horas Excedidas</p><p className="text-lg font-bold text-red-600">{Number(report.totalExceededHours || 0).toFixed(2)}h</p></div>
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

      {report && report.contractsWithoutAllowance > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Atenção:</strong> {report.contractsWithoutAllowance} cliente(s) possuem chamados no mês, mas o contrato está com franquia mensal igual a zero. Esses chamados são contabilizados no consumo, porém não geram cobrança até a franquia ser configurada.
        </div>
      )}
      {/* Cobranca por cliente */}
      {report && report.byCustomer.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Consumo mensal por cliente</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="text-left py-2">Cliente</th><th className="text-right py-2">Chamados</th><th className="text-right py-2">Consumo</th><th className="text-right py-2">Franquia</th><th className="text-right py-2">Excedente</th><th className="text-right py-2">Valor/h</th><th className="text-right py-2">Valor a Cobrar</th></tr></thead>
            <tbody>
              {report.byCustomer.map((c, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-right">{c.tickets}</td>
                  <td className="py-2 text-right">{Number(c.consumedHours).toFixed(2)}h</td>
                  <td className="py-2 text-right">{Number(c.includedHours).toFixed(2)}h</td>
                  <td className="py-2 text-right text-red-600">{Number(c.exceededHours).toFixed(2)}h</td>
                  <td className="py-2 text-right">R$ {Number(c.overageRate).toFixed(2)}</td>
                  <td className="py-2 text-right font-bold text-yellow-600">R$ {c.charge.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filtros e exportação */}
      <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilter('all')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>Todos</button>
            <button onClick={() => setFilter('exceeded')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (filter === 'exceeded' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700')}>SLA Estourado</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_190px_auto] lg:items-end">
            <div>
              <label htmlFor="sla-customer" className="form-label">Cliente</label>
              <select id="sla-customer" className="input" value={customerId} onChange={event => setCustomerId(event.target.value)}>
                <option value="">Todos os clientes</option>
                {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sla-month" className="form-label">Mês de referência</label>
              <input id="sla-month" className="input" type="month" value={month} onChange={event => setMonth(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportPdf} disabled={tickets.length === 0} className="btn btn-secondary flex items-center gap-2 disabled:opacity-50">
                <FileText className="h-4 w-4" /> Exportar PDF
              </button>
              <button type="button" onClick={exportExcel} disabled={tickets.length === 0} className="btn btn-secondary flex items-center gap-2 disabled:opacity-50">
                <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            A exportação respeita o mês, o cliente e o filtro de SLA selecionados. Se “Todos os clientes” estiver marcado, todos serão incluídos.
          </p>
        </div>
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
                <th className="table-cell font-semibold text-gray-700">Situação GLPI</th>
                <th className="table-cell font-semibold text-gray-700">Cliente</th>
                <th className="table-cell font-semibold text-gray-700">Tipo SLA</th>
                <th className="table-cell font-semibold text-gray-700">Franquia</th>
                <th className="table-cell font-semibold text-gray-700">Abertura</th>
                <th className="table-cell font-semibold text-gray-700">Solução</th>
                <th className="table-cell font-semibold text-gray-700">Tempo gasto</th>
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
                  </td>
                  <td className="table-cell">
                    <span className={t.status === 6 ? 'rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700' : 'rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700'}>
                      {t.status === 6 ? 'Fechado' : 'Solucionado'}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600">{t.customer?.name || '-'}</td>
                  <td className="table-cell">
                    <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (t.slaType === 'interno' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
                      {t.slaType === 'interno' ? 'Interno' : 'Externo'}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600">{t.slaLimitHours}h</td>
                  <td className="table-cell text-gray-600">{t.dateOpened ? new Date(t.dateOpened).toLocaleString('pt-BR') : '-'}</td>
                  <td className="table-cell text-gray-600">{t.dateSolved ? new Date(t.dateSolved).toLocaleString('pt-BR') : (t.dateClosed ? new Date(t.dateClosed).toLocaleString('pt-BR') : '-')}</td>
                  <td className="table-cell">
                    <span className={t.slaExceeded ? 'text-red-600 font-bold' : 'text-gray-900'}>{Number(t.timeSpentHours).toFixed(1)}h</span>
                  </td>
                  <td className="table-cell">
                    {Number(t.slaLimitHours) <= 0
                      ? <span className="flex items-center gap-1 text-amber-600 text-xs font-medium"><AlertTriangle className="w-3 h-3" /> Configurar franquia</span>
                      : t.slaExceeded
                        ? <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><XCircle className="w-3 h-3" /> +{Number(t.exceededHours).toFixed(2)}h</span>
                        : <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3 h-3" /> Dentro da franquia</span>
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
