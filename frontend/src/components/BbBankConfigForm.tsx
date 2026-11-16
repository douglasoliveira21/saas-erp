import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { superAdminApi } from '../services/superAdminApi'

const fields = [
  ['agreement', 'Convênio de cobrança (7 dígitos)'], ['wallet', 'Carteira'], ['variation', 'Variação da carteira'],
  ['agency', 'Agência'], ['account', 'Conta com dígito'], ['pixKey', 'Chave Pix cadastrada no BB'],
  ['beneficiaryName', 'Nome / razão social do beneficiário'], ['beneficiaryDocument', 'CPF/CNPJ do beneficiário'],
  ['beneficiaryAddress', 'Endereço do beneficiário'],
] as const
const emptySecrets = { clientId: '', clientSecret: '', appKey: '', certificate: '', privateKey: '', pfxBase64: '', pfxPassword: '' }

export function BbBankConfigForm({ tenantId }: { tenantId?: string }) {
  const client = tenantId ? superAdminApi : api
  const base = tenantId ? `/tenants/${tenantId}/bb` : '/bb'
  const [config, setConfig] = useState<any>(null)
  const [environment, setEnvironment] = useState('sandbox')
  const [active, setActive] = useState(false)
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [secrets, setSecrets] = useState(emptySecrets)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [fileKey, setFileKey] = useState(0)
  const inputClass = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'

  async function load() {
    const { data } = await client.get(base + '/bank-config')
    setConfig(data); setSettings(data.settings || {}); setEnvironment(data.environment || 'sandbox'); setActive(data.active === true)
    setSecrets(emptySecrets); setFileKey(k => k + 1)
  }
  useEffect(() => { load().catch(e => { setFailed(true); setMessage(e.response?.data?.message || 'Não foi possível carregar a configuração do BB.') }) }, [tenantId])

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage(''); setFailed(false)
    try { await action() }
    catch (e: any) { setFailed(true); setMessage(String(e.response?.data?.message || e.message || 'Erro ao comunicar com o BB.')) }
    finally { setBusy(false) }
  }
  async function readPfx(file?: File) {
    if (!file) { setSecrets(s => ({ ...s, pfxBase64: '' })); return }
    if (file.size > 2_000_000) { setFailed(true); setMessage('O arquivo A1 deve ter até 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => setSecrets(s => ({ ...s, pfxBase64: String(reader.result).split(',')[1] || '' }))
    reader.onerror = () => { setFailed(true); setMessage('Não foi possível ler o arquivo A1.') }
    reader.readAsDataURL(file)
  }
  return <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 text-gray-900">
    <h3 className="font-semibold">Banco do Brasil — credenciais desta empresa</h3>
    <p className="text-sm text-gray-600">Configure boletos e Pix. Cada empresa utiliza suas próprias credenciais. Salve antes de testar. O teste de autenticação não emite cobrança.</p>
    <p className="text-xs text-gray-500">Recebimentos do BB são consultados pela conciliação periódica do ERP e pelo botão de consulta de status em recebimentos. O histórico de webhooks abaixo se refere às cobranças do Banco Inter.</p>
    {message && <div role="status" className={`rounded-lg p-3 text-sm ${failed ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{message}</div>}
    {!config ? <p className="text-sm text-gray-500">{failed ? 'Configuração indisponível.' : 'Carregando...'}</p> : <>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-gray-600">Ambiente<select disabled={busy} className={inputClass} value={environment} onChange={e => setEnvironment(e.target.value)}><option value="sandbox">Testes / homologação</option><option value="production">Produção</option></select></label>
        <label className="text-xs text-gray-600">Modalidade<select disabled={busy} className={inputClass} value={settings.modality || '1'} onChange={e => setSettings({ ...settings, modality: e.target.value })}><option value="1">1 — Simples</option><option value="4">4 — Vinculada</option></select></label>
        {(['clientId', 'clientSecret', 'appKey'] as const).map(field => <label key={field} className="text-xs text-gray-600">{{ clientId: 'Client ID', clientSecret: 'Client Secret', appKey: 'App Key' }[field]}
          <input autoComplete="off" disabled={busy} type="password" className={inputClass} value={secrets[field]} onChange={e => setSecrets({ ...secrets, [field]: e.target.value })} placeholder={config[{ clientId: 'hasClientId', clientSecret: 'hasClientSecret', appKey: 'hasAppKey' }[field]] ? 'Já cadastrado — deixe vazio para manter' : 'Copie do Developers BB'} />
        </label>)}
        {fields.map(([field, label]) => <label key={field} className="text-xs text-gray-600">{label}<input disabled={busy} className={inputClass} value={settings[field] || ''} onChange={e => setSettings({ ...settings, [field]: e.target.value })} /></label>)}
      </div>
      <div className="space-y-2 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium">Certificado A1 da empresa {config.hasCertificate ? '(já cadastrado)' : ''}</p>
        {config.certificateExpiresAt && <p className="text-xs text-gray-500">Validade: {new Date(config.certificateExpiresAt).toLocaleDateString('pt-BR')}</p>}
        <label className="block text-xs text-gray-600">Arquivo .pfx ou .p12<input key={fileKey} disabled={busy} type="file" accept=".pfx,.p12" className="mt-1 block text-sm" onChange={e => readPfx(e.target.files?.[0])} /></label>
        <label className="block text-xs text-gray-600">Senha do arquivo A1<input autoComplete="new-password" disabled={busy} type="password" className={inputClass} value={secrets.pfxPassword} onChange={e => setSecrets({ ...secrets, pfxPassword: e.target.value })} /></label>
        <p className="text-xs text-gray-500">Use o A1 que contém a chave privada da empresa. O cadastro do certificado público e da cadeia no Developers BB deve estar aprovado para o ambiente escolhido.</p>
        <details><summary className="cursor-pointer text-xs text-gray-600">Já tenho certificado e chave em PEM</summary><div className="mt-2 grid gap-2">
          <textarea aria-label="Certificado PEM" disabled={busy} className={inputClass} placeholder="-----BEGIN CERTIFICATE-----" value={secrets.certificate} onChange={e => setSecrets({ ...secrets, certificate: e.target.value })} />
          <textarea aria-label="Chave privada PEM" disabled={busy} className={inputClass} placeholder="-----BEGIN PRIVATE KEY-----" value={secrets.privateKey} onChange={e => setSecrets({ ...secrets, privateKey: e.target.value })} />
        </div></details>
      </div>
      <label className="flex items-center gap-2 text-sm"><input disabled={busy} type="checkbox" checked={settings.bolepix === true} onChange={e => setSettings({ ...settings, bolepix: e.target.checked })} /> Incluir Pix no boleto (convênio deve permitir BolePix)</label>
      <label className="flex items-center gap-2 text-sm"><input disabled={busy} type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Ativar emissão por esta empresa</label>
      <p className="text-xs text-amber-800">Produção gera cobranças reais. Homologue o convênio, o PDF e o recebimento antes do uso. Extratos e pagamentos em lote não estão disponíveis nesta integração.</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => run(async () => { await client.post(base + '/bank-config', { environment, active, settings, ...secrets }); await load(); setMessage('Configuração do BB salva para esta empresa.') })}>{busy ? 'Aguarde...' : 'Salvar configuração'}</button>
        {(['boleto', 'pix'] as const).map(kind => <button key={kind} disabled={busy || !config.configured} className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50" onClick={() => run(async () => { const { data } = await client.post(base + '/test-connection', { kind }, { timeout: 60000 }); setMessage(data.message) })}>Testar {kind === 'boleto' ? 'boleto' : 'Pix'}</button>)}
      </div>
    </>}
  </div>
}
