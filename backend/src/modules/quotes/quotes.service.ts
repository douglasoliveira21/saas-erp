import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Quote } from './entities/quote.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote) private quoteRepo: Repository<Quote>,
    private dataSource: DataSource,
  ) {}

  async create(dto: any, userId: string): Promise<Quote> {
    // Get next sequential number
    const lastQuote = await this.quoteRepo.createQueryBuilder('q').orderBy('q.number', 'DESC').getOne();
    const nextNumber = (lastQuote?.number || 0) + 1;

    const quote = this.quoteRepo.create({
      ...dto,
      number: nextNumber,
      createdById: userId,
      status: 'pendente',
    } as Partial<Quote>);
    return this.quoteRepo.save(quote);
  }

  async findAll(filters?: { status?: string; search?: string }): Promise<Quote[]> {
    const qb = this.quoteRepo.createQueryBuilder('q')
      .leftJoinAndSelect('q.customer', 'customer')
      .leftJoinAndSelect('q.createdBy', 'createdBy')
      .orderBy('q.number', 'DESC');

    if (filters?.status) qb.andWhere('q.status = :status', { status: filters.status });
    if (filters?.search) qb.andWhere('(customer.name ILIKE :search OR q.observations ILIKE :search)', { search: `%${filters.search}%` });

    return qb.getMany();
  }

  async findOne(id: string): Promise<Quote> {
    const q = await this.quoteRepo.findOne({ where: { id }, relations: ['customer', 'createdBy'] });
    if (!q) throw new NotFoundException('Orçamento não encontrado');
    return q;
  }

  async update(id: string, dto: any): Promise<Quote> {
    const q = await this.findOne(id);
    if (q.status !== 'pendente') throw new BadRequestException('Apenas orçamentos pendentes podem ser editados');
    Object.assign(q, dto);
    return this.quoteRepo.save(q);
  }

  async approve(id: string): Promise<Quote> {
    const q = await this.findOne(id);
    if (q.status !== 'pendente') throw new BadRequestException('Orçamento não está pendente');
    // Check validity
    if (new Date(q.validUntil) < new Date()) throw new BadRequestException('Orçamento expirado');

    q.status = 'aprovado';
    q.approvedAt = new Date();
    return this.quoteRepo.save(q);
  }

  async convertToSale(id: string, userId: string, saleData: any): Promise<Quote> {
    const q = await this.findOne(id);
    if (q.status !== 'aprovado') throw new BadRequestException('Apenas orçamentos aprovados podem ser convertidos em venda');

    // Create sale via direct query
    const result = await this.dataSource.query(`
      INSERT INTO sales (technician_id, customer_id, status, payment_method, subtotal, tax_amount, total_amount, net_profit, commission_percentage, commission_amount, observations, installments, due_day, sale_type)
      VALUES ($1, $2, 'pendente', $3, $4, 0, $5, 0, $6, $7, $8, $9, $10, 'eventual')
      RETURNING id
    `, [
      userId,
      q.customerId,
      saleData.paymentMethod || 'boleto',
      q.subtotal,
      q.totalAmount,
      saleData.commissionPercentage || 10,
      Number(q.totalAmount) * (saleData.commissionPercentage || 10) / 100,
      `Convertido do orçamento #${q.number}${q.observations ? ' | ' + q.observations : ''}`,
      saleData.installments || 1,
      saleData.dueDay || 10,
    ]);

    const saleId = result[0]?.id;
    if (saleId) {
      // Create sale items
      for (const item of q.items) {
        await this.dataSource.query(`
          INSERT INTO sale_items (sale_id, name, quantity, unit_price, total_price, cost_price, net_profit)
          VALUES ($1, $2, $3, $4, $5, 0, 0)
        `, [saleId, item.name, item.quantity, item.unitPrice, item.totalPrice]);
      }

      q.status = 'convertido';
      q.saleId = saleId;
      await this.quoteRepo.save(q);
    }

    return q;
  }

  async reject(id: string, reason?: string): Promise<Quote> {
    const q = await this.findOne(id);
    if (q.status !== 'pendente') throw new BadRequestException('Orçamento não está pendente');
    q.status = 'rejeitado';
    q.rejectedAt = new Date();
    q.rejectionReason = reason || null;
    return this.quoteRepo.save(q);
  }

  async duplicate(id: string, userId: string): Promise<Quote> {
    const original = await this.findOne(id);
    const lastQuote = await this.quoteRepo.createQueryBuilder('q').orderBy('q.number', 'DESC').getOne();
    const nextNumber = (lastQuote?.number || 0) + 1;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const quote = this.quoteRepo.create({
      number: nextNumber,
      customerId: original.customerId,
      createdById: userId,
      status: 'pendente',
      validUntil: validUntil.toISOString().split('T')[0],
      items: original.items,
      subtotal: original.subtotal,
      discount: original.discount,
      totalAmount: original.totalAmount,
      paymentConditions: original.paymentConditions,
      observations: original.observations,
    });
    return this.quoteRepo.save(quote);
  }

  async remove(id: string): Promise<void> {
    const q = await this.findOne(id);
    await this.quoteRepo.remove(q);
  }

  // Generate PDF HTML
  async generatePdfHtml(id: string): Promise<string> {
    const q = await this.findOne(id);
    const items = q.items || [];
    const customer = q.customer;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orcamento #${q.number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;color:#333;line-height:1.5;padding:40px}
.header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #7c3aed}
.company{font-size:20px;font-weight:bold;color:#7c3aed}
.quote-info{text-align:right}
.quote-number{font-size:24px;font-weight:bold;color:#7c3aed}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:#fef3c7;color:#92400e}
.badge.aprovado{background:#d1fae5;color:#065f46}
.section{margin:20px 0}
.section-title{font-size:14px;font-weight:bold;color:#7c3aed;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
.customer-info{background:#f8fafc;padding:15px;border-radius:8px;border:1px solid #e2e8f0}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#7c3aed;color:white;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase}
td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
tr:nth-child(even){background:#f8fafc}
.totals{margin-top:20px;text-align:right}
.totals .row{display:flex;justify-content:flex-end;gap:40px;padding:6px 0}
.totals .total-final{font-size:20px;font-weight:bold;color:#7c3aed;border-top:2px solid #7c3aed;padding-top:10px;margin-top:10px}
.conditions{margin-top:30px;padding:15px;background:#f5f3ff;border-radius:8px;border:1px solid #ddd6fe}
.footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e2e8f0;padding-top:15px}
.validity{margin-top:15px;padding:10px;background:#fef3c7;border-radius:8px;text-align:center;font-size:12px;color:#92400e}
</style></head><body>
<div class="header">
  <div><div class="company">VGON Soluções em Informática</div><div style="font-size:12px;color:#666;margin-top:4px">CNPJ: Consultar | Contagem/MG</div></div>
  <div class="quote-info">
    <div class="quote-number">Orçamento #${String(q.number).padStart(4, '0')}</div>
    <div style="font-size:12px;color:#666;margin-top:4px">Data: ${new Date(q.createdAt).toLocaleDateString('pt-BR')}</div>
    <div style="margin-top:6px"><span class="badge ${q.status}">${q.status.toUpperCase()}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Cliente</div>
  <div class="customer-info">
    <strong>${customer?.name || ''}</strong><br>
    ${customer?.cpfCnpj ? 'CPF/CNPJ: ' + customer.cpfCnpj + '<br>' : ''}
    ${customer?.email ? 'Email: ' + customer.email + '<br>' : ''}
    ${customer?.phone ? 'Telefone: ' + customer.phone + '<br>' : ''}
    ${customer?.address ? 'Endereço: ' + customer.address : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">Itens do Orçamento</div>
  <table>
    <thead><tr><th>#</th><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead>
    <tbody>
      ${items.map((item: any, i: number) => `<tr><td>${i + 1}</td><td>${item.name}${item.description ? '<br><small style="color:#666">' + item.description + '</small>' : ''}</td><td>${item.quantity}</td><td>R$ ${Number(item.unitPrice).toFixed(2)}</td><td>R$ ${Number(item.totalPrice).toFixed(2)}</td></tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="totals">
  <div class="row"><span>Subtotal:</span><span>R$ ${Number(q.subtotal).toFixed(2)}</span></div>
  ${Number(q.discount) > 0 ? `<div class="row"><span>Desconto (${q.discount}%):</span><span>- R$ ${(Number(q.subtotal) * Number(q.discount) / 100).toFixed(2)}</span></div>` : ''}
  <div class="row total-final"><span>Total:</span><span>R$ ${Number(q.totalAmount).toFixed(2)}</span></div>
</div>

${q.paymentConditions ? `<div class="conditions"><div class="section-title">Condições de Pagamento</div><p style="font-size:13px">${q.paymentConditions}</p></div>` : ''}
${q.observations ? `<div class="section"><div class="section-title">Observações</div><p style="font-size:13px">${q.observations}</p></div>` : ''}

<div class="validity">⏰ Validade deste orçamento: <strong>${new Date(q.validUntil + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>

<div class="footer">
  <p>VGON Soluções em Informática | Contagem/MG</p>
  <p>Este documento é um orçamento e não gera compromisso financeiro até a aprovação.</p>
</div>
</body></html>`;
  }
}
