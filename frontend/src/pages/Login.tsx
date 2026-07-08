import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciais invalidas. Verifique seu email e senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-40 h-40 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-8">
            <img src="https://glpi.vgon.com.br/pics/logos/logo-GLPI-250-black.png" alt="VGON" className="w-32 h-32 object-contain brightness-0 invert" />
          </div>
          <p className="text-xl text-primary-100 mb-2">Sistema de Gestao</p>
          <p className="text-primary-200/80 text-sm">Plataforma integrada para gerenciamento de servicos, vendas, contratos e equipe tecnica.</p>
          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold text-white">SLA</p>
              <p className="text-xs text-primary-200 mt-1">Controle</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold text-white">GLPI</p>
              <p className="text-xs text-primary-200 mt-1">Integrado</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-2xl font-bold text-white">ERP</p>
              <p className="text-xs text-primary-200 mt-1">Completo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lado direito - formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-20 h-20 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <img src="https://glpi.vgon.com.br/pics/logos/logo-GLPI-250-black.png" alt="VGON" className="w-16 h-16 object-contain brightness-0 invert" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Entrar</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                'Entrar'
              )}
            </button>

            <div className="text-center">
              <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Esqueceu sua senha?
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            VGON Solucoes em Informatica &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
