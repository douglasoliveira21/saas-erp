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
    const createdBy = q.createdBy;
    const quoteNumber = String(q.number).padStart(4, '0');
    const dataEmissao = new Date(q.createdAt).toLocaleDateString('pt-BR');
    const validadeDate = new Date(q.validUntil + 'T12:00:00');
    const hoje = new Date();
    const diffDays = Math.ceil((validadeDate.getTime() - hoje.getTime()) / (1000*60*60*24));
    const validadeLabel = diffDays > 0 ? `${diffDays} dias` : 'Expirado';
    const totalFormatted = Number(q.totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const discountValue = Number(q.subtotal) * Number(q.discount) / 100;

    const itemsHtml = items.map((item: any, i: number) => `
      <tr>
        <td style="text-align:center;font-weight:600;color:#0754B8">${String(i+1).padStart(2,'0')}</td>
        <td>
          <div style="font-weight:600;color:#0F172A">${item.name}</div>
          ${item.description ? `<div style="font-size:10px;color:#64748B;margin-top:2px">${item.description}</div>` : ''}
        </td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:center">${item.unit || 'Un'}</td>
        <td style="text-align:right">R$ ${Number(item.unitPrice).toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">R$ ${Number(item.totalPrice).toFixed(2)}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento #${quoteNumber} - VGON</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#0F172A;line-height:1.4;background:#fff}
.page{width:210mm;min-height:297mm;margin:0 auto;position:relative;overflow:hidden}

/* HEADER */
.header{display:flex;min-height:140px;position:relative}
.header-left{width:50%;background:linear-gradient(135deg,#03172B 0%,#062440 100%);padding:25px 30px;position:relative;clip-path:polygon(0 0,100% 0,85% 100%,0 100%)}
.header-left::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cpath d='M10 10h5v5h-5zM30 20h3v3h-3zM60 15h4v4h-4zM80 30h3v3h-3zM20 50h5v5h-5zM50 60h3v3h-3zM70 70h4v4h-4zM40 80h3v3h-3z' fill='%23168BFF' opacity='0.08'/%3E%3Cpath d='M15 12.5h15M65 17h10M22.5 52.5h10' stroke='%23168BFF' stroke-width='0.5' opacity='0.1'/%3E%3C/svg%3E");opacity:0.5}
.header-right{flex:1;padding:20px 30px;display:flex;flex-direction:column;justify-content:center}
.logo{position:relative;z-index:1}
.logo-icon{display:inline-block;width:36px;height:36px;background:linear-gradient(135deg,#0754B8,#168BFF);border-radius:8px;margin-right:10px;vertical-align:middle}
.logo-text{font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.5px;vertical-align:middle}
.logo-sub{font-size:11px;color:#54B7FF;font-weight:500;letter-spacing:2px;margin-top:2px;margin-left:48px}
.slogan{position:relative;z-index:1;margin-top:20px;font-size:11px;color:rgba(255,255,255,0.7);font-weight:400}
.slogan strong{color:#54B7FF;font-weight:600}
.quote-title{font-size:32px;font-weight:800;color:#03172B;letter-spacing:-1px}
.quote-title-line{width:60px;height:3px;background:linear-gradient(90deg,#0754B8,#168BFF);border-radius:2px;margin-top:6px;position:relative}
.quote-title-line::after{content:'';position:absolute;right:-6px;top:-3px;width:9px;height:9px;border-radius:50%;background:#168BFF}
.info-grid{margin-top:14px;font-size:11px}
.info-row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #F1F5F9}
.info-label{font-weight:600;color:#64748B;min-width:100px;text-transform:uppercase;font-size:9px;letter-spacing:0.5px}
.info-value{color:#0F172A;font-weight:500}

/* CARDS */
.cards-row{display:flex;gap:12px;margin:12px 20px}
.card{flex:1;border:1px solid #D9E2EC;border-radius:8px;padding:14px 16px;background:#fff}
.card-title{font-size:11px;font-weight:700;color:#0754B8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.card-title::before{content:'';display:inline-block;width:4px;height:14px;background:linear-gradient(180deg,#0754B8,#168BFF);border-radius:2px}
.card-row{font-size:10.5px;padding:3px 0;display:flex;gap:6px}
.card-row .label{font-weight:600;color:#64748B;min-width:80px}
.card-row .value{color:#0F172A}

/* TABLE */
.table-section{margin:12px 20px}
.table-title{font-size:11px;font-weight:700;color:#0754B8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.table-title::before{content:'';display:inline-block;width:4px;height:14px;background:linear-gradient(180deg,#0754B8,#168BFF);border-radius:2px}
table{width:100%;border-collapse:collapse;font-size:10.5px}
thead tr{background:linear-gradient(90deg,#03172B,#0754B8)}
th{color:#fff;padding:8px 10px;text-align:left;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.5px}
td{padding:9px 10px;border-bottom:1px solid #E8EDF2}
tbody tr:nth-child(even){background:#F7F9FC}

/* INVESTMENT */
.invest-row{display:flex;gap:12px;margin:12px 20px}
.invest-card{flex:1;border:1px solid #D9E2EC;border-radius:8px;padding:14px 16px}
.invest-panel{background:linear-gradient(135deg,#03172B,#062440);border-radius:6px;padding:16px;text-align:center;position:relative;overflow:hidden}
.invest-panel::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='20' stroke='%23168BFF' stroke-width='0.3' fill='none' opacity='0.2'/%3E%3C/svg%3E");opacity:0.4}
.invest-label{font-size:8px;color:#54B7FF;text-transform:uppercase;letter-spacing:1px;font-weight:600;position:relative}
.invest-value{font-size:28px;font-weight:800;color:#fff;margin-top:4px;position:relative}
.invest-ext{font-size:9px;color:rgba(255,255,255,0.6);margin-top:4px;position:relative}
.invest-line{width:40px;height:2px;background:#168BFF;margin:8px auto 0;border-radius:1px;position:relative}
.conditions-list{font-size:10px;list-style:none}
.conditions-list li{padding:4px 0;padding-left:14px;position:relative;border-bottom:1px solid #F1F5F9}
.conditions-list li::before{content:'';position:absolute;left:0;top:9px;width:6px;height:6px;border-radius:50%;background:#168BFF}
.conditions-list .label{font-weight:600;color:#0F172A}
.conditions-list .value{color:#64748B}

/* OBSERVATIONS */
.obs-section{margin:12px 20px}
.obs-card{border:1px solid #D9E2EC;border-radius:8px;padding:14px 16px}
.obs-text{font-size:10px;color:#64748B;line-height:1.5}
.signature-line{border-top:1px solid #64748B;width:200px;margin-top:20px;margin-left:auto;padding-top:4px;text-align:center;font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px}

/* FOOTER */
.footer{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(90deg,#03172B,#062440);padding:14px 30px;display:flex;align-items:center;justify-content:space-between}
.footer-logo{font-size:11px;font-weight:700;color:#fff}
.footer-logo-sub{font-size:8px;color:#54B7FF;letter-spacing:1px}
.footer-info{display:flex;gap:20px;font-size:9px;color:rgba(255,255,255,0.7)}
.footer-info span{display:flex;align-items:center;gap:4px}

@media print{
  body{margin:0}
  .page{width:100%;min-height:auto}
}
</style></head><body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <div class="logo">
        <span class="logo-icon"></span>
        <span class="logo-text">VGON</span>
        <div class="logo-sub">SOLUÇÕES EM TI</div>
      </div>
      <div class="slogan">TECNOLOGIA QUE <strong>CONECTA</strong>,<br>SOLUÇÕES QUE <strong>TRANSFORMAM</strong>.</div>
    </div>
    <div class="header-right">
      <div class="quote-title">ORÇAMENTO</div>
      <div class="quote-title-line"></div>
      <div class="info-grid">
        <div class="info-row"><span class="info-label">Nº Orçamento:</span><span class="info-value">${new Date(q.createdAt).getFullYear()}-${quoteNumber}</span></div>
        <div class="info-row"><span class="info-label">Data:</span><span class="info-value">${dataEmissao}</span></div>
        <div class="info-row"><span class="info-label">Validade:</span><span class="info-value">${validadeLabel}</span></div>
        <div class="info-row"><span class="info-label">Consultor:</span><span class="info-value">${createdBy?.name || 'VGON'}</span></div>
        <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${createdBy?.email || 'contato@vgon.com.br'}</span></div>
      </div>
    </div>
  </div>

  <!-- DADOS DO CLIENTE + ESCOPO -->
  <div class="cards-row">
    <div class="card">
      <div class="card-title">DADOS DO CLIENTE</div>
      <div class="card-row"><span class="label">Razão Social:</span><span class="value">${customer?.name || '-'}</span></div>
      ${customer?.cpfCnpj ? `<div class="card-row"><span class="label">CPF/CNPJ:</span><span class="value">${customer.cpfCnpj}</span></div>` : ''}
      ${customer?.email ? `<div class="card-row"><span class="label">E-mail:</span><span class="value">${customer.email}</span></div>` : ''}
      ${customer?.phone ? `<div class="card-row"><span class="label">Telefone:</span><span class="value">${customer.phone}</span></div>` : ''}
      ${customer?.address ? `<div class="card-row"><span class="label">Endereço:</span><span class="value">${customer.address}</span></div>` : ''}
    </div>
    <div class="card">
      <div class="card-title">OBJETIVO / ESCOPO</div>
      <p style="font-size:10px;color:#64748B;line-height:1.5">Apresentamos abaixo nossa proposta comercial para prestação de serviços e soluções em Tecnologia da Informação, conforme necessidades identificadas.</p>
    </div>
  </div>

  <!-- TABELA DE ITENS -->
  <div class="table-section">
    <div class="table-title">ITENS / SERVIÇOS</div>
    <table>
      <thead><tr><th>Item</th><th>Descrição do Serviço / Solução</th><th style="text-align:center">Qtde.</th><th style="text-align:center">Unid.</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Valor Total</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  <!-- INVESTIMENTO + CONDIÇÕES -->
  <div class="invest-row">
    <div class="invest-card">
      <div class="card-title">INVESTIMENTO</div>
      <div class="invest-panel">
        <div class="invest-label">VALOR TOTAL DO ORÇAMENTO</div>
        <div class="invest-value">${totalFormatted}</div>
        ${Number(q.discount) > 0 ? `<div class="invest-ext">Desconto de ${q.discount}% aplicado (- R$ ${discountValue.toFixed(2)})</div>` : ''}
        <div class="invest-line"></div>
      </div>
    </div>
    <div class="invest-card">
      <div class="card-title">CONDIÇÕES COMERCIAIS</div>
      <ul class="conditions-list">
        ${q.paymentConditions ? `<li><span class="label">Pagamento:</span> <span class="value">${q.paymentConditions}</span></li>` : '<li><span class="label">Pagamento:</span> <span class="value">A combinar</span></li>'}
        <li><span class="label">Validade:</span> <span class="value">${new Date(q.validUntil + 'T12:00:00').toLocaleDateString('pt-BR')}</span></li>
        <li><span class="label">Início:</span> <span class="value">Até 5 dias úteis após aprovação</span></li>
        <li><span class="label">Garantia:</span> <span class="value">Conforme contrato de serviço</span></li>
      </ul>
    </div>
  </div>

  <!-- OBSERVAÇÕES -->
  ${q.observations ? `
  <div class="obs-section">
    <div class="obs-card">
      <div class="card-title">OBSERVAÇÕES</div>
      <p class="obs-text">${q.observations}</p>
      <div class="signature-line">Assinatura / Carimbo do Cliente</div>
    </div>
  </div>` : `
  <div class="obs-section">
    <div class="obs-card">
      <div class="card-title">OBSERVAÇÕES</div>
      <p class="obs-text">Este orçamento foi elaborado com base nas informações fornecidas pelo cliente e pode ser ajustado conforme novas necessidades. Estamos à disposição para esclarecer quaisquer dúvidas.</p>
      <div class="signature-line">Assinatura / Carimbo do Cliente</div>
    </div>
  </div>`}

  <!-- FOOTER -->
  <div class="footer">
    <div>
      <div class="footer-logo">VGON</div>
      <div class="footer-logo-sub">SOLUÇÕES EM TI</div>
    </div>
    <div class="footer-info">
      <span>douglas.oliveira@vgon.com.br</span>
      <span>www.vgon.com.br</span>
      <span>Contagem/MG</span>
    </div>
  </div>
</div>
</body></html>`;
  }
}
