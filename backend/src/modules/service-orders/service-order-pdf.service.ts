import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, readFileSync } from 'fs';
import sharp from 'sharp';
import PDFDocument = require('pdfkit');
import { ServiceOrder } from './entities/service-order.entity';
import { ServiceOrderAttachment } from './entities/service-order-attachment.entity';
import { ServiceOrderStatus } from './entities/service-order-status.entity';
import { FiscalConfig } from '../fiscal/entities/fiscal-config.entity';

const PAGE_WIDTH = 595.28; // A4 pt
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_BOTTOM = 780;

@Injectable()
export class ServiceOrderPdfService {
  private readonly logger = new Logger(ServiceOrderPdfService.name);

  constructor(
    @InjectRepository(ServiceOrder) private ordersRepository: Repository<ServiceOrder>,
    @InjectRepository(ServiceOrderStatus) private statusesRepository: Repository<ServiceOrderStatus>,
    @InjectRepository(FiscalConfig) private configRepository: Repository<FiscalConfig>,
  ) {}

  async generate(id: string): Promise<Buffer> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['customer', 'technician', 'attachments'],
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');
    const config = await this.configRepository.findOne({ where: {} });
    const statuses = await this.statusesRepository.find();
    const statusLabel = statuses.find((s) => s.key === order.statusKey)?.label || order.statusKey;
    return this.render(order, config, statusLabel);
  }

  private logoBuffer(value?: string): Buffer | null {
    if (!value) return null;
    const match = value.match(/^data:image\/(?:png|jpe?g);base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if (!match) return null;
    try { return Buffer.from(match[1].replace(/\s/g, ''), 'base64'); } catch { return null; }
  }

  private async render(order: ServiceOrder, config: FiscalConfig | null, statusLabel: string): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.from(c)));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const money = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dateFmt = (v: any, withTime = true) => {
      if (!v) return '-';
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? '-' : (withTime ? d.toLocaleString('pt-BR') : d.toLocaleDateString('pt-BR'));
    };
    const ensureSpace = (needed: number) => {
      if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
    };
    const sectionTitle = (text: string) => {
      ensureSpace(28);
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(text.toUpperCase());
      doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2).lineWidth(0.8).strokeColor('#d1d5db').stroke();
      doc.moveDown(0.6);
    };
    const field = (label: string, value: any, width = CONTENT_WIDTH) => {
      ensureSpace(16);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text(label.toUpperCase() + ':', { continued: true, width });
      doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(' ' + (value || '-'));
    };
    const twoColumns = (left: [string, any], right: [string, any]) => {
      ensureSpace(16);
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text(left[0].toUpperCase() + ':', MARGIN, y, { continued: true, width: CONTENT_WIDTH / 2 });
      doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(' ' + (left[1] || '-'));
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text(right[0].toUpperCase() + ':', MARGIN + CONTENT_WIDTH / 2, y, { continued: true, width: CONTENT_WIDTH / 2 });
      doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(' ' + (right[1] || '-'));
      doc.y = Math.max(doc.y, y + 14);
    };

    // Header
    const logo = this.logoBuffer(config?.companyLogo);
    const headerY = doc.y;
    if (logo) {
      try { doc.image(logo, MARGIN, headerY, { fit: [70, 45] }); } catch { /* ignora logo inválida */ }
    }
    const textX = logo ? MARGIN + 80 : MARGIN;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#111827').text(config?.companyName || 'Ordem de Serviço', textX, headerY, { width: CONTENT_WIDTH - (logo ? 80 : 0) });
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(config?.cnpj ? `CNPJ: ${config.cnpj}` : '', textX);
    doc.y = Math.max(doc.y, headerY + 50);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(`ORDEM DE SERVIÇO Nº ${String(order.number).padStart(5, '0')}`);
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(`Aberta em ${dateFmt(order.openedAt)}  ·  Status atual: ${statusLabel}`);
    doc.moveDown(0.3);

    sectionTitle('Cliente');
    field('Nome / Razão Social', order.customer?.name);
    twoColumns(['CPF/CNPJ', order.customer?.cpfCnpj], ['Telefone', order.customer?.phone]);
    twoColumns(['Email', order.customer?.email], ['Cidade/UF', [order.customer?.city, order.customer?.uf].filter(Boolean).join('/')]);
    twoColumns(['Bairro', order.customer?.neighborhood], ['CEP', order.customer?.cep]);
    if (order.customer?.address) field('Endereço', order.customer.address);

    if (order.equipment || order.brand || order.model || order.serialNumber || order.accessories) {
      sectionTitle('Informações do produto');
      twoColumns(['Equipamento', order.equipment], ['Marca/Modelo', [order.brand, order.model].filter(Boolean).join(' / ')]);
      if (order.serialNumber) field('Número de série', order.serialNumber);
      if (order.accessories) field('Acessórios entregues', order.accessories);
    }

    sectionTitle('Serviço');
    twoColumns(['Tipo de serviço', order.serviceType], ['Atendente responsável', order.technician?.name]);
    twoColumns(['Abertura', dateFmt(order.openedAt)], ['Início', order.startedAt ? dateFmt(order.startedAt) : '-']);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('RELATO DO CLIENTE:');
    doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(order.customerReport || '-', { width: CONTENT_WIDTH });

    if (order.diagnosis) {
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('DIAGNÓSTICO E SERVIÇO A SER PRESTADO:');
      doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(order.diagnosis, { width: CONTENT_WIDTH });
    }

    if (order.observations) {
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('OBSERVAÇÕES:');
      doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(order.observations, { width: CONTENT_WIDTH });
    }

    if (order.conclusionDescription || order.completedAt) {
      sectionTitle('Conclusão');
      field('Concluído em', dateFmt(order.completedAt));
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('O QUE FOI FEITO:');
      doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(order.conclusionDescription || '-', { width: CONTENT_WIDTH });
      doc.moveDown(0.4);
      twoColumns(['Peças/materiais', money(order.partsCost)], ['Mão de obra', money(order.laborCost)]);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111827').text(`Total: ${money(order.totalCost)}`);
    }

    const photos = (order.attachments || []).filter((a) => (a.mimeType || '').startsWith('image/'));
    const before = photos.filter((a) => a.type === 'foto_antes');
    const after = photos.filter((a) => a.type === 'foto_depois');
    if (before.length || after.length) {
      sectionTitle('Antes e depois');
      const colWidth = (CONTENT_WIDTH - 16) / 2;
      const thumbHeight = 130;
      const rows = Math.max(before.length, after.length, 1);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280');
      const labelsY = doc.y;
      doc.text('ANTES', MARGIN, labelsY, { width: colWidth, align: 'center' });
      doc.text('DEPOIS', MARGIN + colWidth + 16, labelsY, { width: colWidth, align: 'center' });
      doc.y = labelsY + 14;
      for (let i = 0; i < rows; i++) {
        ensureSpace(thumbHeight + 8);
        const rowY = doc.y;
        const leftPhoto = before[i];
        const rightPhoto = after[i];
        if (leftPhoto) await this.drawPhoto(doc, leftPhoto, 'antes', order.id, MARGIN, rowY, colWidth, thumbHeight);
        if (rightPhoto) await this.drawPhoto(doc, rightPhoto, 'depois', order.id, MARGIN + colWidth + 16, rowY, colWidth, thumbHeight);
        doc.y = rowY + thumbHeight + 8;
      }
    }

    const documents = (order.attachments || []).filter((a) => !(a.mimeType || '').startsWith('image/'));
    if (documents.length) {
      sectionTitle('Documentos anexados');
      documents.forEach((docAttachment) => {
        ensureSpace(14);
        doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(`• ${docAttachment.filename}`);
      });
    }

    ensureSpace(90);
    doc.moveDown(2);
    const signY = doc.y + 30;
    const signWidth = (CONTENT_WIDTH - 30) / 2;
    doc.moveTo(MARGIN, signY).lineTo(MARGIN + signWidth, signY).strokeColor('#111827').lineWidth(0.8).stroke();
    doc.moveTo(MARGIN + signWidth + 30, signY).lineTo(MARGIN + signWidth * 2 + 30, signY).stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
      .text('Assinatura do cliente', MARGIN, signY + 4, { width: signWidth, align: 'center' })
      .text('Assinatura do técnico', MARGIN + signWidth + 30, signY + 4, { width: signWidth, align: 'center' });

    doc.end();
    return done;
  }

  /**
   * Desenha uma foto de "antes/depois" no PDF. Se o PDFKit não conseguir ler o arquivo direto
   * (formato não suportado, tipicamente HEIC de fotos tiradas direto da câmera do iPhone antes
   * da normalização feita no upload - ver service-orders.service.ts addAttachments), tenta
   * converter para JPEG em memória via sharp como último recurso antes de desistir da foto.
   */
  private async drawPhoto(doc: PDFKit.PDFDocument, photo: ServiceOrderAttachment, label: 'antes' | 'depois', orderId: string, x: number, y: number, width: number, height: number): Promise<void> {
    if (!existsSync(photo.storagePath)) {
      this.logger.warn(`Foto "${label}" ${photo.id} (OS ${orderId}) referenciada no banco, mas o arquivo não existe em disco: ${photo.storagePath}`);
      return;
    }
    try {
      doc.image(photo.storagePath, x, y, { fit: [width, height], align: 'center' });
      return;
    } catch { /* tenta converter abaixo antes de desistir */ }
    try {
      const jpegBuffer = await sharp(photo.storagePath).jpeg().toBuffer();
      doc.image(jpegBuffer, x, y, { fit: [width, height], align: 'center' });
    } catch (error: any) {
      this.logger.warn(`Foto "${label}" ${photo.id} (OS ${orderId}) ilegível mesmo após conversão para JPEG: ${error.message}`);
    }
  }
}
