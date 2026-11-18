import { useState } from 'react'
import { api } from '../services/api'

export const xmlEntryPaymentLabels: Record<string,string> = { boleto:'Boleto', pix:'Pix', dinheiro:'Dinheiro', cheque:'Cheque', cartao_credito:'Cartão de crédito', cartao_debito:'Cartão de débito', transferencia:'Transferência bancária', outros:'Outros' }
type Row = { number:number; dueDate:string; value:string }
function monthlyDate(first: string, offset: number) {
  if (!first) return ''
  const [year,month,day] = first.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year,month+offset,0,12)).getUTCDate()
  return new Date(Date.UTC(year,month-1+offset,Math.min(day,lastDay),12)).toISOString().slice(0,10)
}

export function XmlEntryImport({ destination, onImported }: { destination:'product'|'expense'; onImported:(result:any,preview:any)=>void }) {
  const [xml,setXml] = useState('')
  const [preview,setPreview] = useState<any>(null)
  const [method,setMethod] = useState('boleto')
  const [rows,setRows] = useState<Row[]>([])
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const sum = rows.reduce((s,row)=>s+Math.round(Number(row.value)*100),0)
  const total = Math.round(Number(preview?.totalValue || 0)*100)
  const valid = preview && rows.length>0 && rows.every(row=>row.dueDate && Number(row.value)>0) && sum===total
  const money = (value:number) => value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

  async function read(file?:File) {
    if (!file) return
    setError(''); setPreview(null); setXml(''); setBusy(true)
    try {
      if (file.size>2_000_000) throw new Error('O XML deve ter até 2 MB.')
      const content = await file.text()
      const {data} = await api.post('/fiscal/xml-entry/preview',{xml:content})
      setXml(content); setPreview(data); setMethod(data.paymentMethod)
      setRows(data.installments.map((row:any,index:number)=>({number:index+1,dueDate:row.dueDate || '',value:Number(row.value).toFixed(2)})))
    } catch(e:any) { setError(e.response?.data?.message || e.message || 'Não foi possível ler o XML.') }
    finally { setBusy(false) }
  }
  function resize(count:number) {
    if (!Number.isInteger(count) || count<1 || count>120) return
    const cents = Math.floor(total/count), first = rows[0]?.dueDate || ''
    setRows(Array.from({length:count},(_,index)=>({number:index+1,dueDate:monthlyDate(first,index),value:((index===count-1 ? total-cents*(count-1) : cents)/100).toFixed(2)})))
  }
  async function confirm() {
    if (!valid || busy) return
    setBusy(true); setError('')
    try {
      const {data} = await api.post('/fiscal/xml-entry/import',{xml,destination,paymentMethod:method,installments:rows},{timeout:120000})
      onImported(data,preview); setPreview(null); setXml(''); setRows([])
    } catch(e:any) { setError(e.response?.data?.message || 'Não foi possível concluir a importação. Confira os dados e tente novamente.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-4">
    <label className="block text-sm font-medium text-gray-700">Arquivo XML da NF-e do fornecedor
      <input type="file" accept=".xml" disabled={busy} className="input mt-1" onChange={e=>{const file=e.target.files?.[0];e.target.value='';read(file)}} />
    </label>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {busy && <p role="status" className="text-sm text-blue-700">{preview ? 'Importando itens e gerando contas a pagar...' : 'Lendo XML...'}</p>}
    {preview && <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4">
      <div><h3 className="font-semibold text-gray-900">Conferência da NF-e {preview.invoiceNumber}</h3><p className="text-sm text-gray-600">{preview.supplierName} · {preview.items.length} item(ns) · <strong>{money(preview.totalValue)}</strong></p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-700">Forma de pagamento<select aria-label="Forma de pagamento" disabled={busy} className="input mt-1" value={method} onChange={e=>setMethod(e.target.value)}>{Object.entries(xmlEntryPaymentLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm text-gray-700">Número de parcelas<input aria-label="Número de parcelas" disabled={busy} className="input mt-1" type="number" min="1" max="120" value={rows.length} onChange={e=>resize(Number(e.target.value))} /></label>
        <label className="text-sm text-gray-700">Primeiro vencimento<input aria-label="Primeiro vencimento" disabled={busy} className="input mt-1" type="date" value={rows[0]?.dueDate || ''} onChange={e=>setRows(rows.map((row,index)=>({...row,dueDate:monthlyDate(e.target.value,index)})))} /></label>
      </div>
      <p className="text-xs text-gray-500">Parcelas e vencimentos encontrados no XML são preenchidos automaticamente. Confira os dados ou ajuste cada parcela abaixo.</p>
      <div className="space-y-2">{rows.map((row,index)=><div key={row.number} className="grid grid-cols-2 sm:grid-cols-[55px_1fr_1fr] items-end gap-2 rounded-lg bg-gray-50 p-2"><span className="col-span-2 pb-2 text-sm font-medium text-gray-700 sm:col-span-1">{row.number}/{rows.length}</span><label className="text-xs text-gray-600">Vencimento<input aria-label={`Vencimento da parcela ${row.number}`} disabled={busy} className="input mt-1" type="date" value={row.dueDate} onChange={e=>setRows(rows.map((current,i)=>i===index?{...current,dueDate:e.target.value}:current))} /></label><label className="text-xs text-gray-600">Valor (R$)<input aria-label={`Valor da parcela ${row.number}`} disabled={busy} className="input mt-1" type="number" min="0.01" step="0.01" value={row.value} onChange={e=>setRows(rows.map((current,i)=>i===index?{...current,value:e.target.value}:current))} /></label></div>)}</div>
      <p className={`text-sm font-medium ${sum===total?'text-green-700':'text-red-700'}`}>Total das parcelas: {money(sum/100)} / Total da nota: {money(total/100)}</p>
      <p className="text-sm text-gray-600">Ao confirmar, serão criados {rows.length} débito(s) pendente(s) em Contas a Pagar e Receber, com lançamento de despesa prevista. A saída de caixa será registrada quando o pagamento for baixado.</p>
      <details><summary className="cursor-pointer text-sm text-blue-700">Conferir itens da nota</summary><ul className="mt-2 space-y-1 text-sm text-gray-600">{preview.items.map((item:any,index:number)=><li key={index}>{item.name} · {item.quantity} {item.unit} · unitário {money(item.unitPrice)}</li>)}</ul></details>
      <div className="flex flex-wrap justify-end gap-2"><button disabled={busy} className="btn btn-secondary" onClick={()=>{setPreview(null);setXml('');setError('')}}>Cancelar</button><button disabled={!valid || busy} className="btn btn-primary disabled:opacity-50" onClick={confirm}>{busy?'Importando...':'Confirmar importação e gerar contas a pagar'}</button></div>
    </div>}
  </div>
}
