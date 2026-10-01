import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import PDFDocument = require('pdfkit');
import { FinancialMovement } from './entities/financial-movement.entity';
import { Installment } from './entities/installment.entity';
import { AccountReceivable } from './entities/account-receivable.entity';
import { Bill } from '../suppliers/entities/bill.entity';
import { Invoice } from '../fiscal/entities/invoice.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { CompanyProfile } from '../company-profile/entities/company-profile.entity';

const PAGE_WIDTH = 595.28; // A4 pt
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_BOTTOM = 780;

// Larguras das colunas da tabela - soma deve bater com CONTENT_WIDTH (515.28)
const COLS = {
  date: 52,
  doc: 58,
  sale: 55,
  description: 138,
  installment: 42,
  credit: 56,
  debit: 56,
  balance: 58,
};

interface LedgerRow {
  date: string;
  documentNumber: string;
  saleNumber: string;
  description: string;
  installmentLabel: string;
  credit: number;
  debit: number;
}

@Injectable()
export class CashFlowReportPdfService {
  constructor(
    @InjectRepository(FinancialMovement) private movementRepo: Repository<FinancialMovement>,
    @InjectRepository(Installment) private installmentRepo: Repository<Installment>,
    @InjectRepository(AccountReceivable) private accountRepo: Repository<AccountReceivable>,
    @InjectRepository(Bill) private billRepo: Repository<Bill>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(SaleItem) private saleItemRepo: Repository<SaleItem>,
    @InjectRepository(CompanyProfile) private companyProfileRepo: Repository<CompanyProfile>,
  ) {}

  async generate(tenantId: string, startDate: string, endDate: string): Promise<Buffer> {
    const rows = await this.buildRows(startDate, endDate);
    const company = await this.companyProfileRepo.findOne({ where: { tenantId } });
    return this.render(rows, company, startDate, endDate);
  }

  private async buildRows(startDate: string, endDate: string): Promise<LedgerRow[]> {
    // Lado "crédito/débito de vendas" - movimentos financeiros realizados (recebimentos, taxas
    // de cartão, estornos). Vem de financial_movements, que já é o "livro-razão" das vendas.
    const movements = await this.movementRepo.find({
      where: { date: Between(startDate, endDate), isForecast: false },
      order: { date: 'ASC' },
    });

    const saleIds = [...new Set(movements.map((m) => m.saleId).filter(Boolean))];
    const installmentIds = [...new Set(movements.map((m) => m.installmentId).filter(Boolean))];
    const accountIds = [...new Set(movements.map((m) => m.accountId).filter(Boolean))];

    const [invoices, installments, accounts, saleItems] = await Promise.all([
      saleIds.length ? this.invoiceRepo.find({ where: { saleId: In(saleIds) } }) : Promise.resolve([]),
      installmentIds.length ? this.installmentRepo.find({ where: { id: In(installmentIds) } }) : Promise.resolve([]),
      accountIds.length ? this.accountRepo.find({ where: { id: In(accountIds) } }) : Promise.resolve([]),
      saleIds.length ? this.saleItemRepo.find({ where: { saleId: In(saleIds) } }) : Promise.resolve([]),
    ]);
    const invoiceBySale = new Map(invoices.map((inv) => [inv.saleId, inv]));
    const installmentById = new Map(installments.map((i) => [i.id, i]));
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    // "Recebimento venda {uuid}"/"Pagamento parcela N"/"Venda #xxx (previsão)" são textos
    // genéricos de controle interno, não a descrição do que foi vendido - troca pelos nomes dos
    // itens da própria venda, que é o que o usuário espera ver no relatório.
    const itemNamesBySale = new Map<string, string>();
    for (const item of saleItems) {
      const current = itemNamesBySale.get(item.saleId);
      itemNamesBySale.set(item.saleId, current ? `${current}, ${item.name}` : item.name);
    }

    const movementRows: LedgerRow[] = movements.map((m) => {
      const installment = m.installmentId ? installmentById.get(m.installmentId) : null;
      const account = m.accountId ? accountById.get(m.accountId) : null;
      const invoice = m.saleId ? invoiceBySale.get(m.saleId) : null;
      const isCredit = m.type === 'receita';
      const isReversal = m.type === 'estorno';
      const saleDescription = m.saleId ? itemNamesBySale.get(m.saleId) : null;
      const description = (isCredit || isReversal) && saleDescription
        ? (isReversal ? `Estorno - ${saleDescription}` : saleDescription)
        : (m.description || '-');
      return {
        date: m.date,
        documentNumber: invoice ? String(invoice.number) : '-',
        saleNumber: m.saleId ? m.saleId.substring(0, 8).toUpperCase() : '-',
        description,
        installmentLabel: installment && account ? `${installment.number}/${account.installments}` : '-',
        credit: isCredit ? Number(m.value) : 0,
        debit: !isCredit ? Number(m.value) : 0,
      };
    });

    // Lado "contas a pagar" - fornecedores pagos no período (bills.entity), que não passam por
    // financial_movements (fluxos distintos no sistema - ver suppliers.module).
    const bills = await this.billRepo
      .createQueryBuilder('bill')
      .where('bill.paidAt IS NOT NULL')
      .andWhere('bill.paidAt >= :start', { start: startDate })
      .andWhere('bill.paidAt <= :end', { end: endDate + ' 23:59:59' })
      .andWhere('bill.paidValue > 0')
      .getMany();

    const billRows: LedgerRow[] = bills.map((b) => ({
      date: b.paidAt ? new Date(b.paidAt).toISOString().split('T')[0] : b.dueDate,
      documentNumber: b.documentNumber || '-',
      saleNumber: '-',
      description: b.description || '-',
      installmentLabel: b.installments > 1 ? `${b.installmentNumber}/${b.installments}` : '-',
      credit: 0,
      debit: Number(b.paidValue),
    }));

    // Lado "boletos de contratos pagos" - desde a correção em inter.service.ts
    // (recordContractPaymentMovement), todo pagamento novo de contrato já gera uma linha em
    // financial_movements (categoria 'contrato') e aparece via movementRows acima. Esta query
    // aqui é só o fallback pra pagamentos ANTIGOS que já estavam 'pago' em `payments` antes
    // dessa correção existir e por isso nunca ganharam o lançamento correspondente - o
    // NOT EXISTS evita contar esses pagamentos em dobro quando o lançamento já existe.
    const contractPayments = await this.movementRepo.manager.query(
      `SELECT p.value AS value, p.paid_at AS paid_at, cb.billing_period AS billing_period,
              c.title AS contract_title, inv.number AS invoice_number
       FROM payments p
       JOIN contract_billings cb ON cb.boleto_code = p.codigo_solicitacao
       JOIN contracts c ON c.id = cb.contract_id
       LEFT JOIN invoices inv ON inv.id = cb.invoice_id
       WHERE p.status = 'pago' AND p.sale_id IS NULL
         AND p.paid_at >= $1 AND p.paid_at <= $2
         AND NOT EXISTS (SELECT 1 FROM financial_movements fm WHERE fm.idempotency_key = 'contract:' || p.codigo_solicitacao)
       ORDER BY p.paid_at ASC`,
      [startDate, endDate + ' 23:59:59'],
    );

    const contractRows: LedgerRow[] = contractPayments.map((cp: any) => ({
      date: new Date(cp.paid_at).toISOString().split('T')[0],
      documentNumber: cp.invoice_number ? String(cp.invoice_number) : '-',
      saleNumber: '-',
      description: `Contrato ${cp.contract_title} - competência ${cp.billing_period}`,
      installmentLabel: '-',
      credit: Number(cp.value),
      debit: 0,
    }));

    return [...movementRows, ...billRows, ...contractRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  private logoBuffer(value?: string): Buffer | null {
    if (!value) return null;
    const match = value.match(/^data:image\/(?:png|jpe?g);base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if (!match) return null;
    try { return Buffer.from(match[1].replace(/\s/g, ''), 'base64'); } catch { return null; }
  }

  private render(rows: LedgerRow[], company: CompanyProfile | null, startDate: string, endDate: string): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.from(c)));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dateFmt = (v: any) => {
      if (!v) return '-';
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
    };
    const ensureSpace = (needed: number, withHeader = true) => {
      if (doc.y + needed > PAGE_BOTTOM) { doc.addPage(); if (withHeader) drawTableHeader(); }
    };

    // ---- Cabeçalho: logo + dados da empresa (esquerda = logo, direita = dados) ----
    const logo = this.logoBuffer(company?.logo);
    const headerY = doc.y;
    if (logo) {
      try { doc.image(logo, MARGIN, headerY, { fit: [90, 60] }); } catch { /* ignora logo inválida */ }
    }
    const infoWidth = 260;
    const infoX = MARGIN + CONTENT_WIDTH - infoWidth;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827')
      .text(company?.razaoSocial || 'Empresa não configurada', infoX, headerY, { width: infoWidth, align: 'right' });
    let infoY = doc.y;
    const infoLine = (text: string) => {
      if (!text) return;
      doc.font('Helvetica').fontSize(8.5).fillColor('#6b7280').text(text, infoX, infoY, { width: infoWidth, align: 'right' });
      infoY = doc.y;
    };
    infoLine(company?.cnpj ? `CNPJ: ${company.cnpj}` : '');
    infoLine(company?.inscricaoEstadual ? `IE: ${company.inscricaoEstadual}` : '');
    infoLine(company?.inscricaoMunicipal ? `IM: ${company.inscricaoMunicipal}` : '');
    infoLine(company?.endereco ? `${company.endereco}${company.cep ? ' - CEP ' + company.cep : ''}` : '');
    infoLine(company?.telefone ? `Tel: ${company.telefone}` : '');
    doc.y = Math.max(headerY + 65, infoY + 4);

    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).lineWidth(1).strokeColor('#111827').stroke();
    doc.moveDown(0.8);

    // ---- Título ----
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827')
      .text('LANÇAMENTOS FINANCEIROS - FLUXO DE CAIXA', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
      .text(`Período: ${dateFmt(startDate)} a ${dateFmt(endDate)}`, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(0.8);

    // ---- Tabela ----
    const colX = {
      date: MARGIN,
      doc: MARGIN + COLS.date,
      sale: MARGIN + COLS.date + COLS.doc,
      description: MARGIN + COLS.date + COLS.doc + COLS.sale,
      installment: MARGIN + COLS.date + COLS.doc + COLS.sale + COLS.description,
      credit: MARGIN + COLS.date + COLS.doc + COLS.sale + COLS.description + COLS.installment,
      debit: MARGIN + COLS.date + COLS.doc + COLS.sale + COLS.description + COLS.installment + COLS.credit,
      balance: MARGIN + COLS.date + COLS.doc + COLS.sale + COLS.description + COLS.installment + COLS.credit + COLS.debit,
    };

    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(MARGIN, y, CONTENT_WIDTH, 18).fill('#111827');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      doc.text('DATA', colX.date + 3, y + 5, { width: COLS.date - 4 });
      doc.text('Nº DOC.', colX.doc + 3, y + 5, { width: COLS.doc - 4 });
      doc.text('Nº VENDA', colX.sale + 3, y + 5, { width: COLS.sale - 4 });
      doc.text('DESCRIÇÃO', colX.description + 3, y + 5, { width: COLS.description - 4 });
      doc.text('PARC.', colX.installment + 3, y + 5, { width: COLS.installment - 4 });
      doc.text('CRÉDITOS', colX.credit + 3, y + 5, { width: COLS.credit - 4, align: 'right' });
      doc.text('DÉBITOS', colX.debit + 3, y + 5, { width: COLS.debit - 4, align: 'right' });
      doc.text('SALDO', colX.balance + 3, y + 5, { width: COLS.balance - 7, align: 'right' });
      doc.y = y + 18;
      doc.fillColor('#111827');
    };

    drawTableHeader();

    let balance = 0;
    let totalCredit = 0;
    let totalDebit = 0;
    rows.forEach((row, idx) => {
      balance += row.credit - row.debit;
      totalCredit += row.credit;
      totalDebit += row.debit;

      ensureSpace(16);
      const y = doc.y;
      if (idx % 2 === 1) doc.rect(MARGIN, y, CONTENT_WIDTH, 15).fill('#f9fafb').fillColor('#111827');
      doc.font('Helvetica').fontSize(8).fillColor('#111827');
      doc.text(dateFmt(row.date), colX.date + 3, y + 4, { width: COLS.date - 4 });
      doc.text(row.documentNumber, colX.doc + 3, y + 4, { width: COLS.doc - 4 });
      doc.text(row.saleNumber, colX.sale + 3, y + 4, { width: COLS.sale - 4 });
      doc.text(row.description, colX.description + 3, y + 4, { width: COLS.description - 6, height: 11, ellipsis: true, lineBreak: false });
      doc.text(row.installmentLabel, colX.installment + 3, y + 4, { width: COLS.installment - 4 });
      doc.fillColor('#15803d').text(row.credit ? money(row.credit) : '-', colX.credit + 3, y + 4, { width: COLS.credit - 4, align: 'right' });
      doc.fillColor('#b91c1c').text(row.debit ? money(row.debit) : '-', colX.debit + 3, y + 4, { width: COLS.debit - 4, align: 'right' });
      doc.fillColor('#111827').text(money(balance), colX.balance + 3, y + 4, { width: COLS.balance - 7, align: 'right' });
      doc.y = y + 15;
    });

    if (!rows.length) {
      ensureSpace(20);
      doc.font('Helvetica').fontSize(9.5).fillColor('#6b7280').text('Nenhum lançamento encontrado no período selecionado.', MARGIN, doc.y + 6);
    }

    // ---- Totais (cards) ----
    const finalBalance = totalCredit - totalDebit;
    ensureSpace(70, false);
    doc.moveDown(0.8);

    const gap = 12;
    const boxWidth = (CONTENT_WIDTH - gap * 2) / 3;
    const boxHeight = 48;
    const boxY = doc.y;
    const cards = [
      { label: 'TOTAL DE CRÉDITOS', value: money(totalCredit), bg: '#f0fdf4', color: '#15803d' },
      { label: 'TOTAL DE DÉBITOS', value: money(totalDebit), bg: '#fef2f2', color: '#b91c1c' },
      { label: 'SALDO DO PERÍODO', value: money(finalBalance), bg: '#eff6ff', color: finalBalance >= 0 ? '#1d4ed8' : '#b91c1c' },
    ];
    cards.forEach((card, i) => {
      const x = MARGIN + i * (boxWidth + gap);
      doc.roundedRect(x, boxY, boxWidth, boxHeight, 4).fill(card.bg);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#6b7280')
        .text(card.label, x + 10, boxY + 10, { width: boxWidth - 20 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(card.color)
        .text(card.value, x + 10, boxY + 24, { width: boxWidth - 20 });
    });
    doc.y = boxY + boxHeight;
    doc.fillColor('#111827');

    doc.end();
    return done;
  }
}
