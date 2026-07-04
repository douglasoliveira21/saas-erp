import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Upload, Shield, FileText, XCircle, AlertTriangle, Settings, RefreshCw, Plus, Check, X, Send, Download, Eye } from 'lucide-react'

interface Certificate { id: string; name: string; companyName: string; cnpj: string; validFrom: string; validUntil: string; isActive: boolean }
interface Invoice { id: string; type: string; number: number; series: number; accessKey: string; protocolNumber: string; verificationCode: string; status: string; recipientName: string; recipientCnpj: string; totalValue: number; rejectionReason: string; cancelReason: string; issuedAt: string; createdAt: string; xmlSent: string; xmlAuthorized: string; observations: string; sale?: any }
interface Sale { id: string; customer: { name: string; cpfCnpj: string; email: string; address: string; city: string; uf: string; neighborhood: string; cep: string; stateRegistration: string }; totalAmount: number; status: string; paymentMethod: string; items: any[] }

const statusLabels: Record<string, string> = { pendente: 'Pendente', processando: 'Processando', autorizada: 'Autorizada', rejeitada: 'Rejeitada', cancelada: 'Cancelada' }
const statusColors: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-700', processando: 'bg-blue-100 text-blue-700', autorizada: 'bg-green-100 text-green-700', rejeitada: 'bg-red-100 text-red-700', cancelada: 'bg-gray-100 text-gray-700' }

export function Fiscal() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<'invoices' | 'emit' | 'certificates' | 'config'>('invoices')
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Upload cert
  const [uploading, setUploading] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPassword, setCertPassword] = useState('')
  const [certName, setCertName] = useState('')

  // Emissao
  const [emitType, setEmitType] = useState<'nfe' | 'nfse'>('nfse')
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientCnpj, setRecipientCnpj] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [discriminacao, setDiscriminacao] = useState('')
  const [itemLista, setItemLista] = useState('010701')
  const [aliquota, setAliquota] = useState('5')
  const [emitting, setEmitting] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [recipientCity, setRecipientCity] = useState('')
  const [recipientUf, setRecipientUf] = useState('')
  const [recipientNeighborhood, setRecipientNeighborhood] = useState('')
  const [recipientCep, setRecipientCep] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientIE, setRecipientIE] = useState('')
  const [nfeModelo, setNfeModelo] = useState('55')
  const [nfeTpNF, setNfeTpNF] = useState('1')
  const [nfeTpPag, setNfeTpPag] = useState('01')
  const [nfeAmbiente, setNfeAmbiente] = useState(1)

  // Visualizacao
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [viewConfig, setViewConfig] = useState<any>(null)
  const [showView, setShowView] = useState(false)
  const [viewLoading, setViewLoading] = useState(false)
  const [xmlContent, setXmlContent] = useState<{ xmlSent?: string; xmlAuthorized?: string; xmlCancel?: string } | null>(null)
  const [showXml, setShowXml] = useState(false)

  // Filtros e paginacao da lista de notas
  const [invSearch, setInvSearch] = useState('')
  const [invMonth, setInvMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') })
  const [invDate, setInvDate] = useState('')
  const [invPage, setInvPage] = useState(1)
  const [invPerPage, setInvPerPage] = useState(10)

  useEffect(() => { load() }, [])

  // Detectar parametro ?emit=saleId na URL para pre-selecionar venda
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const emitSaleId = params.get('emit')
    if (emitSaleId && sales.length > 0) {
      setTab('emit')
      onSelectSale(emitSaleId)
    }
  }, [sales])

  async function load() {
    try {
      const [certs, invs, salesRes, cfgRes] = await Promise.all([
        api.get('/fiscal/certificates'),
        api.get('/fiscal/invoices'),
        api.get('/sales'),
        api.get('/fiscal/config').catch(() => ({ data: null })),
      ])
      setCertificates(certs.data); setInvoices(invs.data); setSales(salesRes.data)
      if (cfgRes.data) setNfeAmbiente(cfgRes.data.environment || 1)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao carregar') }
    finally { setLoading(false) }
  }

  const activeCert = certificates.find(c => c.isActive)

  // Ao selecionar venda, preencher dados
  function onSelectSale(saleId: string) {
    setSelectedSaleId(saleId)
    const sale = sales.find(s => s.id === saleId)
    if (sale) {
      setRecipientName(sale.customer?.name || '')
      setRecipientCnpj(sale.customer?.cpfCnpj || '')
      setTotalValue(String(Number(sale.totalAmount).toFixed(2)))
      setDiscriminacao(sale.items?.map((i: any) => i.name).join(', ') || 'Servicos de informatica')
      setRecipientEmail(sale.customer?.email || '')
      setRecipientAddress(sale.customer?.address || '')
      setRecipientCity(sale.customer?.city || '')
      setRecipientUf(sale.customer?.uf || '')
      setRecipientNeighborhood(sale.customer?.neighborhood || '')
      setRecipientCep(sale.customer?.cep || '')
      setRecipientPhone((sale.customer as any)?.phone || '')
      setRecipientIE((sale.customer as any)?.stateRegistration || '')

      // Auto-detectar tipo de nota
      const items = sale.items || []
      const hasService = items.some((i: any) => i.serviceId)
      const hasProduct = items.some((i: any) => i.productId)
      const cpfCnpj = (sale.customer?.cpfCnpj || '').replace(/\D/g, '')

      if (hasService && !hasProduct) {
        // Somente servicos -> NFS-e
        setEmitType('nfse')
      } else {
        // Produtos ou misto -> NF-e
        setEmitType('nfe')
        if (cpfCnpj.length === 11) {
          // CPF = consumidor final -> NFC-e (modelo 65)
          setNfeModelo('65')
        } else {
          // CNPJ = empresa -> NF-e (modelo 55)
          setNfeModelo('55')
        }
      }
    }
  }

  async function emitNote() {
    if (!activeCert) { setError('Nenhum certificado ativo'); return }
    if (!recipientName || !totalValue) { setError('Preencha destinatario e valor'); return }
    setEmitting(true); setError(''); setSuccess('')
    try {
      const payload = {
        saleId: selectedSaleId || undefined,
        certId: activeCert.id,
        serviceData: emitType === 'nfse' ? {
          recipientCnpj, recipientName, totalValue: parseFloat(totalValue),
          discriminacao, codTribNacional: itemLista, aliquota: parseFloat(aliquota),
          recipientEmail, recipientAddress, recipientCity, recipientUf,
          recipientNeighborhood, recipientCep, recipientPhone,
        } : undefined,
        saleData: emitType === 'nfe' ? {
          recipientCnpj, recipientName, totalValue: parseFloat(totalValue),
          modelo: nfeModelo, tpNF: nfeTpNF, tPag: nfeTpPag,
          recipientAddress, recipientNeighborhood, recipientCity, recipientUf, recipientCep, recipientIE,
          items: (window as any).__nfeImportedItems || (sales.find(s => s.id === selectedSaleId)?.items || []).map((i: any) => ({
            name: i.name, quantity: i.quantity, unitPrice: i.unitPrice || i.unit_price,
            code: i.productId || i.code || '1', ncm: i.ncm || '', cfop: i.cfop || '',
            unit: i.unit || 'UN', cest: i.cest || '',
          })),
        } : undefined,
      }
      const endpoint = emitType === 'nfe' ? '/fiscal/nfe/emit' : '/fiscal/nfse/emit'
      const res = await api.post(endpoint, payload)
      if (res.data.status === 'autorizada') {
        setSuccess('Nota emitida com sucesso! Protocolo: ' + (res.data.protocolNumber || res.data.number))
      } else if (res.data.status === 'rejeitada') {
        setError('Nota rejeitada: ' + (res.data.rejectionReason || 'Verifique os dados'))
      } else {
        setSuccess('Nota registrada com status: ' + res.data.status)
      }
      load()
      setTab('invoices')
      // Limpar itens importados do XML
      delete (window as any).__nfeImportedItems
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao emitir nota') }
    finally { setEmitting(false) }
  }

  async function uploadCert() {
    if (!certFile || !certPassword) { setError('Selecione o .pfx e digite a senha'); return }
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', certFile)
      fd.append('password', certPassword)
      fd.append('name', certName || certFile.name)
      await api.post('/fiscal/certificates/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setCertFile(null); setCertPassword(''); setCertName('')
      setSuccess('Certificado instalado com sucesso!')
      load()
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao enviar certificado') }
    finally { setUploading(false) }
  }

  async function toggleCert(id: string) { try { await api.patch('/fiscal/certificates/' + id + '/toggle'); load() } catch {} }
  async function removeCert(id: string) { if (!confirm('Remover?')) return; try { await api.delete('/fiscal/certificates/' + id); load() } catch {} }
  async function checkStatus() {
    if (!activeCert) { setError('Nenhum certificado ativo'); return }
    try { const r = await api.post('/fiscal/nfe/status', { certId: activeCert.id }); alert(r.data.success ? 'SEFAZ MG: Online' : 'Erro: ' + r.data.error) }
    catch (e: any) { setError(e.response?.data?.message || 'Erro') }
  }

  async function cancelInvoice(id: string) {
    const reason = prompt('Motivo do cancelamento (min 15 caracteres):')
    if (!reason || reason.length < 15) { setError('Motivo deve ter no minimo 15 caracteres'); return }
    if (!activeCert) { setError('Nenhum certificado ativo'); return }
    const inv = invoices.find(i => i.id === id)
    const endpoint = inv?.type === 'nfe' ? '/fiscal/nfe/cancel' : '/fiscal/nfse/cancel'
    try { await api.post(endpoint, { invoiceId: id, reason, certId: activeCert.id }); setSuccess('Nota cancelada'); load() }
    catch (e: any) { setError(e.response?.data?.message || 'Erro ao cancelar') }
  }

  async function openViewInvoice(id: string) {
    setViewLoading(true); setShowView(true)
    try {
      const [invRes, xmlRes] = await Promise.all([
        api.get('/fiscal/invoices/' + id + '/danfse'),
        api.get('/fiscal/invoices/' + id + '/xml'),
      ])
      setViewInvoice(invRes.data.invoice)
      setViewConfig(invRes.data.config)
      setXmlContent(xmlRes.data)
    } catch (e: any) { setError(e.response?.data?.message || 'Erro ao carregar nota') }
    finally { setViewLoading(false) }
  }

  function downloadXml(id: string) {
    const token = localStorage.getItem('@GestaoTI:token')
    const inv = invoices.find(i => i.id === id) || viewInvoice
    // NF-e usa endpoint proprio, NFS-e usa API Cidade360
    if (inv?.type === 'nfe') {
      fetch(`/api/fiscal/nfe/download-xml/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => {
        if (!r.ok) return r.json().then(d => { setError(d.message || 'Erro ao baixar XML'); throw new Error() })
        return r.blob()
      }).then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `NFe_${inv?.number || 'nota'}_serie${inv?.series || 1}.xml`
        a.click()
        URL.revokeObjectURL(url)
      }).catch(() => {})
    } else if (inv?.status === 'autorizada' && inv?.accessKey) {
      fetch(`/api/fiscal/nfse/xml-oficial/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => {
        if (!r.ok) return r.json().then(d => { setError(d.message || 'Erro ao baixar XML'); throw new Error() })
        return r.blob()
      }).then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `NFSe_${inv?.number || 'nota'}_serie${inv?.series || 1}_oficial.xml`
        a.click()
        URL.revokeObjectURL(url)
      }).catch(() => {})
    } else {
      fetch(`/api/fiscal/invoices/${id}/download-xml`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.blob()).then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${inv?.type || 'nota'}_${inv?.number || 'rascunho'}_serie${inv?.series || 1}.xml`
        a.click()
        URL.revokeObjectURL(url)
      })
    }
  }

  function downloadPdf(id: string) {
    const token = localStorage.getItem('@GestaoTI:token')
    const inv = invoices.find(i => i.id === id) || viewInvoice
    setError('')
    if (inv?.type === 'nfe') {
      // NF-e: gerar DANFE via impressao
      viewDanfeNfe(id)
    } else {
      // NFS-e: baixar PDF oficial da Cidade360
      fetch(`/api/fiscal/nfse/pdf/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => {
        if (!r.ok) return r.json().then(d => { setError(d.message || 'Erro ao baixar PDF'); throw new Error() })
        return r.blob()
      }).then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `NFSe_${inv?.number || 'nota'}_serie${inv?.series || 1}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }).catch(() => {})
    }
  }

  function viewPdf(id: string) {
    const token = localStorage.getItem('@GestaoTI:token')
    const inv = invoices.find(i => i.id === id) || viewInvoice
    setError('')
    if (inv?.type === 'nfe') {
      viewDanfeNfe(id)
    } else {
      fetch(`/api/fiscal/nfse/pdf/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => {
        if (!r.ok) return r.json().then(d => { setError(d.message || 'Erro ao carregar PDF'); throw new Error() })
        return r.blob()
      }).then(blob => {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
      }).catch(() => {})
    }
  }

  function viewDanfeNfe(id: string) {
    const token = localStorage.getItem('@GestaoTI:token')
    fetch(`/api/fiscal/nfe/danfe/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      const inv = data.invoice
      const cfg = data.config
      const items = inv.sale?.items || []
      const chave = inv.accessKey || ''
      const chaveFormatada = chave.replace(/(.{4})/g, '$1 ').trim()

      const printWindow = window.open('', '_blank')
      if (!printWindow) return
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DANFE - ${inv.number}</title><style>
        body{font-family:Arial,sans-serif;margin:10px;font-size:10px;color:#000}
        .border{border:1px solid #000;padding:4px;margin-bottom:2px}
        .header{display:flex;gap:5px;margin-bottom:2px}
        .header-left{flex:1;border:1px solid #000;padding:5px;text-align:center}
        .header-center{flex:2;border:1px solid #000;padding:5px}
        .header-right{flex:1;border:1px solid #000;padding:5px;text-align:center}
        .row{display:flex;gap:2px;margin-bottom:2px}
        .cell{border:1px solid #000;padding:3px;flex:1}
        .cell label{font-size:7px;color:#333;display:block}
        .cell span{font-size:9px;font-weight:500}
        .title{font-weight:bold;font-size:8px;background:#eee;padding:2px 4px;border:1px solid #000;margin-bottom:2px}
        table{width:100%;border-collapse:collapse;font-size:8px;margin-bottom:2px}
        table th,table td{border:1px solid #000;padding:2px 4px;text-align:left}
        table th{background:#eee;font-size:7px}
        .chave{font-family:monospace;font-size:9px;letter-spacing:1px;text-align:center;padding:5px;border:1px solid #000;margin-bottom:2px}
        .total{text-align:right;font-size:12px;font-weight:bold}
        @media print{body{margin:5mm}}
      </style></head><body>
        <div class="header">
          <div class="header-left">
            <strong>${cfg?.companyName || ''}</strong><br>
            <span style="font-size:8px">CNPJ: ${cfg?.cnpj || ''}<br>IE: ${cfg?.stateRegistration || ''}</span>
          </div>
          <div class="header-center">
            <div style="text-align:center;font-size:14px;font-weight:bold">DANFE</div>
            <div style="text-align:center;font-size:8px">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA</div>
            <div style="text-align:center;font-size:8px;margin-top:3px">
              ${inv.status === 'autorizada' ? '0 - ENTRADA &nbsp;&nbsp; <strong>1 - SAIDA</strong>' : ''}
            </div>
            <div style="text-align:center;font-size:10px;margin-top:3px">
              N.: <strong>${String(inv.number).padStart(9,'0')}</strong> &nbsp; Serie: <strong>${inv.series}</strong>
            </div>
          </div>
          <div class="header-right">
            <div style="font-size:8px">CHAVE DE ACESSO</div>
            <div style="font-family:monospace;font-size:8px;word-break:break-all">${chave}</div>
            <div style="margin-top:5px;font-size:8px">Protocolo: ${inv.protocolNumber || '-'}</div>
          </div>
        </div>

        <div class="title">DESTINATARIO / REMETENTE</div>
        <div class="row">
          <div class="cell" style="flex:3"><label>NOME/RAZAO SOCIAL</label><span>${inv.recipientName || '-'}</span></div>
          <div class="cell"><label>CNPJ/CPF</label><span>${inv.recipientCnpj || '-'}</span></div>
          <div class="cell"><label>EMISSAO</label><span>${inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('pt-BR') : '-'}</span></div>
        </div>

        <div class="title">PRODUTOS / SERVICOS</div>
        <table>
          <thead><tr><th>CODIGO</th><th>DESCRICAO</th><th>NCM</th><th>CFOP</th><th>UN</th><th>QTD</th><th>V.UNIT</th><th>V.TOTAL</th></tr></thead>
          <tbody>
            ${items.map((it: any) => `<tr><td>${it.productId?.substring(0,8) || '-'}</td><td>${it.name || '-'}</td><td>-</td><td>-</td><td>UN</td><td>${it.quantity}</td><td>${Number(it.unitPrice).toFixed(2)}</td><td>${Number(it.totalPrice).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>

        <div class="row">
          <div class="cell"><label>VALOR TOTAL DOS PRODUTOS</label><span class="total">R$ ${Number(inv.totalValue || 0).toFixed(2)}</span></div>
          <div class="cell"><label>VALOR TOTAL DA NOTA</label><span class="total">R$ ${Number(inv.totalValue || 0).toFixed(2)}</span></div>
        </div>

        <div class="title">DADOS ADICIONAIS</div>
        <div class="border" style="min-height:30px;font-size:8px">
          Documento emitido por ME ou EPP optante pelo Simples Nacional.<br>
          Nao gera direito a credito fiscal de IPI.
        </div>

        <div style="text-align:center;font-size:7px;margin-top:5px;color:#666">
          Gerado pelo sistema VGON ERP | ${new Date().toLocaleString('pt-BR')}
        </div>
      </body></html>`
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => { printWindow.print() }
    }).catch(() => setError('Erro ao gerar DANFE'))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Modulo Fiscal</h1>
        <div className="flex gap-2">
          <button onClick={checkStatus} className="btn btn-secondary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Status SEFAZ</button>
          {activeCert && <button onClick={() => setTab('emit')} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Emitir Nota</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('invoices')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (tab === 'invoices' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>Notas Emitidas</button>
        <button onClick={() => setTab('emit')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (tab === 'emit' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>Emitir Nota</button>
        <button onClick={() => setTab('certificates')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (tab === 'certificates' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>Certificados</button>
        {isAdmin && <button onClick={() => setTab('config')} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (tab === 'config' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>Configuracao</button>}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2"><Check className="w-4 h-4" /> {success}</div>}

      {!loading && !activeCert && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800">Certificado A1 nao configurado</p>
            <p className="text-sm text-yellow-700 mt-1">Faca upload do certificado .pfx para liberar a emissao de notas.</p>
            <button onClick={() => setTab('certificates')} className="mt-2 text-sm text-primary-600 font-medium hover:underline">Ir para Certificados</button>
          </div>
        </div>
      )}

      {/* === EMITIR NOTA === */}
      {tab === 'emit' && (
        <div className="card">
          {!activeCert ? (
            <div className="text-center py-8 text-gray-500">Configure um certificado A1 antes de emitir notas.</div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Emitir Nota Fiscal</h2>

              {/* Tipo de nota */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Nota</label>
                <div className="flex gap-3">
                  <button onClick={() => setEmitType('nfse')} className={'px-4 py-3 rounded-lg border-2 text-sm font-medium flex-1 text-center ' + (emitType === 'nfse' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600')}>
                    <FileText className="w-5 h-5 mx-auto mb-1" />
                    NFS-e (Servico)
                    <p className="text-xs font-normal mt-1">Cidade360 / Contagem</p>
                  </button>
                  <button onClick={() => setEmitType('nfe')} className={'px-4 py-3 rounded-lg border-2 text-sm font-medium flex-1 text-center ' + (emitType === 'nfe' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600')}>
                    <FileText className="w-5 h-5 mx-auto mb-1" />
                    NF-e (Produto)
                    <p className="text-xs font-normal mt-1">SEFAZ Minas Gerais</p>
                  </button>
                </div>
              </div>

              {/* Vincular a venda (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a Venda (opcional)</label>
                <select className="input" value={selectedSaleId} onChange={e => onSelectSale(e.target.value)}>
                  <option value="">Sem vinculo - preencher manualmente</option>
                  {sales.filter(s => !['cancelado'].includes(s.status)).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.customer?.name} - R$ {Number(s.totalAmount).toFixed(2)} ({s.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Ao selecionar uma venda, os dados serao preenchidos automaticamente</p>
              </div>

              {/* Dados do destinatario */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-medium text-gray-700">Destinatario</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome / Razao Social *</label>
                    <input className="input" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nome do destinatario" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CPF/CNPJ</label>
                    <input className="input" value={recipientCnpj} onChange={e => setRecipientCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input className="input" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Telefone</label>
                    <input className="input" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder="(31) 99999-9999" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Inscricao Estadual (IE)</label>
                    <input className="input" value={recipientIE} onChange={e => setRecipientIE(e.target.value)} placeholder="Deixe vazio se nao contribuinte" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Endereco (Logradouro, Numero)</label>
                    <input className="input" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} placeholder="Rua Exemplo, 123" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bairro</label>
                    <input className="input" value={recipientNeighborhood} onChange={e => setRecipientNeighborhood(e.target.value)} placeholder="Centro" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                    <input className="input" value={recipientCity} onChange={e => setRecipientCity(e.target.value)} placeholder="Contagem" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">UF</label>
                    <input className="input" maxLength={2} value={recipientUf} onChange={e => setRecipientUf(e.target.value.toUpperCase())} placeholder="MG" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CEP</label>
                    <input className="input" value={recipientCep} onChange={e => setRecipientCep(e.target.value)} placeholder="32000000" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Valor Total (R$) *</label>
                  <input className="input" type="number" step="0.01" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              {/* Campos especificos NFS-e */}
              {emitType === 'nfse' && (
                <div className="p-4 bg-purple-50 rounded-lg space-y-4">
                  <h3 className="font-medium text-purple-700">Dados do Servico (NFS-e)</h3>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Discriminacao do Servico *</label>
                    <textarea className="input" rows={3} value={discriminacao} onChange={e => setDiscriminacao(e.target.value)} placeholder="Descricao detalhada dos servicos prestados..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Codigo Tributacao Nacional ISS</label>
                      <select className="input" value={itemLista} onChange={e => setItemLista(e.target.value)}>
                        <option value="010701">01.07.01 - Suporte tecnico em informatica</option>
                        <option value="010801">01.08.01 - Planejamento e manutencao de paginas</option>
                        <option value="010401">01.04.01 - Elaboracao de programas</option>
                        <option value="010501">01.05.01 - Licenciamento de software</option>
                        <option value="010601">01.06.01 - Assessoria e consultoria em informatica</option>
                        <option value="140201">14.02.01 - Assistencia tecnica</option>
                        <option value="140101">14.01.01 - Manutencao de maquinas e equipamentos</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Aliquota ISS (%)</label>
                      <input className="input" type="number" step="0.01" value={aliquota} onChange={e => setAliquota(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Campos especificos NF-e */}
              {emitType === 'nfe' && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-4">
                  <h3 className="font-medium text-blue-700">Dados da NF-e (Produto)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Modelo</label>
                      <select className="input" value={nfeModelo} onChange={e => setNfeModelo(e.target.value)}>
                        <option value="55">55 - NF-e (entre empresas)</option>
                        <option value="65">65 - NFC-e (consumidor)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                      <select className="input" value={nfeTpNF} onChange={e => setNfeTpNF(e.target.value)}>
                        <option value="1">1 - Saida (Venda)</option>
                        <option value="0">0 - Entrada (Compra)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Forma Pagamento</label>
                      <select className="input" value={nfeTpPag} onChange={e => setNfeTpPag(e.target.value)}>
                        <option value="01">Dinheiro</option>
                        <option value="02">Cheque</option>
                        <option value="03">Cartao Credito</option>
                        <option value="04">Cartao Debito</option>
                        <option value="05">Credito Loja</option>
                        <option value="15">Boleto</option>
                        <option value="17">Pix</option>
                        <option value="99">Outros</option>
                      </select>
                    </div>
                  </div>

                  {/* Upload XML para NF-e de Entrada */}
                  {nfeTpNF === '0' && (
                    <div className="p-4 bg-white border-2 border-dashed border-blue-300 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Upload className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-700">Importar XML da NF-e de entrada</p>
                          <p className="text-xs text-gray-500">Faça upload do XML recebido do fornecedor para preenchimento automático</p>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept=".xml"
                        className="input text-sm"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            const text = await file.text()
                            // Parse XML da NF-e
                            const parser = new DOMParser()
                            const doc = parser.parseFromString(text, 'text/xml')

                            // Extrair dados do emitente (fornecedor = destinatario na entrada)
                            const emit = doc.querySelector('emit')
                            const emitName = emit?.querySelector('xNome')?.textContent || ''
                            const emitCnpj = emit?.querySelector('CNPJ')?.textContent || emit?.querySelector('CPF')?.textContent || ''
                            const emitIE = emit?.querySelector('IE')?.textContent || ''
                            const enderEmit = emit?.querySelector('enderEmit')
                            const emitAddr = enderEmit?.querySelector('xLgr')?.textContent || ''
                            const emitNum = enderEmit?.querySelector('nro')?.textContent || ''
                            const emitBairro = enderEmit?.querySelector('xBairro')?.textContent || ''
                            const emitCity = enderEmit?.querySelector('xMun')?.textContent || ''
                            const emitUf = enderEmit?.querySelector('UF')?.textContent || ''
                            const emitCep = enderEmit?.querySelector('CEP')?.textContent || ''

                            // Extrair valor total
                            const icmsTot = doc.querySelector('ICMSTot')
                            const vNF = icmsTot?.querySelector('vNF')?.textContent || ''

                            // Extrair itens
                            const dets = doc.querySelectorAll('det')
                            const parsedItems: any[] = []
                            dets.forEach(det => {
                              const prod = det.querySelector('prod')
                              if (prod) {
                                parsedItems.push({
                                  name: prod.querySelector('xProd')?.textContent || '',
                                  code: prod.querySelector('cProd')?.textContent || '',
                                  ncm: prod.querySelector('NCM')?.textContent || '',
                                  cfop: prod.querySelector('CFOP')?.textContent || '',
                                  unit: prod.querySelector('uCom')?.textContent || 'UN',
                                  quantity: parseFloat(prod.querySelector('qCom')?.textContent || '1'),
                                  unitPrice: parseFloat(prod.querySelector('vUnCom')?.textContent || '0'),
                                  ean: prod.querySelector('cEAN')?.textContent || '',
                                  cest: prod.querySelector('CEST')?.textContent || '',
                                })
                              }
                            })

                            // Preencher os campos
                            setRecipientName(emitName)
                            setRecipientCnpj(emitCnpj)
                            setRecipientIE(emitIE)
                            setRecipientAddress(emitAddr + (emitNum ? ', ' + emitNum : ''))
                            setRecipientNeighborhood(emitBairro)
                            setRecipientCity(emitCity)
                            setRecipientUf(emitUf)
                            setRecipientCep(emitCep)
                            if (vNF) setTotalValue(vNF)

                            // Guardar itens parseados para envio
                            if (parsedItems.length > 0) {
                              (window as any).__nfeImportedItems = parsedItems

                              // Importar produtos automaticamente no cadastro
                              try {
                                const importPayload = parsedItems.map((item: any) => ({
                                  name: item.name,
                                  code: item.code,
                                  quantity: item.quantity || 1,
                                  purchasePrice: item.unitPrice || 0,
                                  ncm: item.ncm || null,
                                  cfop: item.cfop || null,
                                  cest: item.cest || null,
                                  unit: item.unit || 'UN',
                                  supplier: emitName || 'Importação XML',
                                }))
                                const importRes = await api.post('/products/import', { products: importPayload })
                                const { imported, skipped } = importRes.data
                                setSuccess(`XML importado! ${imported} produto(s) cadastrado(s), ${skipped} atualizado(s). Redirecionando para Produtos...`)
                                setTimeout(() => { window.location.href = '/products' }, 2000)
                              } catch (importErr) {
                                setSuccess(`XML importado! ${parsedItems.length} item(ns) encontrado(s). Erro ao cadastrar produtos automaticamente - faça manualmente.`)
                                setTimeout(() => setSuccess(''), 5000)
                              }
                            } else {
                              setSuccess(`XML importado! Nenhum item encontrado.`)
                              setTimeout(() => setSuccess(''), 5000)
                            }
                          } catch (err) {
                            setError('Erro ao ler o XML. Verifique se é um arquivo XML de NF-e válido.')
                          }
                        }}
                      />
                      <p className="text-xs text-gray-400 mt-2">Aceita XML de NF-e (procNFe ou NFe). Os dados do emitente serão usados como fornecedor/remetente.</p>
                    </div>
                  )}

                  <p className="text-sm text-blue-600">Os itens da venda vinculada serao utilizados. Certifique-se de que os produtos possuem NCM e CFOP cadastrados.</p>
                  <div className="text-xs text-gray-500">Ambiente: {nfeAmbiente === 1 ? 'Producao' : 'Homologacao'} (MG) | Versao: 4.00</div>
                </div>
              )}

              {/* Certificado em uso */}
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Shield className="w-5 h-5 text-green-600" />
                <div className="text-sm">
                  <span className="text-green-700 font-medium">Certificado: </span>
                  <span className="text-green-600">{activeCert.name} ({activeCert.cnpj})</span>
                </div>
              </div>

              {/* Botao emitir */}
              <div className="flex justify-end gap-3">
                <button onClick={() => setTab('invoices')} className="btn btn-secondary">Cancelar</button>
                <button onClick={emitNote} disabled={emitting || !recipientName || !totalValue} className="btn btn-primary flex items-center gap-2 py-3 px-6">
                  {emitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send className="w-4 h-4" />}
                  {emitting ? 'Emitindo...' : 'Emitir ' + (emitType === 'nfe' ? 'NF-e' : 'NFS-e')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === NOTAS EMITIDAS === */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Buscar</label>
                <input className="input" placeholder="Destinatario, numero, chave..." value={invSearch} onChange={e => { setInvSearch(e.target.value); setInvPage(1) }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mes</label>
                <input type="month" className="input" value={invMonth} onChange={e => { setInvMonth(e.target.value); setInvDate(''); setInvPage(1) }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data especifica</label>
                <input type="date" className="input" value={invDate} onChange={e => { setInvDate(e.target.value); setInvPage(1) }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Por pagina</label>
                <select className="input" value={invPerPage} onChange={e => { setInvPerPage(Number(e.target.value)); setInvPage(1) }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="card overflow-hidden p-0">
          {loading ? <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div> : (() => {
            // Filtrar
            let filtered = invoices.filter(inv => {
              const dateStr = inv.issuedAt || inv.createdAt
              const invDateObj = new Date(dateStr)
              const invYM = invDateObj.getFullYear() + '-' + String(invDateObj.getMonth()+1).padStart(2,'0')
              const invD = invDateObj.toISOString().split('T')[0]

              // Filtro mes
              if (invMonth && invYM !== invMonth) return false
              // Filtro data especifica
              if (invDate && invD !== invDate) return false
              // Filtro busca
              if (invSearch) {
                const s = invSearch.toLowerCase()
                const match = (inv.recipientName || '').toLowerCase().includes(s) ||
                  (inv.recipientCnpj || '').includes(s) ||
                  String(inv.number || '').includes(s) ||
                  (inv.accessKey || '').includes(s) ||
                  (inv.type || '').includes(s) ||
                  (inv.status || '').includes(s)
                if (!match) return false
              }
              return true
            })

            const totalPages = Math.ceil(filtered.length / invPerPage)
            const paginated = filtered.slice((invPage - 1) * invPerPage, invPage * invPerPage)

            return (
              <>
              <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-cell font-semibold text-gray-700">Tipo</th>
                  <th className="table-cell font-semibold text-gray-700">Numero</th>
                  <th className="table-cell font-semibold text-gray-700">Destinatario</th>
                  <th className="table-cell font-semibold text-gray-700">Valor</th>
                  <th className="table-cell font-semibold text-gray-700">Status</th>
                  <th className="table-cell font-semibold text-gray-700">Data</th>
                  <th className="table-cell font-semibold text-gray-700">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.length === 0 ? (
                  <tr><td colSpan={7} className="table-cell text-center text-gray-500 py-8">Nenhuma nota encontrada para os filtros selecionados.</td></tr>
                ) : paginated.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="table-cell"><span className={'px-2 py-0.5 rounded text-xs font-medium ' + (inv.type === 'nfe' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>{inv.type === 'nfe' ? 'NF-e' : 'NFS-e'}</span></td>
                    <td className="table-cell font-mono text-sm">{inv.number || '-'}</td>
                    <td className="table-cell text-sm">{inv.recipientName || '-'}</td>
                    <td className="table-cell font-medium">R$ {Number(inv.totalValue || 0).toFixed(2)}</td>
                    <td className="table-cell">
                      <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (statusColors[inv.status] || '')}>{statusLabels[inv.status]}</span>
                      {inv.rejectionReason && <p className="text-xs text-red-500 mt-1 truncate max-w-xs">{inv.rejectionReason}</p>}
                    </td>
                    <td className="table-cell text-sm text-gray-500">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('pt-BR') : new Date(inv.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => openViewInvoice(inv.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Visualizar nota"><Eye className="w-4 h-4" /></button>
                        {inv.status === 'autorizada' && inv.accessKey && (
                          <button onClick={() => viewPdf(inv.id)} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="Visualizar PDF oficial"><FileText className="w-4 h-4" /></button>
                        )}
                        {inv.status === 'autorizada' && inv.accessKey && (
                          <button onClick={() => downloadPdf(inv.id)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Baixar PDF oficial"><Download className="w-4 h-4" /></button>
                        )}
                        {(inv.status === 'autorizada' || inv.status === 'rejeitada' || inv.status === 'cancelada') && (
                          <button onClick={() => downloadXml(inv.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Baixar XML"><code className="text-xs font-bold">&lt;/&gt;</code></button>
                        )}
                        {inv.status === 'autorizada' && (
                          <button onClick={() => cancelInvoice(inv.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar nota"><XCircle className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
              {/* Paginacao */}
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-gray-500">{filtered.length} nota(s) encontrada(s)</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setInvPage(p => Math.max(1, p - 1))} disabled={invPage <= 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Anterior</button>
                  <span className="text-sm text-gray-700">Pagina {invPage} de {totalPages || 1}</span>
                  <button onClick={() => setInvPage(p => Math.min(totalPages, p + 1))} disabled={invPage >= totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Proxima</button>
                </div>
              </div>
              </>
            )
          })()}
          </div>
        </div>
      )}

      {/* === CERTIFICADOS === */}
      {tab === 'certificates' && (
        <div className="space-y-6">
          {isAdmin && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Upload className="w-5 h-5" /> Upload de Certificado A1</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Arquivo .pfx</label><input type="file" accept=".pfx,.p12" onChange={e => setCertFile(e.target.files?.[0] || null)} className="input text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Senha</label><input type="password" className="input" value={certPassword} onChange={e => setCertPassword(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome</label><input className="input" value={certName} onChange={e => setCertName(e.target.value)} placeholder="Opcional" /></div>
              </div>
              <button onClick={uploadCert} disabled={uploading || !certFile || !certPassword} className="mt-4 btn btn-primary flex items-center gap-2">
                {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Shield className="w-4 h-4" />} Enviar
              </button>
            </div>
          )}
          <div className="space-y-3">
            {certificates.map(cert => (
              <div key={cert.id} className={'card flex items-center gap-4 ' + (!cert.isActive ? 'opacity-50' : '')}>
                <Shield className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="font-semibold">{cert.name}</span>{cert.isActive && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Ativo</span>}</div>
                  <p className="text-sm text-gray-500">{cert.companyName}</p>
                  <p className="text-xs text-gray-400">CNPJ: {cert.cnpj} | Valido ate: {cert.validUntil ? new Date(cert.validUntil).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                {isAdmin && <div className="flex gap-2"><button onClick={() => toggleCert(cert.id)} className="text-sm text-blue-600 hover:underline">{cert.isActive ? 'Desativar' : 'Ativar'}</button><button onClick={() => removeCert(cert.id)} className="text-sm text-red-600 hover:underline">Remover</button></div>}
              </div>
            ))}
            {certificates.length === 0 && <div className="card text-center text-gray-500 py-8">Nenhum certificado</div>}
          </div>
        </div>
      )}

      {/* === CONFIG === */}
      {tab === 'config' && isAdmin && <FiscalConfigForm />}

      {/* === MODAL VISUALIZAR NOTA === */}
      {showView && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {viewLoading ? (
              <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
            ) : viewInvoice ? (
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {viewInvoice.type === 'nfse' ? 'NFS-e' : 'NF-e'} #{viewInvoice.number || 'Rascunho'}
                  </h2>
                  <button onClick={() => { setShowView(false); setViewInvoice(null); setXmlContent(null); setShowXml(false) }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                {/* Status */}
                <div className={'text-center py-3 rounded-lg font-bold text-lg ' + (statusColors[viewInvoice.status] || '')}>
                  {(statusLabels[viewInvoice.status] || viewInvoice.status).toUpperCase()}
                </div>

                {/* Dados da Nota */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div><p className="text-xs text-gray-500">Numero</p><p className="font-semibold">{viewInvoice.number || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Serie</p><p className="font-semibold">{viewInvoice.series || 1}</p></div>
                  <div><p className="text-xs text-gray-500">Tipo</p><p className="font-semibold">{viewInvoice.type === 'nfse' ? 'NFS-e' : 'NF-e'}</p></div>
                  <div><p className="text-xs text-gray-500">Emissao</p><p className="font-semibold">{viewInvoice.issuedAt ? new Date(viewInvoice.issuedAt).toLocaleString('pt-BR') : new Date(viewInvoice.createdAt).toLocaleString('pt-BR')}</p></div>
                </div>

                {/* Chave de Acesso */}
                {viewInvoice.accessKey && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Chave de Acesso</p>
                    <p className="font-mono text-sm break-all">{viewInvoice.accessKey}</p>
                  </div>
                )}

                {/* Protocolo e Verificacao */}
                <div className="grid grid-cols-2 gap-4">
                  {viewInvoice.protocolNumber && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500">Protocolo</p>
                      <p className="font-mono text-sm">{viewInvoice.protocolNumber}</p>
                    </div>
                  )}
                  {viewInvoice.verificationCode && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500">Cod. Verificacao</p>
                      <p className="font-mono text-sm">{viewInvoice.verificationCode}</p>
                    </div>
                  )}
                </div>

                {/* Prestador */}
                {viewConfig && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prestador</h3>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-gray-500">Razao Social:</span> <span className="font-medium">{viewConfig.companyName}</span></div>
                      <div><span className="text-gray-500">CNPJ:</span> <span className="font-medium">{viewConfig.cnpj}</span></div>
                      <div><span className="text-gray-500">IM:</span> <span className="font-medium">{viewConfig.cityRegistration}</span></div>
                    </div>
                  </div>
                )}

                {/* Tomador */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tomador</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Nome:</span> <span className="font-medium">{viewInvoice.recipientName || '-'}</span></div>
                    <div><span className="text-gray-500">CPF/CNPJ:</span> <span className="font-medium">{viewInvoice.recipientCnpj || '-'}</span></div>
                  </div>
                </div>

                {/* Valor */}
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-right">
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">R$ {Number(viewInvoice.totalValue || 0).toFixed(2)}</p>
                </div>

                {/* Rejeicao */}
                {viewInvoice.rejectionReason && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <h3 className="text-sm font-semibold text-red-700 mb-1">Motivo da Rejeicao</h3>
                    <p className="text-sm text-red-600">{viewInvoice.rejectionReason}</p>
                  </div>
                )}

                {/* Cancelamento */}
                {viewInvoice.cancelReason && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Cancelamento</h3>
                    <p className="text-sm text-gray-600">{viewInvoice.cancelReason}</p>
                  </div>
                )}

                {/* XML Toggle */}
                {xmlContent && (xmlContent.xmlAuthorized || xmlContent.xmlSent) && (
                  <div>
                    <button onClick={() => setShowXml(!showXml)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <Eye className="w-4 h-4" /> {showXml ? 'Ocultar XML' : 'Visualizar XML'}
                    </button>
                    {showXml && (
                      <pre className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-all">
                        {xmlContent.xmlAuthorized || xmlContent.xmlSent || ''}
                      </pre>
                    )}
                  </div>
                )}

                {/* Botoes de Acao */}
                <div className="flex gap-3 pt-4 border-t flex-wrap">
                  {viewInvoice.status === 'autorizada' && viewInvoice.accessKey && (
                    <button onClick={() => viewPdf(viewInvoice.id)} className="btn btn-primary flex items-center gap-2">
                      <Eye className="w-4 h-4" /> {viewInvoice.type === 'nfe' ? 'Imprimir DANFE' : 'Visualizar Nota Oficial'}
                    </button>
                  )}
                  {viewInvoice.status === 'autorizada' && viewInvoice.accessKey && viewInvoice.type === 'nfse' && (
                    <button onClick={() => downloadPdf(viewInvoice.id)} className="btn btn-secondary flex items-center gap-2">
                      <Download className="w-4 h-4" /> Baixar PDF
                    </button>
                  )}
                  <button onClick={() => downloadXml(viewInvoice.id)} className="btn btn-secondary flex items-center gap-2">
                    <Download className="w-4 h-4" /> Baixar XML
                  </button>
                  {viewInvoice.status === 'autorizada' && viewInvoice.accessKey && viewInvoice.type === 'nfe' && (
                    <a href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XbSeqxE8pl8=&nfe=${viewInvoice.accessKey}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Consultar SEFAZ
                    </a>
                  )}
                  {viewInvoice.status === 'autorizada' && viewInvoice.accessKey && viewInvoice.type === 'nfse' && (
                    <a href="https://www.nfse.gov.br/ConsultaPublica" target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Consultar Portal NFS-e
                    </a>
                  )}
                  {viewInvoice.status === 'autorizada' && (
                    <button onClick={() => { setShowView(false); cancelInvoice(viewInvoice.id) }} className="btn btn-secondary text-red-600 flex items-center gap-2 ml-auto">
                      <XCircle className="w-4 h-4" /> Cancelar Nota
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">Nota nao encontrada</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FiscalConfigForm() {
  const [cfg, setCfg] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => { api.get('/fiscal/config').then(r => { setCfg(r.data); if (r.data?.logoUrl) setLogoPreview(r.data.logoUrl) }).catch(() => setCfg({})) }, [])

  async function save() {
    setSaving(true); setMsg('')
    try { await api.patch('/fiscal/config', cfg); setMsg('Configuracao salva!') }
    catch { setMsg('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function uploadLogo() {
    if (!logoFile) return
    setUploadingLogo(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('logo', logoFile)
      const res = await api.post('/fiscal/config/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setLogoPreview(res.data.logoUrl || URL.createObjectURL(logoFile))
      setCfg({ ...cfg, logoUrl: res.data.logoUrl })
      setMsg('Logo enviada com sucesso!')
      setLogoFile(null)
    } catch { setMsg('Erro ao enviar logo') }
    finally { setUploadingLogo(false) }
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  async function save() {
    setSaving(true); setMsg('')
    try { await api.patch('/fiscal/config', cfg); setMsg('Configuracao salva!') }
    catch { setMsg('Erro ao salvar') }
    finally { setSaving(false) }
  }

  if (!cfg) return <div className="card text-center py-8">Carregando...</div>

  return (
    <div className="card space-y-6">
      <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> Configuracao Fiscal</h3>
      {msg && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{msg}</div>}

      {/* Logo da Nota Fiscal */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Logo da Empresa (Nota Fiscal)</h4>
        <div className="flex items-center gap-4">
          {logoPreview && (
            <div className="w-24 h-24 border border-gray-200 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoSelect}
              className="input text-sm"
            />
            <p className="text-xs text-gray-400">Formatos aceitos: PNG, JPG, SVG. Tamanho recomendado: 200x200px</p>
            {logoFile && (
              <button onClick={uploadLogo} disabled={uploadingLogo} className="btn btn-primary text-sm flex items-center gap-2">
                {uploadingLogo ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Upload className="w-4 h-4" />}
                Enviar Logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ da Empresa *</label>
          <input className="input" value={cfg.cnpj || ''} onChange={e => setCfg({...cfg, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Razao Social *</label>
          <input className="input" value={cfg.companyName || ''} onChange={e => setCfg({...cfg, companyName: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Inscricao Estadual</label>
          <input className="input" value={cfg.stateRegistration || ''} onChange={e => setCfg({...cfg, stateRegistration: e.target.value})} placeholder="IE" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Inscricao Municipal *</label>
          <input className="input" value={cfg.cityRegistration || ''} onChange={e => setCfg({...cfg, cityRegistration: e.target.value})} placeholder="IM da Prefeitura" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Regime Tributario</label>
          <select className="input" value={cfg.taxRegime || 1} onChange={e => setCfg({...cfg, taxRegime: parseInt(e.target.value)})}>
            <option value={1}>1 - Simples Nacional (ME/EPP)</option>
            <option value={2}>2 - Simples Nacional (excesso sublimite)</option>
            <option value={3}>3 - Regime Normal</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
          <select className="input" value={cfg.environment || 2} onChange={e => setCfg({...cfg, environment: parseInt(e.target.value)})}>
            <option value={2}>2 - Homologacao (Teste)</option>
            <option value={1}>1 - Producao</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UF (codigo IBGE)</label>
          <input className="input" value={cfg.ufCode || '31'} onChange={e => setCfg({...cfg, ufCode: e.target.value})} placeholder="31 = MG" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Municipio (codigo IBGE 7 dig)</label>
          <input className="input" value={cfg.cityCode || '3118601'} onChange={e => setCfg({...cfg, cityCode: e.target.value})} placeholder="3118601 = Contagem" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NF-e Serie</label>
          <input className="input" type="number" value={cfg.nfeSeries || 1} onChange={e => setCfg({...cfg, nfeSeries: parseInt(e.target.value)})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NF-e Proximo Numero</label>
          <input className="input" type="number" value={cfg.nfeNextNumber || 1} onChange={e => setCfg({...cfg, nfeNextNumber: parseInt(e.target.value)})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NFS-e Serie</label>
          <input className="input" type="number" value={cfg.nfseSeries || 1} onChange={e => setCfg({...cfg, nfseSeries: parseInt(e.target.value)})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NFS-e Proximo Numero</label>
          <input className="input" type="number" value={cfg.nfseNextNumber || 1} onChange={e => setCfg({...cfg, nfseNextNumber: parseInt(e.target.value)})} />
        </div>
      </div>

      {/* URLs da API NFS-e */}
      <h4 className="font-medium text-gray-700 mt-4">URLs API NFS-e (Cidade360 / Padrão Nacional)</h4>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL API NFS-e (Produção) *</label>
          <input className="input" value={cfg.nfseApiUrl || ''} onChange={e => setCfg({...cfg, nfseApiUrl: e.target.value})} placeholder="https://nfse-contagem.cidade360.com.br/api" />
          <p className="text-xs text-gray-400 mt-1">URL da API de produção do seu município para emissão de NFS-e</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL API NFS-e (Homologação/Teste)</label>
          <input className="input" value={cfg.nfseTestUrl || ''} onChange={e => setCfg({...cfg, nfseTestUrl: e.target.value})} placeholder="https://nfse-contagem-hom.cidade360.com.br/api" />
          <p className="text-xs text-gray-400 mt-1">URL para testes. Usada quando Ambiente = Homologação</p>
        </div>
      </div>

      {/* Endereco do Emitente */}
      <h4 className="font-medium text-gray-700 mt-4">Endereco do Emitente (NF-e)</h4>      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
          <input className="input" value={cfg.emitAddress || ''} onChange={e => setCfg({...cfg, emitAddress: e.target.value})} placeholder="Rua/Av..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Numero</label>
          <input className="input" value={cfg.emitNumber || ''} onChange={e => setCfg({...cfg, emitNumber: e.target.value})} placeholder="123" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
          <input className="input" value={cfg.emitNeighborhood || ''} onChange={e => setCfg({...cfg, emitNeighborhood: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
          <input className="input" value={cfg.emitCep || ''} onChange={e => setCfg({...cfg, emitCep: e.target.value})} placeholder="32000000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
          <input className="input" value={cfg.emitPhone || ''} onChange={e => setCfg({...cfg, emitPhone: e.target.value})} placeholder="31999999999" />
        </div>
      </div>

      {/* NFC-e */}
      <h4 className="font-medium text-gray-700 mt-4">NFC-e (Modelo 65)</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NFC-e Serie</label>
          <input className="input" type="number" value={cfg.nfceSeries || 1} onChange={e => setCfg({...cfg, nfceSeries: parseInt(e.target.value)})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NFC-e Proximo Numero</label>
          <input className="input" type="number" value={cfg.nfceNextNumber || 1} onChange={e => setCfg({...cfg, nfceNextNumber: parseInt(e.target.value)})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CSC ID (Token NFC-e)</label>
          <input className="input" value={cfg.nfceCscId || ''} onChange={e => setCfg({...cfg, nfceCscId: e.target.value})} placeholder="000001" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CSC Token</label>
          <input className="input" value={cfg.nfceCscToken || ''} onChange={e => setCfg({...cfg, nfceCscToken: e.target.value})} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
          Salvar Configuracao
        </button>
      </div>
    </div>
  )
}
