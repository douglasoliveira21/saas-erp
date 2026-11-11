// Vencimentos são datas de calendário, mesmo quando a API serializa como meia-noite UTC.
export function formatPaymentDueDate(value: string) {
  if (!value) return '-'
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return date ? `${date[3]}/${date[2]}/${date[1]}` : new Date(value).toLocaleDateString('pt-BR')
}

export function showPaymentInLedger(payment: { superseded?: boolean }, statusFilter: string) {
  return !payment.superseded || statusFilter === 'cancelado'
}
