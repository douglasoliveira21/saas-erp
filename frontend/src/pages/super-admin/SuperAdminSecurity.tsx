import { useEffect, useState } from 'react'
import { ShieldOff, Unlock, RefreshCw } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'

interface BlockedIp {
  id: string; ip: string; failedAttempts: number; blocked: boolean; blockedAt: string | null
  lastAttemptAt: string | null; lastEmailAttempted: string | null; unblockedAt: string | null
}
interface LockedAccount {
  id: string; name: string; email: string; role: string; failedLoginAttempts: number
  lockedUntil: string; tenantId: string | null; tenantName: string | null
}
interface ErrorLog {
  id: string; statusCode: number; method: string; path: string; message: string
  userId: string | null; tenantId: string | null; ipAddress: string | null; createdAt: string
}
interface AuditLog {
  id: string; action: string; entity: string; entityId: string | null; ipAddress: string | null
  createdAt: string; user?: { name: string; email: string } | null
}

type Tab = 'ips' | 'accounts' | 'errors' | 'audit'

function fmt(date: string | null) {
  return date ? new Date(date).toLocaleString('pt-BR') : '-'
}

export function SuperAdminSecurity() {
  const [tab, setTab] = useState<Tab>('ips')
  const [ips, setIps] = useState<BlockedIp[]>([])
  const [accounts, setAccounts] = useState<LockedAccount[]>([])
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (tab === 'ips') setIps((await superAdminApi.get('/security/blocked-ips')).data)
      if (tab === 'accounts') setAccounts((await superAdminApi.get('/security/locked-accounts')).data)
      if (tab === 'errors') setErrors((await superAdminApi.get('/security/error-logs')).data)
      if (tab === 'audit') setAuditLogs((await superAdminApi.get('/security/audit-logs')).data)
    } catch {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tab])

  async function unblockIp(row: BlockedIp) {
    if (!confirm(`Desbloquear o IP ${row.ip}?`)) return
    await superAdminApi.patch(`/security/blocked-ips/${row.id}/unblock`)
    load()
  }

  async function unlockAccount(row: LockedAccount) {
    if (!confirm(`Desbloquear a conta de "${row.name}" (${row.email})?`)) return
    await superAdminApi.patch(`/security/locked-accounts/${row.id}/unlock`)
    load()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ips', label: 'IPs bloqueados' },
    { key: 'accounts', label: 'Contas bloqueadas' },
    { key: 'errors', label: 'Logs de erro' },
    { key: 'audit', label: 'Logs de auditoria' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Segurança e logs</h1>
        <button onClick={load} className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t.key ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <>
          {tab === 'ips' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">IP</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Tentativas</th>
                    <th className="p-3">Último email tentado</th>
                    <th className="p-3">Última tentativa</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {ips.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-gray-500">Nenhum IP com tentativas registradas</td></tr>
                  ) : ips.map(row => (
                    <tr key={row.id} className="text-gray-200">
                      <td className="p-3 font-mono">{row.ip}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.blocked ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                          {row.blocked ? 'Bloqueado' : 'Livre'}
                        </span>
                      </td>
                      <td className="p-3">{row.failedAttempts}</td>
                      <td className="p-3 text-gray-400">{row.lastEmailAttempted || '-'}</td>
                      <td className="p-3 text-xs text-gray-500">{fmt(row.lastAttemptAt)}</td>
                      <td className="p-3">
                        {row.blocked && (
                          <button onClick={() => unblockIp(row)} title="Desbloquear IP" className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30">
                            <Unlock className="h-3.5 w-3.5" /> Desbloquear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'accounts' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Cliente (tenant)</th>
                    <th className="p-3">Tentativas</th>
                    <th className="p-3">Bloqueado até</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {accounts.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">Nenhuma conta bloqueada no momento</td></tr>
                  ) : accounts.map(row => (
                    <tr key={row.id} className="text-gray-200">
                      <td className="p-3">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-gray-500">{row.email}</p>
                      </td>
                      <td className="p-3 text-gray-400">{row.tenantName || '-'}</td>
                      <td className="p-3">{row.failedLoginAttempts}</td>
                      <td className="p-3 text-xs text-gray-500">{fmt(row.lockedUntil)}</td>
                      <td className="p-3">
                        <button onClick={() => unlockAccount(row)} title="Desbloquear conta" className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30">
                          <Unlock className="h-3.5 w-3.5" /> Desbloquear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'errors' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Quando</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Rota</th>
                    <th className="p-3">Mensagem</th>
                    <th className="p-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {errors.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">Nenhum erro registrado</td></tr>
                  ) : errors.map(row => (
                    <tr key={row.id} className="text-gray-200 align-top">
                      <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{fmt(row.createdAt)}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.statusCode >= 500 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {row.statusCode}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-400">{row.method} {row.path}</td>
                      <td className="p-3 text-gray-300">{row.message}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{row.ipAddress || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'audit' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Quando</th>
                    <th className="p-3">Ação</th>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Entidade</th>
                    <th className="p-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">Nenhum registro de auditoria</td></tr>
                  ) : auditLogs.map(row => (
                    <tr key={row.id} className="text-gray-200">
                      <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{fmt(row.createdAt)}</td>
                      <td className="p-3 font-mono text-xs">
                        <span className="flex items-center gap-1">
                          {row.action.startsWith('auth.login_failed') || row.action === 'auth.ip_blocked' ? <ShieldOff className="h-3.5 w-3.5 text-red-400" /> : null}
                          {row.action}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400">{row.user ? `${row.user.name} (${row.user.email})` : '-'}</td>
                      <td className="p-3 text-xs text-gray-500">{row.entity}{row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{row.ipAddress || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
