import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { superAdminApi, setSuperAdminToken } from '../../services/superAdminApi'

export function SuperAdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await superAdminApi.post('/auth/login', { email, password })
      setSuperAdminToken(res.data.access_token)
      navigate('/super-admin/tenants')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl bg-gray-800 p-8 shadow-2xl">
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
    </div>
  )
}
