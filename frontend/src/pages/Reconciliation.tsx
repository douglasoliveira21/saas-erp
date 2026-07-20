import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { RefreshCw, CheckCircle, DollarSign, Search, Upload, ArrowRight, Undo2, Plus, EyeOff, TrendingUp, TrendingDown } from 'lucide-react'

interface Statement {
  id: string; transactionId: string; date: string; amount: number; type: string; description: string; memo: string; documentNumber: string; bankAccount: string; status: string; matchedMovementId: string; matchScore: number; category: string; createdAt: string
}

interface Movement {
  id: string; type: string; category: string; description: string; value: number; date: string; payment_method: string; sale_id: string
}

interface Summary {
  totalLancamentos: number; totalCreditos: number; totalDebitos: number; saldoExtrato: number; saldoSistema: number; diferenca: number; percentualConciliado: number; qtdConciliados: number; qtdPendentes: number; qtdDivergentes: number; totalConciliadoCredito: number; totalConciliadoDebito: number; totalPendenteCredito: number; totalPendenteDebito: number
}

const statusLabels: Record<string, string> = { pendente: 'Pendente', conciliado_auto: 'Auto', conciliado_manual: 'Manual', divergente: 'Divergente', ignorado: 'Ignorado' }
const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', conciliado_auto: 'bg-green-100 text-green-700', conciliado_manual: 'bg-blue-100 text-blue-700', divergente: 'bg-red-100 text-red-700', ignorado: 'bg-gray-100 text-gray-500' }
const catLabels: Record<string, string> = { tarifa: 'Tarifa', rendimento: 'Rendimento', iof: 'IOF', estorno: 'Estorno', ted: 'TED', doc: 'DOC', pix: 'PIX', boleto: 'Boleto', transferencia: 'Transf.', deposito: 'Depósito', saque: 'Saque', outros: 'Outros' }

export function Reconciliation() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [reconciling, setReconciling] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedStmt, setSelectedStmt] = useState<string | null>(null)

  useEffect(() => { loadData() }, [startDate, endDate])

  async function loadData() {
    setLoading(true)
    try {
      const [stmtRes, summRes, movRes] = await Promise.all([
        api.get('/reconciliation/statements', { params: { startDate, endDate } }),
        api.get('/reconciliation/summary', { params: { startDate, endDate } }),
        api.get('/reconciliation/unmatched-movements', { params: { startDate, endDate } }),
      ])
      setStatements(stmtRes.data)
      setSummary(summRes.data)
      setMovements(movRes.data)
    } catch { setError('Erro ao carregar dados') }
    finally { setLoading(false) }
  }

  async function importOFX(file: File) {
    setImporting(true); setError(''); setSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bankAccount', 'inter')
      const res = await api.post('/reconciliation/import-ofx', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSuccess(`Importado: ${res.data.imported} lançamento(s), ${res.data.duplicates} duplicata(s) ignorada(s)`)
      loadData()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao importar') }
    finally { setImporting(false) }
  }

  async function importFromInter() {
    setImporting(true); setError(''); setSuccess('')
    try {
      const res = await api.post('/reconciliation/import-inter', { startDate, endDate })
      setSuccess(`Extrato Inter importado: ${res.data.imported} lançamento(s), ${res.data.duplicates} duplicata(s) ignorada(s)`)
      loadData()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao buscar extrato do Inter. Verifique se o escopo "extrato.read" está habilitado.') }
    finally { setImporting(false) }
  }

  async function autoReconcile() {
    setReconciling(true); setError(''); setSuccess('')
    try {
      const res = await api.post('/reconciliation/auto-reconcile', { startDate, endDate, toleranceDays: 3, minScore: 80 })
      setSuccess(`Conciliação: ${res.data.matched} de ${res.data.total} conciliado(s) automaticamente. ${res.data.pending} pendente(s).`)
      loadData()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro na conciliação') }
    finally { setReconciling(false) }
  }

  async function manualMatch(statementId: string, movementId: string) {
    try {
      await api.post('/reconciliation/manual-reconcile', { statementId, movementId })
      setSuccess('Conciliado manualmente!')
      setSelectedStmt(null)
      loadData()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  async function undoReconcile(statementId: string) {
    try {
      await api.post('/reconciliation/undo', { statementId })
      loadData()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao desfazer') }
  }

  async function ignoreStmt(statementId: string) {
    try {
      await api.post('/reconciliation/ignore', { statementId })
      loadData()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  async function createMovement(statementId: string) {
    try {
      await api.post('/reconciliation/create-movement', { statementId })
      setSuccess('Lançamento criado e conciliado!')
      loadData()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao criar') }
  }

  const filteredStmts = statements.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false
    if (typeFilter && s.type !== typeFilter) return false
    if (search && !(s.description || '').toLowerCase().includes(search.toLowerCase()) && !(s.memo || '').toLowerCase().includes(search.toLowerCase()) && !(s.documentNumber || '').includes(search)) return false
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conciliação Bancária</h1>
          <p className="text-sm text-gray-500 mt-0.5">Extrato × Sistema Financeiro</p>
        </div>
        <div className="flex gap-2">
          <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> {importing ? 'Importando...' : 'Importar OFX'}
            <input type="file" accept=".ofx,.OFX" className="hidden" onChange={e => e.target.files?.[0] && importOFX(e.target.files[0])} disabled={importing} />
          </label>
          <button onClick={importFromInter} disabled={importing} className="btn btn-secondary flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> {importing ? 'Buscando...' : 'Extrato Inter'}
          </button>
          <button onClick={autoReconcile} disabled={reconciling} className="btn btn-primary flex items-center gap-2">
            <RefreshCw className={'w-4 h-4 ' + (reconciling ? 'animate-spin' : '')} />
            {reconciling ? 'Conciliando...' : 'Conciliar Auto'}
          </button>
        </div>
      </div>

      {/* Período */}
      <div className="card mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input type="date" className="input w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input type="date" className="input w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10" placeholder="Buscar descrição, memo, documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos status</option>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input w-32" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="credito">Crédito</option>
            <option value="debito">Débito</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {success}</div>}

      {/* Painel Resumo */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Créditos Extrato</p>
                <p className="text-lg font-bold text-blue-600">R$ {summary.totalCreditos.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Débitos Extrato</p>
                <p className="text-lg font-bold text-red-600">R$ {summary.totalDebitos.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Conciliado</p>
                <p className="text-lg font-bold text-green-600">{summary.percentualConciliado}%</p>
                <p className="text-[10px] text-gray-400">{summary.qtdConciliados} de {summary.totalLancamentos}</p>
              </div>
            </div>
          </div>
          <div className="card py-4">
            <div className="flex items-center gap-3">
              <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + (Math.abs(summary.diferenca) < 0.01 ? 'bg-green-100' : 'bg-orange-100')}>
                <DollarSign className={'w-5 h-5 ' + (Math.abs(summary.diferenca) < 0.01 ? 'text-green-600' : 'text-orange-600')} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Diferença</p>
                <p className={'text-lg font-bold ' + (Math.abs(summary.diferenca) < 0.01 ? 'text-green-600' : 'text-orange-600')}>R$ {Math.abs(summary.diferenca).toFixed(2)}</p>
                {Math.abs(summary.diferenca) < 0.01 && <p className="text-[10px] text-green-500">✓ Conta conciliada</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saldos detalhados */}
      {summary && (
        <div className="card mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-2 font-medium uppercase">Extrato Bancário</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">(+) Créditos:</span><span className="font-medium text-green-600">R$ {summary.totalCreditos.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">(-) Débitos:</span><span className="font-medium text-red-600">R$ {summary.totalDebitos.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="text-gray-700 font-medium">Saldo:</span><span className="font-bold">R$ {summary.saldoExtrato.toFixed(2)}</span></div>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-2 font-medium uppercase">Sistema Financeiro</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Saldo período:</span><span className="font-bold">R$ {summary.saldoSistema.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Diferença:</span><span className={'font-bold ' + (Math.abs(summary.diferenca) < 0.01 ? 'text-green-600' : 'text-orange-600')}>R$ {summary.diferenca.toFixed(2)}</span></div>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-2 font-medium uppercase">Conciliados</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Créditos:</span><span className="text-green-600">R$ {summary.totalConciliadoCredito.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Débitos:</span><span className="text-red-600">R$ {summary.totalConciliadoDebito.toFixed(2)}</span></div>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-2 font-medium uppercase">Pendentes</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Créditos:</span><span className="text-yellow-600">R$ {summary.totalPendenteCredito.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Débitos:</span><span className="text-yellow-600">R$ {summary.totalPendenteDebito.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Qtd pendente:</span><span className="font-bold text-yellow-600">{summary.qtdPendentes}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela do extrato */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Extrato Bancário ({filteredStmts.length} lançamentos)</h3>
        </div>
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : filteredStmts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">Nenhum lançamento. Importe um arquivo OFX para começar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cat.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Score</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStmts.map(s => (
                  <tr key={s.id} className={'hover:bg-gray-50 ' + (selectedStmt === s.id ? 'bg-blue-50 ring-1 ring-blue-200' : '')}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs truncate max-w-[250px]">{s.description || s.memo || '-'}</div>
                      {s.documentNumber && <div className="text-[10px] text-gray-400 font-mono">{s.documentNumber}</div>}
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-500">{catLabels[s.category] || s.category}</span></td>
                    <td className={'px-4 py-3 text-right font-semibold whitespace-nowrap ' + (s.type === 'credito' ? 'text-green-600' : 'text-red-600')}>
                      {s.type === 'credito' ? '+' : '-'} R$ {Number(s.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.matchScore ? (
                        <span className={'px-1.5 py-0.5 rounded text-[10px] font-bold ' + (s.matchScore >= 90 ? 'bg-green-100 text-green-700' : s.matchScore >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
                          {s.matchScore}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[s.status] || ''}`}>{statusLabels[s.status] || s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {s.status === 'pendente' && (
                          <>
                            <button onClick={() => setSelectedStmt(selectedStmt === s.id ? null : s.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Conciliar manualmente"><ArrowRight className="w-3.5 h-3.5" /></button>
                            <button onClick={() => createMovement(s.id)} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="Criar lançamento"><Plus className="w-3.5 h-3.5" /></button>
                            <button onClick={() => ignoreStmt(s.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Ignorar"><EyeOff className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        {s.status.startsWith('conciliado') && (
                          <button onClick={() => undoReconcile(s.id)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Desfazer"><Undo2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Painel de conciliação manual - aparece quando seleciona um statement */}
      {selectedStmt && (
        <div className="card mt-4 border-2 border-blue-200 bg-blue-50/30">
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Selecione o lançamento do sistema para conciliar</h3>
          {movements.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum lançamento financeiro disponível no período selecionado.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {movements.map(m => {
                const stmtAmount = Number(statements.find(s => s.id === selectedStmt)?.amount || 0)
                const valueMatch = Math.abs(stmtAmount - Number(m.value)) < 0.01
                return (
                  <div key={m.id} className={'flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all ' + (valueMatch ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white')}
                    onClick={() => manualMatch(selectedStmt, m.id)}>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{m.description || m.category}</div>
                      <div className="text-xs text-gray-500">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {m.payment_method} • {m.category}</div>
                    </div>
                    <div className={'text-sm font-bold ' + (m.type === 'receita' ? 'text-green-600' : 'text-red-600')}>
                      R$ {Number(m.value).toFixed(2)}
                      {valueMatch && <span className="ml-2 text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded">MATCH</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={() => setSelectedStmt(null)} className="mt-3 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">💡 Como usar:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Importar OFX:</strong> Faça download do extrato em formato OFX no internet banking do Inter e importe aqui</li>
          <li><strong>Conciliar Auto:</strong> O sistema busca correspondências por valor, data, tipo e descrição (score ≥ 80 pontos)</li>
          <li><strong>Conciliar Manual:</strong> Clique na seta → selecione o lançamento correspondente no sistema</li>
          <li><strong>Criar Lançamento:</strong> Se não existe no sistema, cria automaticamente a partir do extrato</li>
          <li><strong>Ignorar:</strong> Para tarifas ou movimentos que não precisam de correspondência</li>
          <li><strong>Desfazer:</strong> Reverte uma conciliação feita (auto ou manual)</li>
        </ul>
      </div>
    </div>
  )
}
