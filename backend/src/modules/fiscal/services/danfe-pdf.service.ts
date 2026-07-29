import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument = require('pdfkit');
import bwipjs = require('bwip-js');
import { Invoice } from '../entities/invoice.entity';
import { FiscalConfig } from '../entities/fiscal-config.entity';
import { Sale } from '../../sales/entities/sale.entity';

interface DanfeItem { code: string; description: string; ncm: string; cst: string; cfop: string; unit: string; quantity: number; unitPrice: number; discount: number; total: number; bcIcms: number; icms: number; ipi: number; icmsRate: number; ipiRate: number }

@Injectable()
export class DanfePdfService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(FiscalConfig) private readonly configRepo: Repository<FiscalConfig>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
  ) {}

  async generate(invoiceId: string): Promise<Buffer> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId }, relations: ['sale', 'sale.customer', 'sale.items', 'sale.items.product', 'sale.items.service'] });
    if (!invoice || invoice.type !== 'nfe') throw new NotFoundException('NF-e não encontrada para gerar DANFE');
    return this.render(invoice, await this.configRepo.findOne({ where: {} }), await this.installments(invoice.saleId), false);
  }

  async generatePreview(saleId: string, data: any = {}): Promise<Buffer> {
    const sale = await this.saleRepo.findOne({ where: { id: saleId }, relations: ['customer', 'items', 'items.product', 'items.service'] });
    if (!sale) throw new NotFoundException('Venda não encontrada para pré-visualizar DANFE');
    const config = await this.configRepo.findOne({ where: {} });
    return this.render({ type: 'nfe', number: null, series: config?.nfeSeries || 1, issuedAt: new Date(), recipientName: data.recipientName || sale.customer?.name, recipientCnpj: data.recipientCnpj || sale.customer?.cpfCnpj, totalValue: Number(data.totalValue || sale.totalAmount), observations: sale.observations, sale, previewData: data }, config, await this.installments(saleId), true);
  }

  private async installments(saleId?: string): Promise<any[]> {
    if (!saleId) return [];
    return this.invoiceRepo.manager.query(`SELECT number, value, due_date AS "dueDate" FROM installments WHERE sale_id=$1 AND status!='cancelado' ORDER BY number`, [saleId]);
  }
  private xv(xml: string, tag: string): string { const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i')); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; }
  private xn(xml: string, tag: string): number { return Number(this.xv(xml, tag) || 0); }
  private xmlItems(xml: string): DanfeItem[] {
    return Array.from(xml.matchAll(/<(?:\w+:)?det\b[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/gi)).map(m => { const b = m[1]; return { code: this.xv(b, 'cProd'), description: this.xv(b, 'xProd'), ncm: this.xv(b, 'NCM'), cst: this.xv(b, 'CSOSN') || this.xv(b, 'CST'), cfop: this.xv(b, 'CFOP'), unit: this.xv(b, 'uCom'), quantity: this.xn(b, 'qCom'), unitPrice: this.xn(b, 'vUnCom'), discount: this.xn(b, 'vDesc'), total: this.xn(b, 'vProd'), bcIcms: this.xn(b, 'vBC'), icms: this.xn(b, 'vICMS'), ipi: this.xn(b, 'vIPI'), icmsRate: this.xn(b, 'pICMS'), ipiRate: this.xn(b, 'pIPI') }; });
  }
  private saleItems(invoice: any): DanfeItem[] {
    const submitted = invoice.previewData?.items || [];
    return (invoice.sale?.items || []).map((i: any, n: number) => { const f = submitted[n] || i.product || i.service || {}; return { code: f.code || i.productId || i.serviceId || String(n + 1), description: i.name || '-', ncm: f.ncm || '', cst: f.csosn || f.cst || '0102', cfop: f.cfop || '5102', unit: f.unit || 'UN', quantity: Number(i.quantity || 0), unitPrice: Number(i.unitPrice || 0), discount: 0, total: Number(i.totalPrice || 0), bcIcms: 0, icms: 0, ipi: 0, icmsRate: 0, ipiRate: 0 }; });
  }

  async render(invoice: any, config: any, installments: any[] = [], preview = false): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 18, bufferPages: true, compress: true });
    const chunks: Buffer[] = []; doc.on('data', c => chunks.push(Buffer.from(c)));
    const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
    const L = 18, W = 559; let y = 18; const xml = String(invoice.xmlAuthorized || invoice.xmlSent || ''); const customer: any = invoice.sale?.customer || {};
    const money = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const quantity = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const digits = (v: any) => String(v || '').replace(/\D/g, '');
    const document = (v: any) => { const d = digits(v); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : v || '-'; };
    const date = (v: any, time = false) => { if (!v) return '-'; const raw = String(v); const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T12:00:00') : new Date(v); return Number.isNaN(d.getTime()) ? raw.substring(0, 10).split('-').reverse().join('/') : time ? d.toLocaleString('pt-BR') : d.toLocaleDateString('pt-BR'); };
    const text = (v: any, x: number, top: number, width: number, size = 6.5, bold = false, align: any = 'left', height?: number) => doc.fillColor('#000').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).text(String(v ?? ''), x, top, { width, align, height, ellipsis: !!height, lineGap: 0 });
    const box = (x: number, top: number, width: number, height: number, label = '', value: any = '', o: any = {}) => { doc.lineWidth(.45).rect(x, top, width, height).stroke('#000'); if (label) text(label.toUpperCase(), x + 2, top + 1.5, width - 4, 4.6); if (value !== '') text(value, x + 2, top + (label ? 9 : 3), width - 4, o.size || 6.6, o.bold, o.align || 'left', height - (label ? 10 : 5)); };
    const section = (label: string) => { text(label, L + 2, y + 1, W - 4, 5.4, true); y += 11; };
    const key = digits(invoice.accessKey || this.xv(xml, 'chNFe')); const keyText = key.replace(/(.{4})/g, '$1 ').trim(); const issued = invoice.issuedAt || this.xv(xml, 'dhEmi') || invoice.createdAt; const number = invoice.number || this.xv(xml, 'nNF'); const series = invoice.series || this.xv(xml, 'serie') || 1; const items = this.xmlItems(xml); const rows = items.length ? items : this.saleItems(invoice); const productTotal = this.xn(xml, 'vProd') || rows.reduce((s, i) => s + i.total, 0); const noteTotal = this.xn(xml, 'vNF') || Number(invoice.totalValue || productTotal);

    text(`RECEBEMOS DE ${String(config?.companyName || 'EMITENTE').toUpperCase()} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO.`, L + 3, y + 3, 430, 5.2);
    text(`EMISSÃO: ${date(issued)}, DESTINATÁRIO: ${String(invoice.recipientName || customer.name || '-').toUpperCase()}, VALOR TOTAL: ${money(noteTotal)}`, L + 3, y + 13, 430, 5.2);
    box(L + 438, y, 121, 32); text('NF-e', L + 440, y + 2, 117, 8, true, 'center'); text(`Nº ${preview ? 'NÃO RESERVADO' : String(number || 0).padStart(9, '0')}`, L + 440, y + 13, 117, 6.5, true, 'center'); text(`SÉRIE: ${String(series).padStart(3, '0')}`, L + 440, y + 22, 117, 6.5, true, 'center'); y += 32;
    box(L, y, 165, 24, 'Data do recebimento'); box(L + 165, y, 273, 24, 'Identificação e assinatura do recebedor'); box(L + 438, y, 121, 24); y += 29; doc.dash(3, { space: 2 }).moveTo(L, y).lineTo(L + W, y).stroke('#000').undash(); y += 5;

    const ih = 96, iw = 238, dw = 105, fw = W - iw - dw; box(L, y, iw, ih);
    text(config?.companyName || 'VGON SOLUÇÕES EM INFORMÁTICA LTDA', L + 5, y + 10, iw - 10, 8.4, true, 'center'); text(`${config?.emitAddress || ''}, ${config?.emitNumber || ''}`, L + 8, y + 32, iw - 16, 6.3, false, 'center'); text(config?.emitNeighborhood || '', L + 8, y + 43, iw - 16, 6.3, false, 'center'); text(`CEP ${config?.emitCep || ''}  TELEFONE: ${config?.emitPhone || ''}`, L + 8, y + 54, iw - 16, 6.3, false, 'center'); text(`CNPJ: ${document(config?.cnpj)}  IE: ${config?.stateRegistration || ''}`, L + 8, y + 66, iw - 16, 6.3, false, 'center');
    box(L + iw, y, dw, ih); text('DANFE', L + iw + 2, y + 5, dw - 4, 13, true, 'center'); text('DOCUMENTO AUXILIAR\nDA NOTA FISCAL\nELETRÔNICA', L + iw + 3, y + 22, dw - 6, 5.4, false, 'center'); text('0 - ENTRADA', L + iw + 8, y + 51, 70, 6.2); text('1 - SAÍDA', L + iw + 8, y + 62, 70, 6.2); box(L + iw + 78, y + 50, 16, 20, '', key[22] === '0' ? '0' : '1', { size: 10, bold: true, align: 'center' }); text(`Nº ${preview ? 'NÃO RESERVADO' : String(number || 0).padStart(9, '0')}`, L + iw + 2, y + 74, dw - 4, 7.2, true, 'center'); text(`SÉRIE ${String(series).padStart(3, '0')}  PÁGINA 1 de 1`, L + iw + 2, y + 86, dw - 4, 5.2, true, 'center');
    box(L + iw + dw, y, fw, ih); text('CONTROLE DO FISCO', L + iw + dw + 2, y + 2, fw - 4, 5.2, true, 'center');
    if (key.length === 44) { try { const barcode = await new Promise<Buffer>((resolve, reject) => bwipjs.toBuffer({ bcid: 'code128', text: key, scale: 1.35, height: 9, includetext: false }, (e, png) => e ? reject(e) : resolve(png))); doc.image(barcode, L + iw + dw + 8, y + 14, { fit: [fw - 16, 30] }); } catch {} }
    text('CHAVE DE ACESSO', L + iw + dw + 3, y + 47, fw - 6, 4.7, true, 'center'); text(keyText || (preview ? 'CHAVE GERADA APÓS A AUTORIZAÇÃO' : '-'), L + iw + dw + 3, y + 56, fw - 6, 6.1, true, 'center'); text('Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora', L + iw + dw + 5, y + 71, fw - 10, 5.1, false, 'center'); y += ih;

    box(L, y, 340, 26, 'Natureza da operação', this.xv(xml, 'natOp') || 'Venda de mercadoria adquirida ou recebida de terceiros'); box(L + 340, y, 219, 26, 'Protocolo de autorização de uso', preview ? 'SEM VALOR FISCAL' : `${invoice.protocolNumber || this.xv(xml, 'nProt') || '-'} ${date(this.xv(xml, 'dhRecbto'), true)}`, { size: 6.2 }); y += 26;
    box(L, y, 185, 24, 'Inscrição estadual', config?.stateRegistration || this.xv(xml, 'IE')); box(L + 185, y, 190, 24, 'Insc. estadual do subst. tributário', this.xv(xml, 'IEST')); box(L + 375, y, 184, 24, 'CNPJ', document(config?.cnpj || invoice.issuerCnpj)); y += 28;

    section('DESTINATÁRIO/REMETENTE'); box(L, y, 343, 25, 'Nome/Razão social', invoice.recipientName || customer.name || '-'); box(L + 343, y, 126, 25, 'CNPJ/CPF', document(invoice.recipientCnpj || customer.cpfCnpj)); box(L + 469, y, 90, 25, 'Data emissão', date(issued)); y += 25;
    box(L, y, 287, 25, 'Endereço', invoice.previewData?.recipientAddress || customer.address || '-'); box(L + 287, y, 132, 25, 'Bairro/Distrito', invoice.previewData?.recipientNeighborhood || customer.neighborhood || '-'); box(L + 419, y, 70, 25, 'CEP', invoice.previewData?.recipientCep || customer.cep || '-'); box(L + 489, y, 70, 25, 'Data entrada/saída', date(issued)); y += 25;
    box(L, y, 232, 25, 'Município', invoice.previewData?.recipientCity || customer.city || '-'); box(L + 232, y, 102, 25, 'Fone/Fax', invoice.previewData?.recipientPhone || customer.phone || '-'); box(L + 334, y, 35, 25, 'UF', invoice.previewData?.recipientUf || customer.uf || '-'); box(L + 369, y, 120, 25, 'Inscrição estadual', invoice.previewData?.recipientIE || customer.stateRegistration || '-'); box(L + 489, y, 70, 25, 'Hora entrada/saída', issued ? new Date(issued).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'); y += 29;

    section('FATURA/DUPLICATAS'); const dups = installments.length ? installments : invoice.previewData?.paymentInstallments || [];
    if (dups.length) { const shown = dups.slice(0, 6), cw = W / shown.length; shown.forEach((d: any, n: number) => box(L + n * cw, y, cw, 32, `Número ${String(d.number || n + 1).padStart(3, '0')}`, `Vencimento ${date(String(d.dueDate).substring(0, 10))}\nValor R$ ${money(d.value)}`, { size: 5.7 })); y += 36; } else { box(L, y, W, 26, 'Forma de pagamento', invoice.previewData?.paymentMethodLabel || invoice.sale?.paymentMethod || '-'); y += 30; }

    section('CÁLCULO DO IMPOSTO'); const top: Array<[string, number]> = [['Base de cálculo do ICMS', this.xn(xml, 'vBC')], ['Valor do ICMS', this.xn(xml, 'vICMS')], ['Base de cálculo do ICMS subst.', this.xn(xml, 'vBCST')], ['Valor do ICMS subst.', this.xn(xml, 'vST')], ['Valor total dos produtos/serviços', productTotal]]; top.forEach((c, n) => box(L + n * W / 5, y, W / 5, 25, c[0], money(c[1]), { align: 'right', bold: n === 4 })); y += 25;
    const bottom: Array<[string, number]> = [['Valor do frete', this.xn(xml, 'vFrete')], ['Valor do seguro', this.xn(xml, 'vSeg')], ['Desconto', this.xn(xml, 'vDesc') || Number(invoice.sale?.discountAmount || 0)], ['Outras despesas acessórias', this.xn(xml, 'vOutro')], ['Valor do IPI', this.xn(xml, 'vIPI')], ['Valor do PIS', this.xn(xml, 'vPIS')], ['Valor do COFINS', this.xn(xml, 'vCOFINS')], ['Valor total da nota', noteTotal]]; bottom.forEach((c, n) => box(L + n * W / 8, y, W / 8, 25, c[0], money(c[1]), { align: 'right', bold: n === 7 })); y += 29;

    section('TRANSPORTADORA/VOLUMES TRANSPORTADOS'); box(L, y, 206, 25, 'Nome/Razão social', ''); box(L + 206, y, 100, 25, 'Frete por conta', this.xv(xml, 'modFrete') || '9-Sem transporte'); box(L + 306, y, 78, 25, 'Código ANTT', this.xv(xml, 'RNTC')); box(L + 384, y, 80, 25, 'Placa do veículo', this.xv(xml, 'placa')); box(L + 464, y, 30, 25, 'UF'); box(L + 494, y, 65, 25, 'CNPJ/CPF'); y += 25;
    box(L, y, 260, 23, 'Endereço'); box(L + 260, y, 184, 23, 'Município'); box(L + 444, y, 35, 23, 'UF'); box(L + 479, y, 80, 23, 'Inscrição estadual'); y += 23;
    [['Quantidade', 'qVol'], ['Espécie', 'esp'], ['Marca', 'marca'], ['Numeração', 'nVol'], ['Peso bruto', 'pesoB'], ['Peso líquido', 'pesoL']].forEach((f, n) => box(L + n * W / 6, y, W / 6, 23, f[0], this.xv(xml, f[1]) || (n > 3 ? '0,000' : ''))); y += 27;

    section('DADOS DO PRODUTO/SERVIÇO'); const widths = [45, 141, 34, 25, 28, 21, 32, 39, 30, 39, 30, 30, 26, 21, 18]; const headers = ['CÓDIGO', 'DESCRIÇÃO PRODUTOS/SERVIÇOS', 'NCM/SH', 'CST', 'CFOP', 'UNID', 'QUANT', 'V.UNITÁRIO', 'V.DESC', 'V.TOTAL', 'BC ICMS', 'V.ICMS', 'V.IPI', 'ALIQ.ICMS', 'ALIQ.IPI']; let x = L; headers.forEach((h, n) => { box(x, y, widths[n], 22, '', h, { size: 4, bold: true, align: 'center' }); x += widths[n]; }); y += 22;
    for (const i of rows) { if (y + 24 > 733) break; const values: any[] = [i.code, i.description, i.ncm, i.cst, i.cfop, i.unit, quantity(i.quantity), money(i.unitPrice), money(i.discount), money(i.total), money(i.bcIcms), money(i.icms), money(i.ipi), money(i.icmsRate), money(i.ipiRate)]; x = L; values.forEach((v, n) => { box(x, y, widths[n], 24, '', v, { size: n === 1 ? 5.3 : 4.6, align: n >= 6 ? 'right' : n === 1 ? 'left' : 'center' }); x += widths[n]; }); y += 24; }
    if (y < 733) { box(L, y, W, 733 - y); y = 733; }
    section('DADOS ADICIONAIS'); box(L, y, 370, 74, 'Informações complementares', invoice.observations || this.xv(xml, 'infCpl') || 'DOCUMENTO FISCAL EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.', { size: 5.7 }); box(L + 370, y, 189, 74, 'Reservado ao fisco');
    if (preview) { doc.save(); doc.opacity(.12).fillColor('#b91c1c').font('Helvetica-Bold').fontSize(48); doc.rotate(-38, { origin: [297, 421] }).text('SEM VALOR FISCAL', 80, 385, { width: 440, align: 'center' }); doc.restore(); text('PRÉ-VISUALIZAÇÃO — NENHUM NÚMERO FOI RESERVADO E NENHUM DOCUMENTO FOI TRANSMITIDO', L, 820, W, 5.2, true, 'center'); }
    doc.end(); return done;
  }
}
