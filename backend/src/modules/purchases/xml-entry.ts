import { BadRequestException } from '@nestjs/common';
import { DOMParser } from '@xmldom/xmldom';

export const XML_PAYMENT_METHODS = ['boleto', 'pix', 'dinheiro', 'cheque', 'cartao_credito', 'cartao_debito', 'transferencia', 'outros'];
export const XML_PAYMENT_CODES: Record<string, string> = { '01': 'dinheiro', '02': 'cheque', '03': 'cartao_credito', '04': 'cartao_debito', '15': 'boleto', '17': 'pix', '18': 'transferencia' };
export function xmlEntryDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T12:00:00Z')) || new Date(value + 'T12:00:00Z').toISOString().slice(0,10) !== value) {
    throw new BadRequestException('Informe uma data válida para cada vencimento.');
  }
  return value;
}
export function xmlEntryCents(value: unknown): number {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(number) || number <= 0 || number > 99999999.99 || Math.abs(number * 100 - Math.round(number * 100)) > 0.00001) {
    throw new BadRequestException('Os valores da nota e das parcelas devem ser positivos, com até duas casas decimais.');
  }
  return Math.round(number * 100);
}
export function validateXmlEntryPayments(total: number, method: string, rows: any[]) {
  if (!XML_PAYMENT_METHODS.includes(method)) throw new BadRequestException('Selecione uma forma de pagamento válida.');
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 120) throw new BadRequestException('Informe de 1 a 120 parcelas.');
  const installments = rows.map((row, index) => ({ number: index + 1, dueDate: xmlEntryDate(row?.dueDate), value: xmlEntryCents(row?.value) / 100 }));
  if (installments.reduce((sum, row) => sum + Math.round(row.value * 100), 0) !== xmlEntryCents(total)) {
    throw new BadRequestException('A soma das parcelas deve ser exatamente igual ao total da NF-e. Confira os valores antes de importar.');
  }
  return installments;
}

export function parseXmlEntry(xml: unknown) {
  if (typeof xml !== 'string') throw new BadRequestException('O conteúdo do XML não foi recebido corretamente. Selecione o arquivo XML da NF-e novamente.');
  if (!xml.trim()) throw new BadRequestException('O arquivo XML está vazio. Baixe novamente o XML da NF-e do fornecedor.');
  if (Buffer.byteLength(xml) > 2_000_000) throw new BadRequestException('O conteúdo do XML excede o limite de 2 MB. Envie somente o XML de uma NF-e.');
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!doctype\s+html\b|<html\b)/i.test(xml)) throw new BadRequestException('O arquivo contém uma página HTML. Baixe o XML original da NF-e; salvar a página do navegador como .xml não gera o XML da nota.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new BadRequestException('O arquivo contém uma declaração DTD ou ENTITY, não permitida nesta importação. Solicite ao fornecedor o XML original da NF-e.');
  let malformed = false;
  let doc: any;
  try {
    doc = new DOMParser({ errorHandler: { warning: () => { malformed = true; }, error: () => { malformed = true; }, fatalError: () => { malformed = true; } } }).parseFromString(xml, 'text/xml');
  } catch { throw new BadRequestException('Não foi possível ler o XML. Confira a estrutura da NF-e.'); }
  const all = (root: any, name: string): any[] => Array.from(root?.getElementsByTagName('*') || []).filter((el: any) => (el.localName || el.tagName.split(':').pop()) === name);
  const one = (root: any, name: string) => all(root, name)[0];
  const text = (root: any, name: string) => String(one(root, name)?.textContent || '').trim();
  const infos = all(doc, 'infNFe');
  if (malformed || infos.length !== 1) throw new BadRequestException('XML inválido: selecione somente uma NF-e de fornecedor.');
  const info = infos[0], ide = one(info, 'ide'), emit = one(info, 'emit'), dest = one(info, 'dest');
  const accessKey = String(info.getAttribute('Id') || '').replace(/^NFe/, '');
  if (!/^\d{44}$/.test(accessKey) || text(ide, 'mod') !== '55') throw new BadRequestException('Informe uma NF-e modelo 55 com chave de acesso válida.');
  const protocol = one(doc, 'infProt');
  if (protocol && !['100','150'].includes(text(protocol, 'cStat'))) throw new BadRequestException('O protocolo do XML não confirma uma NF-e autorizada.');
  if (protocol && text(protocol,'chNFe') && text(protocol,'chNFe') !== accessKey) throw new BadRequestException('O protocolo e a chave de acesso da NF-e não conferem.');
  const supplierDocument = (text(emit, 'CNPJ') || text(emit, 'CPF')).replace(/\D/g, '');
  const supplierName = text(emit, 'xNome');
  if (![11,14].includes(supplierDocument.length) || !supplierName || supplierName.length > 255) throw new BadRequestException('Fornecedor não identificado no XML.');
  const totalValue = xmlEntryCents(text(one(info, 'ICMSTot'), 'vNF')) / 100;
  const emissionDate = xmlEntryDate((text(ide, 'dhEmi') || text(ide, 'dEmi')).slice(0,10));
  const items = all(info, 'det').map((det, index) => {
    const prod = one(det, 'prod');
    const quantity = Number(text(prod, 'qCom')), unitPrice = Number(text(prod, 'vUnCom'));
    const name = text(prod, 'xProd'), code = text(prod, 'cProd');
    if (!name || name.length > 255 || !code || code.length > 100 || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new BadRequestException(`Confira os dados do item ${index+1} no XML.`);
    return { name, code, quantity, unitPrice, purchasePrice: unitPrice, ncm: text(prod,'NCM'), cfop: text(prod,'CFOP'), cest: text(prod,'CEST'), unit: text(prod,'uCom') || 'UN', supplier: supplierName };
  });
  if (!items.length || items.length > 1000) throw new BadRequestException('A NF-e deve conter de 1 a 1000 itens.');
  const installments = all(one(info, 'cobr'), 'dup').map((dup, index) => ({ number: index+1, dueDate: text(dup,'dVenc'), value: xmlEntryCents(text(dup,'vDup')) / 100 }));
  const paymentCodes = [...new Set(all(one(info,'pag'), 'detPag').map(p => text(p,'tPag')))];
  const paymentMethod = paymentCodes.length === 1 ? XML_PAYMENT_CODES[paymentCodes[0]] || 'outros' : installments.length ? 'boleto' : 'outros';
  const address = one(emit,'enderEmit');
  return { accessKey, invoiceNumber: text(ide,'nNF'), emissionDate, supplierName, supplierDocument,
    recipientDocument: (text(dest,'CNPJ') || text(dest,'CPF')).replace(/\D/g,''), totalValue, items, paymentMethod,
    installments: installments.length ? installments : [{number:1,dueDate:'',value:totalValue}],
    supplierAddress: [text(address,'xLgr'),text(address,'nro')].filter(Boolean).join(', '),
    supplierStreet: text(address,'xLgr'), supplierNumber: text(address,'nro'),
    supplierNeighborhood: text(address,'xBairro'), supplierIE: text(emit,'IE'),
    supplierEmail: text(emit,'email'), supplierPhone: text(address,'fone'), supplierCityCode: text(address,'cMun'),
    supplierCity: text(address,'xMun'), supplierUf:text(address,'UF'), supplierCep:text(address,'CEP') };
}
