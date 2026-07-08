import { useEffect, useState } from 'react'
import { Mail, Save, ShieldCheck } from 'lucide-react'
import { api } from '../services/api'

export function EmailSettings() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/mail/config')
      .then(r => setCfg({ ...r.data, authPass: '' }))
      .catch(() => setError('Erro ao carregar configuracao de email'))
  }, [])

  async function save() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.patch('/mail/config', cfg)
      setCfg({ ...res.data, authPass: '' })
      setMessage('Configuracao de email salva com sucesso.')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar configuracao')
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) return <div className="card text-center py-8">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configuracao de Email</h1>
          <p className="text-sm text-gray-500 mt-1">SMTP usado para enviar boletos, notas e comunicados aos clientes.</p>
        </div>
      </div>

      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="card space-y-6">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900">Servidor SMTP</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servidor</label>
            <input className="input" value={cfg.host || ''} onChange={e => setCfg({ ...cfg, host: e.target.value })} placeholder="smtp.seudominio.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
            <input className="input" type="number" value={cfg.port || 587} onChange={e => setCfg({ ...cfg, port: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input className="input" type="email" value={cfg.authUser || ''} onChange={e => setCfg({ ...cfg, authUser: e.target.value })} placeholder="financeiro@empresa.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input className="input" type="password" value={cfg.authPass || ''} onChange={e => setCfg({ ...cfg, authPass: e.target.value })} placeholder={cfg.hasPassword ? 'Senha ja cadastrada' : 'Senha do email'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email remetente</label>
            <input className="input" type="email" value={cfg.fromEmail || ''} onChange={e => setCfg({ ...cfg, fromEmail: e.target.value })} placeholder="financeiro@empresa.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome remetente</label>
            <input className="input" value={cfg.fromName || ''} onChange={e => setCfg({ ...cfg, fromName: e.target.value })} placeholder="VGON" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={Boolean(cfg.secure)} onChange={e => setCfg({ ...cfg, secure: e.target.checked })} />
          Usar conexao segura SSL/TLS
        </label>

        <div className="border-t border-gray-200 pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Copia automatica</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={Boolean(cfg.copyEnabled)} onChange={e => setCfg({ ...cfg, copyEnabled: e.target.checked })} />
            Enviar copia de todos os emails
          </label>
          {cfg.copyEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email em copia</label>
              <input className="input" type="email" value={cfg.copyEmail || ''} onChange={e => setCfg({ ...cfg, copyEmail: e.target.value })} placeholder="copia@empresa.com.br" />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
