import { useEffect, useState } from 'react'
import { Building2, Save, Image as ImageIcon } from 'lucide-react'
import { api } from '../services/api'

export function Empresa() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/company-profile')
      .then(r => setCfg(r.data || {}))
      .catch(() => setError('Erro ao carregar dados da empresa'))
  }, [])

  async function save() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.patch('/company-profile', cfg)
      setCfg(res.data)
      setMessage('Dados da empresa salvos com sucesso.')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar dados da empresa')
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) return <div className="card text-center py-8">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Empresa</h1>
          <p className="text-sm text-gray-500 mt-1">Dados cadastrais usados no cabeçalho de relatórios e documentos.</p>
        </div>
      </div>

      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="card space-y-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900">Dados cadastrais</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Razão social</label>
            <input className="input" value={cfg.razaoSocial || ''} onChange={e => setCfg({ ...cfg, razaoSocial: e.target.value })} placeholder="Razão social da empresa" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
            <input className="input" value={cfg.cnpj || ''} onChange={e => setCfg({ ...cfg, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input className="input" value={cfg.telefone || ''} onChange={e => setCfg({ ...cfg, telefone: e.target.value })} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição estadual</label>
            <input className="input" value={cfg.inscricaoEstadual || ''} onChange={e => setCfg({ ...cfg, inscricaoEstadual: e.target.value })} placeholder="Inscrição estadual" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição municipal</label>
            <input className="input" value={cfg.inscricaoMunicipal || ''} onChange={e => setCfg({ ...cfg, inscricaoMunicipal: e.target.value })} placeholder="Inscrição municipal" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
            <input className="input" value={cfg.cep || ''} onChange={e => setCfg({ ...cfg, cep: e.target.value })} placeholder="00000-000" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input className="input" value={cfg.endereco || ''} onChange={e => setCfg({ ...cfg, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Logo</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload do logo</label>
              <input
                type="file"
                accept="image/*"
                className="input text-sm"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 500000) { setError('Imagem muito grande. Máximo 500KB.'); return }
                  const reader = new FileReader()
                  reader.onload = () => { setCfg({ ...cfg, logo: reader.result as string }); setError('') }
                  reader.readAsDataURL(file)
                }}
              />
              <p className="text-xs text-gray-400 mt-1">PNG ou JPG, máximo 500KB. Aparece no cabeçalho dos relatórios.</p>
            </div>
            <div>
              {cfg.logo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
                  <img src={cfg.logo} alt="Logo" className="h-16 rounded border border-gray-200 bg-white p-1" />
                  <button onClick={() => setCfg({ ...cfg, logo: '' })} className="text-xs text-red-500 mt-1 hover:underline">Remover logo</button>
                </div>
              )}
            </div>
          </div>
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
