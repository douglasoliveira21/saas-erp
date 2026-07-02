import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { User, Lock, Mail, Check, Eye, EyeOff } from 'lucide-react'

export function Profile() {
  const { user, logout } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome e obrigatorio'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const res = await api.post('/auth/update-profile', { name, email })
      setMessage(res.data.message)
      // Atualizar localStorage
      if (res.data.user) {
        localStorage.setItem('@GestaoTI:user', JSON.stringify(res.data.user))
      }
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword) { setError('Digite a senha atual'); return }
    if (newPassword.length < 6) { setError('Nova senha deve ter no minimo 6 caracteres'); return }
    if (newPassword !== confirmPassword) { setError('Senhas nao conferem'); return }
    setSavingPassword(true); setError(''); setMessage('')
    try {
      const res = await api.post('/auth/update-profile', { currentPassword, password: newPassword })
      setMessage(res.data.message)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao alterar senha') }
    finally { setSavingPassword(false) }
  }

  const roleLabels: Record<string, string> = { admin: 'Administrador', financeiro: 'Financeiro', tecnico: 'Tecnico' }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Meu Perfil</h1>

      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2"><Check className="w-4 h-4" /> {message}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {/* Info do perfil */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-600">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{user?.name}</h2>
            <p className="text-gray-500">{user?.email}</p>
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium mt-1 inline-block">
              {roleLabels[user?.role || ''] || user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Editar dados */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5" /> Dados Pessoais
        </h3>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
              Salvar Alteracoes
            </button>
          </div>
        </form>
      </div>

      {/* Alterar senha */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" /> Alterar Senha
        </h3>
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha Atual</label>
            <div className="relative">
              <input className="input pr-10" type={showPasswords ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Digite sua senha atual" />
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Senha</label>
            <input className="input" type={showPasswords ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Nova Senha</label>
            <input className="input" type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingPassword} className="btn btn-primary flex items-center gap-2">
              {savingPassword ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Lock className="w-4 h-4" />}
              Alterar Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
