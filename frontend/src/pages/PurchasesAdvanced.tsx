import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { ClipboardList, FilePlus2, PackageCheck, RefreshCw, Truck } from 'lucide-react'

export function PurchasesAdvanced() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [requestForm, setRequestForm] = useState({ description: '', supplierName: '', supplierCnpj: '', totalValue: '', paymentMethod: 'boleto', dueDate: '' })
  const [quoteForm, setQuoteForm] = useState({ supplierName: '', supplierCnpj: '', totalValue: '', deliveryDays: '', paymentTerms: '' })
  const [receiptItems, setReceiptItems] = useState('')
  const [attachmentForm, setAttachmentForm] = useState({ filename: '', type: 'xml', mimeType: '', storagePath: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setError('')
    try {
      setPurchases((await api.get('/purchases')).data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar compras')
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault()
    await act(() => api.post('/purchases/requests', { ...requestForm, totalValue: Number(requestForm.totalValue || 0) }), 'Solicitação criada')
    setRequestForm({ description: '', supplierName: '', supplierCnpj: '', totalValue: '', paymentMethod: 'boleto', dueDate: '' })
  }

  async function addQuote(e: React.FormEvent) {
    e.preventDefault()
    await act(() => api.post(`/purchases/${selectedId}/quotes`, { ...quoteForm, totalValue: Number(quoteForm.totalValue || 0), deliveryDays: Number(quoteForm.deliveryDays || 0) }), 'Cotação adicionada')
    setQuoteForm({ supplierName: '', supplierCnpj: '', totalValue: '', deliveryDays: '', paymentTerms: '' })
  }

  async function chooseQuote(quoteId: string) {
    await act(() => api.patch(`/purchases/${selectedId}/quotes/${quoteId}/choose`), 'Cotação escolhida')
  }

  async function createOrder() {
    await act(() => api.post(`/purchases/${selectedId}/order`), 'Ordem de compra criada')
  }

  async function receivePartial(e: React.FormEvent) {
    e.preventDefault()
    const items = receiptItems.split(/\r?\n/).map((line) => {
      const [itemId, quantity] = line.split(',').map((v) => v.trim())
      return { itemId, quantity: Number(quantity) }
    }).filter((item) => item.itemId && item.quantity > 0)
    await act(() => api.patch(`/purchases/${selectedId}/receive-partial`, { items }), 'Recebimento registrado')
    setReceiptItems('')
  }

  async function addAttachment(e: React.FormEvent) {
    e.preventDefault()
    await act(() => api.post(`/purchases/${selectedId}/attachments`, attachmentForm), 'Anexo registrado')
    setAttachmentForm({ filename: '', type: 'xml', mimeType: '', storagePath: '' })
  }

  async function act(request: () => Promise<any>, message: string) {
    setError('')
    setSuccess('')
    try {
      await request()
      setSuccess(message)
      await load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha na operação')
    }
  }

  const selected = purchases.find((purchase) => purchase.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras Avançado</h1>
          <p className="text-sm text-gray-500">Solicitação, cotação, ordem, recebimento parcial e anexos.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <div className="space-y-6">
          <form onSubmit={createRequest} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ClipboardList className="h-4 w-4" /> Solicitação</div>
            <Input label="Descrição" value={requestForm.description} onChange={(v) => setRequestForm({ ...requestForm, description: v })} required />
            <Input label="Fornecedor" value={requestForm.supplierName} onChange={(v) => setRequestForm({ ...requestForm, supplierName: v })} />
            <Input label="CNPJ" value={requestForm.supplierCnpj} onChange={(v) => setRequestForm({ ...requestForm, supplierCnpj: v })} />
            <Input label="Valor previsto" type="number" value={requestForm.totalValue} onChange={(v) => setRequestForm({ ...requestForm, totalValue: v })} />
            <Input label="Vencimento" type="date" value={requestForm.dueDate} onChange={(v) => setRequestForm({ ...requestForm, dueDate: v })} />
            <button className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">Criar</button>
          </form>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Compra selecionada</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Selecione</option>
                {purchases.map((p) => <option key={p.id} value={p.id}>{p.description} - {p.status}</option>)}
              </select>
            </label>
          </div>

          <form onSubmit={addQuote} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Truck className="h-4 w-4" /> Cotação</div>
            <Input label="Fornecedor" value={quoteForm.supplierName} onChange={(v) => setQuoteForm({ ...quoteForm, supplierName: v })} required />
            <Input label="CNPJ" value={quoteForm.supplierCnpj} onChange={(v) => setQuoteForm({ ...quoteForm, supplierCnpj: v })} />
            <Input label="Valor" type="number" value={quoteForm.totalValue} onChange={(v) => setQuoteForm({ ...quoteForm, totalValue: v })} />
            <Input label="Prazo dias" type="number" value={quoteForm.deliveryDays} onChange={(v) => setQuoteForm({ ...quoteForm, deliveryDays: v })} />
            <Input label="Condição" value={quoteForm.paymentTerms} onChange={(v) => setQuoteForm({ ...quoteForm, paymentTerms: v })} />
            <button disabled={!selectedId} className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Adicionar</button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Detalhes</div>
              <button disabled={!selectedId} onClick={createOrder} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50">Gerar ordem</button>
            </div>
            {!selected ? <p className="text-sm text-gray-500">Selecione uma compra.</p> : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Metric label="Status" value={selected.status} />
                  <Metric label="Tipo" value={selected.type} />
                  <Metric label="Valor" value={Number(selected.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <Metric label="Fornecedor" value={selected.supplierName || '-'} />
                </div>
                <Table rows={selected.quotes || []} cols={['supplierName', 'totalValue', 'deliveryDays', 'status']} labels={['Fornecedor', 'Valor', 'Dias', 'Status']} actions={(q) => <button onClick={() => chooseQuote(q.id)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">Escolher</button>} />
                <Table rows={selected.itemsList || []} cols={['id', 'description', 'quantity', 'receivedQuantity']} labels={['ID', 'Item', 'Qtd.', 'Recebido']} />
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={receivePartial} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><PackageCheck className="h-4 w-4" /> Recebimento parcial</div>
              <textarea required value={receiptItems} onChange={(e) => setReceiptItems(e.target.value)} placeholder="itemId, quantidade" className="min-h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <button disabled={!selectedId} className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Receber</button>
            </form>

            <form onSubmit={addAttachment} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><FilePlus2 className="h-4 w-4" /> Anexo XML/PDF</div>
              <Input label="Arquivo" value={attachmentForm.filename} onChange={(v) => setAttachmentForm({ ...attachmentForm, filename: v })} required />
              <Input label="Tipo" value={attachmentForm.type} onChange={(v) => setAttachmentForm({ ...attachmentForm, type: v })} />
              <Input label="Caminho" value={attachmentForm.storagePath} onChange={(v) => setAttachmentForm({ ...attachmentForm, storagePath: v })} required />
              <button disabled={!selectedId} className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Registrar anexo</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">{label}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div className="rounded-md bg-gray-50 p-3"><div className="text-xs text-gray-500">{label}</div><div className="truncate text-sm font-semibold text-gray-900">{value}</div></div>
}

function Table({ rows, cols, labels, actions }: { rows: any[]; cols: string[]; labels: string[]; actions?: (row: any) => React.ReactNode }) {
  return <div className="overflow-auto rounded-md border border-gray-200"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50"><tr>{labels.map((l) => <th key={l} className="px-3 py-2 text-left font-semibold text-gray-600">{l}</th>)}{actions && <th className="px-3 py-2 text-left font-semibold text-gray-600">Ações</th>}</tr></thead><tbody className="divide-y divide-gray-100">{rows.length === 0 && <tr><td colSpan={cols.length + (actions ? 1 : 0)} className="px-3 py-6 text-center text-gray-500">Nenhum registro</td></tr>}{rows.map((row) => <tr key={row.id}>{cols.map((col) => <td key={col} className="max-w-xs truncate px-3 py-2 text-gray-700">{String(row[col] ?? '-')}</td>)}{actions && <td className="px-3 py-2">{actions(row)}</td>}</tr>)}</tbody></table></div>
}
