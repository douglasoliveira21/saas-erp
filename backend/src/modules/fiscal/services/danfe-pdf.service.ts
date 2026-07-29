import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument = require('pdfkit');
import bwipjs = require('bwip-js');
import { Invoice } from '../entities/invoice.entity';
import { FiscalConfig } from '../entities/fiscal-config.entity';

@Injectable()
export class DanfePdfService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(FiscalConfig) private readonly configRepo: Repository<FiscalConfig>,
  ) {}

  async generate(invoiceId: string): Promise<Buffer> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId }, relations: ['sale', 'sale.customer', 'sale.items'] });
    if (!invoice || invoice.type !== 'nfe') throw new NotFoundException('NF-e não encontrada para gerar DANFE');
    const config = await this.configRepo.findOne({ where: {} });
    const doc = new PDFDocument({ size: 'A4', margin: 24, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });

    const x = 24; const width = 547; let y = 24;
    const box = (bx: number, by: number, bw: number, bh: number, label?: string, value?: string, options: any = {}) => {
      doc.rect(bx, by, bw, bh).stroke('#000');
      if (label) doc.font('Helvetica').fontSize(5.5).text(label.toUpperCase(), bx + 3, by + 2, { width: bw - 6 });
      if (value !== undefined) doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.size || 8).text(String(value), bx + 3, by + (label ? 11 : 4), { width: bw - 6, height: bh - (label ? 13 : 6), ellipsis: true, align: options.align || 'left' });
    };
    const money = (value: any) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const date = (value: any) => value ? new Date(value).toLocaleDateString('pt-BR') : '-';
    const key = String(invoice.accessKey || '').replace(/\D/g, '');
    const formattedKey = key.replace(/(.{4})/g, '$1 ').trim();

    box(x, y, 190, 102);
    doc.font('Helvetica-Bold').fontSize(11).text(config?.companyName || 'VGON', x + 5, y + 10, { width: 180, align: 'center' });
    doc.font('Helvetica').fontSize(7).text(`${config?.emitAddress || ''}, ${config?.emitNumber || ''}`, x + 5, y + 32, { width: 180, align: 'center' });
    doc.text(`${config?.emitNeighborhood || ''} - CEP ${config?.emitCep || ''}`, x + 5, y + 44, { width: 180, align: 'center' });
    doc.text(`CNPJ: ${config?.cnpj || ''}   IE: ${config?.stateRegistration || ''}`, x + 5, y + 58, { width: 180, align: 'center' });

    box(x + 190, y, 120, 102);
    doc.font('Helvetica-Bold').fontSize(17).text('DANFE', x + 195, y + 8, { width: 110, align: 'center' });
    doc.font('Helvetica').fontSize(6).text('DOCUMENTO AUXILIAR DA\nNOTA FISCAL ELETRÔNICA', x + 195, y + 29, { width: 110, align: 'center' });
    doc.fontSize(7).text('0 - ENTRADA   1 - SAÍDA', x + 195, y + 53, { width: 110, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(11).text(`Nº ${String(invoice.number || 0).padStart(9, '0')}`, x + 195, y + 69, { width: 110, align: 'center' });
    doc.fontSize(8).text(`SÉRIE ${invoice.series || 1}`, x + 195, y + 86, { width: 110, align: 'center' });

    box(x + 310, y, 237, 102);
    if (key.length === 44) {
      try {
        const barcode = await new Promise<Buffer>((resolve, reject) => bwipjs.toBuffer({ bcid: 'code128', text: key, scale: 1.5, height: 10, includetext: false }, (error, png) => error ? reject(error) : resolve(png)));
        doc.image(barcode, x + 321, y + 8, { fit: [215, 38], align: 'center' });
      } catch {}
    }
    doc.font('Courier-Bold').fontSize(8).text(formattedKey || '-', x + 318, y + 49, { width: 221, align: 'center' });
    doc.font('Helvetica').fontSize(5.5).text('Consulta de autenticidade em www.nfe.fazenda.gov.br/portal', x + 318, y + 67, { width: 221, align: 'center' });
    doc.fontSize(6).text(`PROTOCOLO: ${invoice.protocolNumber || '-'}  ${invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString('pt-BR') : ''}`, x + 318, y + 82, { width: 221, align: 'center' });
    y += 102;

    box(x, y, 300, 31, 'Natureza da operação', key[22] === '0' ? 'COMPRA' : 'VENDA');
    box(x + 300, y, 125, 31, 'Inscrição estadual', config?.stateRegistration || '');
    box(x + 425, y, 122, 31, 'Inscrição municipal', config?.cityRegistration || ''); y += 31;
    doc.rect(x, y, width, 14).fillAndStroke('#e5e7eb', '#000'); doc.fillColor('#000').font('Helvetica-Bold').fontSize(7).text('DESTINATÁRIO / REMETENTE', x + 4, y + 4); y += 14;
    const customer: any = invoice.sale?.customer || {};
    box(x, y, 300, 31, 'Nome / razão social', invoice.recipientName || customer.name || '-');
    box(x + 300, y, 130, 31, 'CNPJ / CPF', invoice.recipientCnpj || customer.cpfCnpj || '-');
    box(x + 430, y, 117, 31, 'Data de emissão', date(invoice.issuedAt)); y += 31;
    box(x, y, 290, 31, 'Endereço', customer.address || '-'); box(x + 290, y, 120, 31, 'Bairro', customer.neighborhood || '-'); box(x + 410, y, 80, 31, 'CEP', customer.cep || '-'); box(x + 490, y, 57, 31, 'UF', customer.uf || '-'); y += 31;

    doc.rect(x, y, width, 14).fillAndStroke('#e5e7eb', '#000'); doc.fillColor('#000').font('Helvetica-Bold').fontSize(7).text('DADOS DOS PRODUTOS / SERVIÇOS', x + 4, y + 4); y += 14;
    const columns = [250, 42, 75, 85, 95]; const headers = ['DESCRIÇÃO', 'QTD.', 'VALOR UNIT.', 'VALOR TOTAL', 'CÓDIGO']; let cx = x;
    headers.forEach((h, i) => { box(cx, y, columns[i], 20, undefined, h, { bold: true, size: 6, align: 'center' }); cx += columns[i]; }); y += 20;
    const items: any[] = invoice.sale?.items || [];
    for (const item of items) {
      if (y > 700) { doc.addPage(); y = 24; }
      cx = x; const values = [item.name || '-', Number(item.quantity || 0).toString(), `R$ ${money(item.unitPrice)}`, `R$ ${money(item.totalPrice)}`, item.productId || item.serviceId || '-'];
      values.forEach((v, i) => { box(cx, y, columns[i], 24, undefined, v, { size: 7, align: i > 0 && i < 4 ? 'right' : 'left' }); cx += columns[i]; }); y += 24;
    }
    if (!items.length) { box(x, y, width, 24, undefined, 'Nenhum item informado'); y += 24; }
    doc.rect(x, y, width, 14).fillAndStroke('#e5e7eb', '#000'); doc.fillColor('#000').font('Helvetica-Bold').fontSize(7).text('CÁLCULO DO IMPOSTO', x + 4, y + 4); y += 14;
    box(x, y, 137, 34, 'Base de cálculo ICMS', 'R$ 0,00', { align: 'right' }); box(x + 137, y, 137, 34, 'Valor do ICMS', 'R$ 0,00', { align: 'right' }); box(x + 274, y, 136, 34, 'Valor dos produtos', `R$ ${money(items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0))}`, { align: 'right' }); box(x + 410, y, 137, 34, 'Valor total da nota', `R$ ${money(invoice.totalValue)}`, { bold: true, align: 'right' }); y += 34;
    box(x, y, width, 58, 'Dados adicionais / informações complementares', invoice.observations || 'Documento emitido pelo ERP VGON.');
    doc.end();
    return done;
  }
}
