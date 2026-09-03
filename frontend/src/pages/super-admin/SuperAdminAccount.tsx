import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { superAdminApi } from '../../services/superAdminApi'

export function SuperAdminAccount() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) { setError('A confirmação não coincide com a nova senha'); return }
    if (newPassword.length < 8) { setError('A nova senha deve ter pelo menos 8 caracteres'); return }
    setSaving(true)
    try {
      await superAdminApi.post('/auth/change-password', { currentPassword, newPassword })
      setSuccess('Senha alterada com sucesso!')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao alterar senha')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md space-y-5">
      <h1 className="text-2xl font-bold">Minha conta</h1>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200"><KeyRound className="h-4 w-4" /> Trocar senha</div>
        {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-300">{success}</div>}
        <div>
          <label className="mb-1 block text-sm text-gray-300">Senha atual</label>
          <input type="password" required className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-300">Nova senha</label>
          <input type="password" required minLength={8} className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-300">Confirmar nova senha</label>
          <input type="password" required minLength={8} className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>
        <button disabled={saving} className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Alterar senha'}
        </button>
      </form>
    </div>
  )
}
