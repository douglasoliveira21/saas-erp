import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, MailCheck } from 'lucide-react'
import { superAdminApi, setSuperAdminToken } from '../../services/superAdminApi'

export function SuperAdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await superAdminApi.post('/auth/login', { email, password })
      setPendingToken(res.data.pendingToken)
      setMaskedEmail(res.data.maskedEmail)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await superAdminApi.post('/auth/verify-code', { pendingToken, code })
      setSuperAdminToken(res.data.access_token)
      navigate('/super-admin/tenants')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    setResending(true)
    setError('')
    setResent(false)
    try {
      const res = await superAdminApi.post('/auth/resend-code', { pendingToken })
      setMaskedEmail(res.data.maskedEmail)
      setResent(true)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Não foi possível reenviar o código - faça login novamente')
      setPendingToken('')
    } finally {
      setResending(false)
    }
  }

  function backToCredentials() {
    setPendingToken('')
    setCode('')
    setError('')
    setResent(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      {!pendingToken ? (
        <form onSubmit={submitCredentials} className="w-full max-w-sm space-y-5 rounded-2xl bg-gray-800 p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-2 text-white">
            <ShieldCheck className="h-10 w-10 text-amber-400" aria-hidden="true" />
            <h1 className="text-lg font-bold">Painel do Super Admin</h1>
            <p className="text-center text-xs text-gray-400">Acesso restrito à administração da plataforma</p>
          </div>
          {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300" role="alert">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Email</label>
            <input className="w-full rounded-lg border border-gray-600 bg-gray-900 p-2.5 text-white" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Senha</label>
            <input className="w-full rounded-lg border border-gray-600 bg-gray-900 p-2.5 text-white" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-amber-500 p-2.5 font-semibold text-gray-900 transition hover:bg-amber-400 disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="w-full max-w-sm space-y-5 rounded-2xl bg-gray-800 p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-2 text-white">
            <MailCheck className="h-10 w-10 text-amber-400" aria-hidden="true" />
            <h1 className="text-lg font-bold">Verificação em 2 etapas</h1>
            <p className="text-center text-xs text-gray-400">Enviamos um código de 6 dígitos para {maskedEmail || 'seu email'}</p>
          </div>
          {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300" role="alert">{error}</div>}
          {resent && !error && <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-300">Novo código enviado!</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Código de verificação</label>
            <input
              className="w-full rounded-lg border border-gray-600 bg-gray-900 p-2.5 text-center text-2xl tracking-[0.5em] text-white"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <button type="submit" disabled={loading || code.length !== 6} className="w-full rounded-lg bg-amber-500 p-2.5 font-semibold text-gray-900 transition hover:bg-amber-400 disabled:opacity-50">
            {loading ? 'Verificando...' : 'Verificar e entrar'}
          </button>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <button type="button" onClick={backToCredentials} className="underline hover:text-gray-200">Usar outra conta</button>
            <button type="button" onClick={resendCode} disabled={resending} className="underline hover:text-gray-200 disabled:opacity-50">
              {resending ? 'Reenviando...' : 'Reenviar código'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
