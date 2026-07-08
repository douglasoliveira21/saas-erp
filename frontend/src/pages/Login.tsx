import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, User, Lock, Building2, Mail, Headphones } from 'lucide-react'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim()) { setError('Informe seu usuário ou e-mail.'); return }
    if (!password) { setError('Informe sua senha.'); return }

    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciais inválidas. Verifique seu email e senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex"
      style={{
        backgroundImage: 'url(https://vgon.com.br/wp-content/uploads/2026/07/0fd6f66e-4941-475a-9cfb-f1b1838447c3.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Fallback gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-purple-900/10 pointer-events-none" />

      {/* LEFT SIDE - Institutional content */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between relative z-10 animate-fadeIn"
        style={{ paddingLeft: 'clamp(40px, 8vw, 140px)', paddingRight: '40px', paddingTop: '50px', paddingBottom: '40px' }}>
        
        {/* Logo + Brand */}
        <div>
          <div className="flex items-center gap-3 mb-12">
            <img
              src="https://vgon.com.br/wp-content/uploads/2026/07/Logo-ERP-scaled.png"
              alt="VGON ERP"
              className="h-12 object-contain"
            />
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(38px,4vw,56px)] font-bold leading-[1.1] tracking-tight text-[#1F2340]">
            Gestão integrada.<br />
            Resultados que <span className="text-[#6D35E8]">conectam.</span>
          </h1>

          {/* Description */}
          <p className="mt-6 text-[17px] leading-relaxed text-[#62677F] max-w-[580px]">
            Um ERP completo e inteligente, integrado com bancos, e-mails e GLPI para otimizar sua gestão e impulsionar seus resultados.
          </p>
        </div>

        {/* Integration Cards */}
        <div className="flex gap-4 mt-8">
          <div className="flex-1 bg-white/80 backdrop-blur-sm border border-[#EEE8FF] rounded-[16px] p-5 shadow-sm hover:-translate-y-1 hover:border-[#6D35E8]/30 hover:shadow-lg hover:shadow-purple-100 transition-all duration-250 cursor-default">
            <div className="w-10 h-10 bg-gradient-to-br from-[#8B3DFF] to-[#5424C7] rounded-xl flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-[#1F2340] text-sm">Bancos</h3>
            <p className="text-xs text-[#62677F] mt-1 leading-relaxed">Conciliação bancária, fluxo de caixa e contas a pagar/receber.</p>
          </div>

          <div className="flex-1 bg-white/80 backdrop-blur-sm border border-[#EEE8FF] rounded-[16px] p-5 shadow-sm hover:-translate-y-1 hover:border-[#6D35E8]/30 hover:shadow-lg hover:shadow-purple-100 transition-all duration-250 cursor-default">
            <div className="w-10 h-10 bg-gradient-to-br from-[#8B3DFF] to-[#5424C7] rounded-xl flex items-center justify-center mb-3">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-[#1F2340] text-sm">E-mails</h3>
            <p className="text-xs text-[#62677F] mt-1 leading-relaxed">Integração com provedores de e-mail e automação de processos.</p>
          </div>

          <div className="flex-1 bg-white/80 backdrop-blur-sm border border-[#EEE8FF] rounded-[16px] p-5 shadow-sm hover:-translate-y-1 hover:border-[#6D35E8]/30 hover:shadow-lg hover:shadow-purple-100 transition-all duration-250 cursor-default">
            <div className="w-10 h-10 bg-gradient-to-br from-[#8B3DFF] to-[#5424C7] rounded-xl flex items-center justify-center mb-3">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-[#1F2340] text-sm">GLPI</h3>
            <p className="text-xs text-[#62677F] mt-1 leading-relaxed">Gestão de chamados, ativos e suporte técnico integrado.</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10 animate-slideIn">
        <div className="w-full max-w-[480px] bg-white/[0.97] backdrop-blur-sm rounded-[20px] p-10 shadow-[0_24px_70px_rgba(45,20,100,0.18)] border border-white/80">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-[28px] font-bold text-[#1F2340]">Bem-vindo de volta!</h2>
            <p className="text-[#73778F] mt-2 text-sm">Acesse sua conta para continuar</p>
            
            {/* Logo */}
            <div className="mt-5 flex justify-center">
              <img
                src="https://vgon.com.br/wp-content/uploads/2026/07/Logo-ERP-scaled.png"
                alt="VGON ERP"
                className="h-16 object-contain drop-shadow-sm"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-shake">
                {error}
              </div>
            )}

            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#1F2340] mb-1.5">
                Usuário ou e-mail
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9B9FB5]" />
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[54px] pl-11 pr-4 border border-[#DCD8E8] rounded-[10px] text-[#1F2340] placeholder-[#A8ABBD] bg-white text-sm focus:outline-none focus:border-[#6D35E8] focus:ring-[3px] focus:ring-[#6D35E8]/12 transition-all"
                  placeholder="Digite seu usuário ou e-mail"
                  autoComplete="username"
                  aria-label="Usuário ou e-mail"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1F2340] mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9B9FB5]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[54px] pl-11 pr-12 border border-[#DCD8E8] rounded-[10px] text-[#1F2340] placeholder-[#A8ABBD] bg-white text-sm focus:outline-none focus:border-[#6D35E8] focus:ring-[3px] focus:ring-[#6D35E8]/12 transition-all"
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  aria-label="Senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9B9FB5] hover:text-[#6D35E8] transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#DCD8E8] text-[#6D35E8] focus:ring-[#6D35E8]/20"
                />
                <span className="text-sm text-[#62677F]">Lembrar-me</span>
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-[#6D35E8] hover:underline font-medium"
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[56px] rounded-[9px] text-white font-semibold text-[16px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-[1px] hover:shadow-lg hover:shadow-[#6D35E8]/30 active:translate-y-0 active:scale-[0.99]"
              style={{ background: 'linear-gradient(90deg, #8B3DFF 0%, #6D35E8 50%, #5424C7 100%)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-[13px] text-[#73778F]">
            &copy; {new Date().getFullYear()} VGON ERP. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(15px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
        .animate-fadeIn { animation: fadeIn 600ms ease-out }
        .animate-slideIn { animation: slideIn 600ms ease-out 100ms both }
        .animate-shake { animation: shake 300ms ease }
        @media (prefers-reduced-motion: reduce) { .animate-fadeIn, .animate-slideIn, .animate-shake { animation: none } }
      `}</style>
    </div>
  )
}
