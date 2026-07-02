import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { ArrowLeft, Mail, Check } from 'lucide-react'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar email')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </button>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email enviado!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Se o email <strong>{email}</strong> estiver cadastrado, voce recebera um link para redefinir sua senha.
            </p>
            <p className="text-gray-400 text-xs">Verifique tambem a caixa de spam. O link expira em 1 hora.</p>
            <button onClick={() => navigate('/login')} className="mt-6 btn btn-primary w-full py-3">Voltar ao Login</button>
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recuperar senha</h2>
            <p className="text-gray-500 text-sm mt-1 mb-6">Digite seu email cadastrado para receber o link de recuperacao.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading || !email} className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : 'Enviar link de recuperacao'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
