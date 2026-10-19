// Número do documento fiscal para EXIBIR.
//
// invoices.number guarda o número que o sistema reserva e envia na DPS (Declaração de Prestação de
// Serviços, <nDPS>). O número da NFS-e em si (<nNFSe>) é atribuído pela prefeitura/Emissor Nacional na
// autorização e só existe dentro do XML autorizado. O usuário quer ver o da NFS-e; a DPS só serve de
// reserva quando o XML ainda não tem o número (ou a nota é NF-e, onde "number" já é o número da nota).

const NFSE_NUMBER_TAGS = ['nNFSe', 'NumeroNfse', 'NumeroNFSe'];

/** Expressão SQL (texto) com o número a exibir de uma linha de `invoices`. `alias` é o apelido da tabela. */
export function invoiceDocumentNumberSql(alias: string): string {
  const extract = NFSE_NUMBER_TAGS.map(
    (tag) => `NULLIF(substring(${alias}.xml_authorized from '<${tag}>\\s*([0-9]+)\\s*</${tag}>'), '')`,
  ).join(', ');
  return `CASE WHEN ${alias}.type = 'nfse' THEN COALESCE(${extract}, ${alias}.number::text) ELSE ${alias}.number::text END`;
}

/** Mesma regra em JavaScript, para quem já carregou a entidade `Invoice`. */
export function invoiceDocumentNumber(invoice: { type?: string | null; number?: number | string | null; xmlAuthorized?: string | null }): string {
  const fallback = invoice.number !== null && invoice.number !== undefined ? String(invoice.number) : '';
  if (invoice.type !== 'nfse' || !invoice.xmlAuthorized) return fallback;
  for (const tag of NFSE_NUMBER_TAGS) {
    const match = invoice.xmlAuthorized.match(new RegExp(`<${tag}>\\s*([0-9]+)\\s*</${tag}>`));
    if (match?.[1]) return match[1];
  }
  return fallback;
}
