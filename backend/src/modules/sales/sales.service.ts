import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, QueryRunner } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { Commission } from '../commissions/entities/commission.entity';
import { CommissionStatus } from '../../common/enums/commission-status.enum';
import { FinancialTask } from '../financial-tasks/entities/financial-task.entity';
import { MailService } from '../mail/mail.service';
import { FinancialService } from '../financial/financial.service';
import { User } from '../users/entities/user.entity';
import { InterService } from '../inter/inter.service';
import { NfeService } from '../fiscal/services/nfe.service';
import { NfseService } from '../fiscal/services/nfse.service';
import { DanfePdfService } from '../fiscal/services/danfe-pdf.service';
import { AuditService } from '../audit/audit.service';
import { SaleEvent } from './entities/sale-event.entity';
import { SaleAttachment } from './entities/sale-attachment.entity';
import { money, moneySum, moneyMultiply } from '../../common/money';
import { getCustomerEmailRecipients } from '../../common/customer-emails';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { todayInBrasilia } from '../../common/date';
import { createHash } from 'crypto';
import { Invoice } from '../fiscal/entities/invoice.entity';
import { FiscalReissueService } from '../fiscal/services/fiscal-reissue.service';
import { AccountReceivable } from '../financial/entities/account-receivable.entity';
import { Installment } from '../financial/entities/installment.entity';
import { normalizeSaleEdit, saleEditPlan } from './sale-edit-plan';

type MailAttachment = { filename: string; content: Buffer; contentType: string };

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemsRepository: Repository<SaleItem>,
    @InjectRepository(SaleEvent)
    private saleEventRepository: Repository<SaleEvent>,
    @InjectRepository(SaleAttachment)
    private saleAttachmentRepository: Repository<SaleAttachment>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private stockMovementsRepository: Repository<StockMovement>,
    @InjectRepository(Commission)
    private commissionsRepository: Repository<Commission>,
    private dataSource: DataSource,
    private mailService: MailService,
    private financialService: FinancialService,
    private interService: InterService,
    private nfeService: NfeService,
    private nfseService: NfseService,
    private danfePdfService: DanfePdfService,
    private auditService: AuditService,
    private whatsappService: WhatsappService,
    private tenantContext: TenantContextService,
    private fiscalReissue: FiscalReissueService,
  ) {}

  async create(createSaleDto: any, userId?: string): Promise<Sale> {
    const today = new Date(); const todayLocal = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    if (createSaleDto.dueDate && createSaleDto.dueDate < todayLocal) throw new BadRequestException('Vencimento da venda não pode estar no passado');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { items, alreadyPaid = false, ...saleData } = createSaleDto;
      const tenantId = this.tenantContext.getTenantId();
      if (tenantId) saleData.tenantId = tenantId;
      if (alreadyPaid) {
        saleData.status = 'pago';
        saleData.paymentStatus = 'pago';
        saleData.billingStatus = 'pago';
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequestException('Adicione pelo menos um item à venda');
      }

      const requestedStock = new Map<string, number>();
      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException(`Quantidade inválida para o item ${item.name || item.productId || item.serviceId}`);
        }
        if (item.productId) {
          requestedStock.set(item.productId, (requestedStock.get(item.productId) || 0) + quantity);
        }
      }

      const normalizedItems = items.map((item: any) => {
        const unitPrice = money(item.unitPrice);
        const totalPrice = moneyMultiply(unitPrice, item.quantity);
        return { ...item, unitPrice, totalPrice };
      });
      const subtotal = moneySum(normalizedItems.map((item: any) => item.totalPrice));
      const discountAmount = money(saleData.discountAmount ?? saleData.discountValue ?? 0);
      const taxAmount = moneySum(normalizedItems.map((item: any) => moneyMultiply(item.totalPrice, Number(item.taxPercentage || 0) / 100)));
      saleData.subtotal = subtotal;
      saleData.discountAmount = discountAmount;
      saleData.taxAmount = taxAmount;
      saleData.totalAmount = money(subtotal - discountAmount);
      saleData.commissionAmount = moneyMultiply(saleData.totalAmount, Number(saleData.commissionPercentage || 0) / 100);
      const totalCost = moneySum(normalizedItems.map((item: any) => moneyMultiply(Number(item.costPrice || 0), Number(item.quantity || 0))));
      saleData.netProfit = money(saleData.totalAmount - totalCost - taxAmount - saleData.commissionAmount);

      // Criar venda e itens dentro da mesma transação do estoque.
      const sale = queryRunner.manager.create(Sale, saleData);
      const savedSale = await queryRunner.manager.save(Sale, sale);

      for (const item of normalizedItems) {
        const saleItem = queryRunner.manager.create(SaleItem, {
          ...item,
          quantity: Number(item.quantity),
          saleId: savedSale.id,
        });
        await queryRunner.manager.save(SaleItem, saleItem);
      }

      // Bloquear os produtos sempre na mesma ordem evita venda concorrente e reduz risco de deadlock.
      for (const productId of Array.from(requestedStock.keys()).sort()) {
        const requestedQuantity = requestedStock.get(productId)!;
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new BadRequestException(`Produto ${productId} não encontrado`);
        }

        const previousQuantity = Number(product.quantity);
        if (previousQuantity < requestedQuantity) {
          throw new BadRequestException(
            `Estoque insuficiente para ${product.name}. Disponível: ${previousQuantity}; solicitado: ${requestedQuantity}`,
          );
        }

        const newQuantity = previousQuantity - requestedQuantity;
        await queryRunner.manager.update(Product, product.id, { quantity: newQuantity });

        const movement = queryRunner.manager.create(StockMovement, {
          productId: product.id,
          type: StockMovementType.VENDA,
          quantity: requestedQuantity,
          previousQuantity,
          newQuantity,
          reason: `Venda #${savedSale.id}`,
          userId: saleData.technicianId,
          saleId: savedSale.id,
        });
        await queryRunner.manager.save(StockMovement, movement);
      }

      // Criar comissão automática
      if (saleData.commissionAmount > 0) {
        const commission = queryRunner.manager.create(Commission, {
          technicianId: saleData.technicianId,
          type: 'venda',
          saleId: savedSale.id,
          description: `Comissão de venda`,
          baseValue: saleData.totalAmount,
          percentage: saleData.commissionPercentage || 5,
          amount: saleData.commissionAmount,
          status: 'pendente',
        } as any);
        await queryRunner.manager.save(Commission, commission);
      }

      // Criar pendencias financeiras (NF e boleto)
      const nfTask = queryRunner.manager.create(FinancialTask, {
        saleId: savedSale.id,
        type: 'emissao_nf',
        dueDate: new Date().toISOString().split('T')[0],
      });
      await queryRunner.manager.save(FinancialTask, nfTask);

      if (saleData.paymentMethod === 'boleto' && !alreadyPaid) {
        const boletoTask = queryRunner.manager.create(FinancialTask, {
          saleId: savedSale.id,
          type: 'emissao_boleto',
          dueDate: new Date().toISOString().split('T')[0],
        });
        await queryRunner.manager.save(FinancialTask, boletoTask);
      }

      // A venda e seus registros financeiros devem confirmar ou falhar juntos.
      await this.financialService.createFromSale(savedSale, userId || saleData.technicianId, queryRunner.manager);

      await queryRunner.commitTransaction();

      // Notificar financeiro por email
      try {
        const financeiros = await this.dataSource.getRepository(User).find({ where: { role: 'financeiro' as any, active: true } });
        const customer = await this.dataSource.getRepository('customers').findOne({ where: { id: saleData.customerId } }) as any;
        const technician = await this.dataSource.getRepository(User).findOne({ where: { id: saleData.technicianId } });
        const paymentLabels: Record<string, string> = { dinheiro: 'Dinheiro', cartao_credito: 'Cartao Credito', cartao_debito: 'Cartao Debito', pix: 'PIX', transferencia: 'Transferencia', boleto: 'Boleto' };
        for (const fin of financeiros) {
          await this.mailService.sendSaleNotification(fin.email, {
            customerName: customer?.name || 'Cliente',
            totalAmount: Number(saleData.totalAmount),
            technicianName: technician?.name || 'Tecnico',
            paymentMethod: paymentLabels[saleData.paymentMethod] || saleData.paymentMethod,
          });
        }
      } catch { /* nao bloquear venda se email falhar */ }

      const created = await this.findOne(savedSale.id);
      await this.auditService.safeCreate({
        userId,
        action: 'sale.created',
        entity: 'sale',
        entityId: savedSale.id,
        newData: {
          saleId: savedSale.id,
          customerId: saleData.customerId,
          totalAmount: saleData.totalAmount,
          paymentMethod: saleData.paymentMethod,
          items,
        },
      });
      await this.addEvent(savedSale.id, 'sale.created', savedSale.status as any, 'Venda criada', userId, {
        totalAmount: saleData.totalAmount,
        paymentMethod: saleData.paymentMethod,
      });
      return created;
    } catch (err) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(page?: number, limit?: number, requesterId?: string, requesterRole?: string): Promise<Sale[] | { data: Sale[]; total: number; page: number; limit: number }> {
    const qb = this.salesRepository.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.technician', 'technician').leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.items', 'items').leftJoinAndSelect('sale.events', 'events').leftJoinAndSelect('sale.attachments', 'attachments')
      .where('sale.archivedAt IS NULL').orderBy('sale.createdAt', 'DESC');
    // Escopado pelo tenant da requisição atual quando existe um - sem isso, um usuário de
    // QUALQUER empresa listava as vendas de todas as outras empresas do sistema.
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('sale.tenantId = :tenantId', { tenantId });
    // Técnicos só enxergam as próprias vendas (e o próprio netProfit/comissão), não as de toda a empresa.
    if (requesterRole === 'tecnico' && requesterId) {
      qb.andWhere('sale.technicianId = :requesterId', { requesterId });
    }
    if (!page && !limit) {
      const data = await qb.take(500).getMany();
      await this.applyEffectiveBillingStatus(data);
      return data;
    }
    const safePage = Math.max(Number(page) || 1, 1); const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const [data, total] = await qb.skip((safePage - 1) * safeLimit).take(safeLimit).getManyAndCount();
    await this.applyEffectiveBillingStatus(data);
    return { data, total, page: safePage, limit: safeLimit };
  }
  private async applyEffectiveBillingStatus(sales: Sale[]): Promise<void> {
    const ids = sales.map(sale => sale.id);
    if (!ids.length) return;

    // Check which sales have boleto emitted
    const rows = await this.dataSource.query(
      `SELECT DISTINCT sale_id FROM payments
       WHERE sale_id = ANY($1::uuid[]) AND type = 'boleto'
         AND status NOT IN ('cancelado', 'cancelada', 'rejeitado')`,
      [ids],
    );
    const withBoleto = new Set(rows.map((row: any) => row.sale_id));

    // Próximo vencimento EM ABERTO de cada venda = o menor vencimento entre os boletos/PIX a receber e as
    // parcelas pendentes. Antes usava o vencimento da própria venda (data da 1ª parcela/original), então
    // venda com a 1ª parcela já paga, ou boleto reemitido com nova data, aparecia como inadimplente
    // mesmo com o vencimento em dia.
    const dueDates = await this.dataSource.query(
      `SELECT sale_id, MIN(due_date)::text as earliest_due
       FROM payments
       WHERE sale_id = ANY($1::uuid[])
         AND type IN ('boleto', 'pix')
         AND status IN ('a_receber', 'vencido')
       GROUP BY sale_id`,
      [ids],
    );
    const installDueDates = await this.dataSource.query(
      `SELECT sale_id, MIN(due_date)::text as earliest_due
       FROM installments
       WHERE sale_id::uuid = ANY($1::uuid[])
         AND status IN ('pendente', 'vencido')
       GROUP BY sale_id`,
      [ids],
    );
    const dayOf = (value: any): string | null => (value ? String(value).split('T')[0] : null);
    const dueDateMap = new Map<string, string>();
    for (const r of [...dueDates, ...installDueDates]) {
      const day = dayOf(r.earliest_due);
      if (!day) continue;
      const current = dueDateMap.get(r.sale_id);
      if (!current || day < current) dueDateMap.set(r.sale_id, day);
    }

    const today = todayInBrasilia();

    for (const sale of sales) {
      if (withBoleto.has(sale.id) && !['pago', 'vencido'].includes(sale.billingStatus)) {
        sale.billingStatus = 'emitido';
      }

      const nextDue = dueDateMap.get(sale.id) || null;
      // Vencimento a exibir/avaliar: o do próximo item em aberto; sem cobrança em aberto, o da venda.
      (sale as any).nextDueDate = nextDue || dayOf(sale.dueDate);
      if (nextDue && !sale.dueDate) sale.dueDate = nextDue;

      // Inadimplente = existe cobrança em aberto E o vencimento dela já passou (hoje ainda é em dia).
      if (!['pago', 'cancelado'].includes(sale.billingStatus) && !['pago', 'finalizado', 'cancelado'].includes(sale.status)) {
        const effectiveDue = (sale as any).nextDueDate as string | null;
        if (effectiveDue && effectiveDue < today && (sale.billingStatus === 'emitido' || withBoleto.has(sale.id))) {
          (sale as any).paymentStatus = 'inadimplente';
        } else if ((sale as any).paymentStatus === 'inadimplente') {
          // Estava gravado como inadimplente, mas o vencimento em aberto está em dia (ex.: boleto reemitido).
          (sale as any).paymentStatus = 'pendente';
        }
      }
    }
  }

  /**
   * Get the last price a product or service was sold at.
   */
  async getLastSalePrice(type: 'product' | 'service', itemId: string): Promise<{ lastPrice: number | null; lastDate: string | null; customerName: string | null }> {
    const column = type === 'product' ? 'product_id' : 'service_id';
    const result = await this.dataSource.query(
      `SELECT si.unit_price, s.created_at, c.name as customer_name
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE si.${column} = $1 AND s.status != 'cancelado'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [itemId],
    );

    if (result.length === 0) {
      return { lastPrice: null, lastDate: null, customerName: null };
    }

    return {
      lastPrice: Number(result[0].unit_price),
      lastDate: result[0].created_at ? new Date(result[0].created_at).toISOString() : null,
      customerName: result[0].customer_name || null,
    };
  }

  async findOne(id: string, requesterId?: string, requesterRole?: string): Promise<Sale> {
    // Escopado pelo tenant da requisição atual quando existe um - sem isso, qualquer usuário
    // autenticado (de qualquer empresa) conseguia ler/editar a venda de outra empresa só sabendo
    // o id (usado por praticamente toda ação de venda: aprovar, cancelar, pagar, gerar boleto...).
    const tenantId = this.tenantContext.getTenantId();
    const sale = await this.salesRepository.findOne({
      where: tenantId ? { id, tenantId } : { id },
      relations: ['technician', 'customer', 'items'],
    });

    if (!sale) throw new NotFoundException('Venda não encontrada');
    // Só é aplicado quando o chamador informa quem está pedindo (endpoints de leitura expostos ao técnico);
    // chamadas internas (approve/cancel/markPaid etc.) não passam requesterRole e continuam sem restrição.
    if (requesterRole === 'tecnico' && requesterId && sale.technicianId !== requesterId) {
      throw new ForbiddenException('Você não tem acesso a esta venda');
    }
    const activeBoleto = await this.dataSource.query(
      `SELECT id, codigo_solicitacao, value, due_date
       FROM payments
       WHERE sale_id = $1 AND type = 'boleto'
         AND status IN ('pendente', 'a_receber', 'vencido')
       ORDER BY due_date ASC, created_at DESC LIMIT 1`,
      [id],
    );
    (sale as any).activeBoleto = activeBoleto[0] || null;
    const invoices = await this.dataSource.query(
      "SELECT id FROM invoices WHERE sale_id = $1 AND status = 'autorizada'", [id],
    );
    (sale as any).authorizedInvoiceIds = invoices.map((invoice: { id: string }) => invoice.id);
    const pendingEdit = await this.saleEventRepository.findOne({
      where: { saleId: id, type: 'sale.documents_edit', status: 'pendente' }, order: { createdAt: 'DESC' },
    });
    if (pendingEdit) (sale as any).pendingDocumentEdit = {
      input: pendingEdit.metadata.input, action: pendingEdit.metadata.plan.action,
      requestId: pendingEdit.metadata.requestId, error: pendingEdit.metadata.lastError,
    };
    return sale;
  }

  async approve(id: string, userId: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (sale.status !== 'pendente') {
      throw new BadRequestException('Apenas vendas pendentes podem ter NF emitida');
    }
    sale.status = 'nf_emitida' as any;
    sale.operationalStatus = 'aprovada';
    sale.fiscalStatus = 'pendente';
    sale.approvedBy = userId as any;
    sale.approvedAt = new Date();
    const saved = await this.salesRepository.save(sale);

    await this.addEvent(id, 'sale.approved_for_invoicing', saved.status as any, 'Venda aprovada para emissão fiscal', userId);
    return saved;
  }

  async markBoletoEmitido(id: string, userId: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (!['pendente', 'nf_emitida'].includes(sale.status as string)) {
      throw new BadRequestException('Esta venda nao pode ter boleto emitido neste status');
    }
    sale.status = 'boleto_emitido' as any;
    sale.billingStatus = 'emitido';
    const saved = await this.salesRepository.save(sale);

    // Concluir pendencia de boleto
    await this.dataSource.query(
      "UPDATE financial_tasks SET status = 'concluido', completed_by = $1, completed_at = NOW() WHERE sale_id = $2 AND type = 'emissao_boleto' AND status = 'pendente'",
      [userId, id]
    );

    return saved;
  }

  async markPaid(id: string, userId: string, data: { paymentMethod: string; paidAt: string; bankAccountId?: string }, idempotencyKey?: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (['cancelado', 'finalizado'].includes(sale.status as string)) throw new BadRequestException('Esta venda não pode receber pagamento');
    if (!idempotencyKey || !data?.paymentMethod || !data?.paidAt) throw new BadRequestException('Forma, data e chave de idempotência são obrigatórias');
    const paidAt = new Date(data.paidAt); if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Data de pagamento inválida');
    await this.financialService.settleSale(id, data.paymentMethod, userId, idempotencyKey, paidAt, data.bankAccountId);
    await this.addEvent(id, 'sale.paid', 'pago' as any, 'Venda e financeiro marcados como pagos', userId);
    return this.findOne(id);
  }
  async finalize(id: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (sale.paymentStatus !== 'pago' && sale.status !== 'pago') {
      throw new BadRequestException('Apenas vendas pagas podem ser finalizadas');
    }
    sale.status = 'finalizado' as any;
    sale.operationalStatus = 'finalizada';
    return this.salesRepository.save(sale);
  }

  async cancel(id: string, cancelledBy: string): Promise<Sale> {
    const preflightSale = await this.salesRepository.findOne({ where: { id } });
    if (!preflightSale) throw new NotFoundException('Venda não encontrada');
    if (preflightSale.status === 'finalizado' as any) throw new BadRequestException('Venda finalizada não pode ser cancelada');

    const paidCommissionBeforeCancellation = await this.commissionsRepository.findOne({
      where: { saleId: id, status: CommissionStatus.PAGA },
    });
    if (paidCommissionBeforeCancellation) {
      throw new BadRequestException('A comissão desta venda já foi paga. Reverta o pagamento da comissão antes de cancelar a venda.');
    }

    const externalDocumentsCancelled = preflightSale.status !== 'cancelado' as any;
    if (externalDocumentsCancelled) await this.cancelExternalDocuments(id, cancelledBy);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = await queryRunner.manager.findOne(Sale, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sale) throw new NotFoundException('Venda não encontrada');
      if (sale.status === 'finalizado' as any) {
        throw new BadRequestException('Venda finalizada não pode ser cancelada');
      }

      const oldStatus = sale.status;

      const paidCommission = await queryRunner.manager.findOne(Commission, {
        where: { saleId: id, status: CommissionStatus.PAGA },
      });
      if (paidCommission) {
        throw new BadRequestException('A comissão desta venda já foi paga. Reverta o pagamento da comissão antes de cancelar a venda.');
      }


      const previousReversal = await queryRunner.manager.findOne(StockMovement, {
        where: { saleId: id, type: StockMovementType.ESTORNO, reason: `Estorno da venda #${id}` },
      });

      if (!previousReversal) {
        const saleMovements = await queryRunner.manager.find(StockMovement, {
          where: { saleId: id, type: StockMovementType.VENDA },
          order: { productId: 'ASC' },
        });

        const editReturns = await queryRunner.manager.find(StockMovement, {
          where: { saleId: id, type: StockMovementType.ESTORNO, reason: 'Ajuste dos itens na edição da venda' },
        });
        const quantities = new Map<string, number>();
        for (const movement of saleMovements) quantities.set(movement.productId, (quantities.get(movement.productId) || 0) + Number(movement.quantity));
        for (const movement of editReturns) quantities.set(movement.productId, (quantities.get(movement.productId) || 0) - Number(movement.quantity));
        for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          if (quantity <= 0) continue;
          const product = await queryRunner.manager.findOne(Product, {
            where: { id: productId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!product) {
            throw new BadRequestException(`Produto ${productId} não encontrado para estorno do estoque`);
          }

          const previousQuantity = Number(product.quantity);
          const newQuantity = previousQuantity + quantity;
          await queryRunner.manager.update(Product, product.id, { quantity: newQuantity });

          const reversal = queryRunner.manager.create(StockMovement, {
            productId: product.id,
            type: StockMovementType.ESTORNO,
            quantity,
            previousQuantity,
            newQuantity,
            reason: `Estorno da venda #${id}`,
            userId: cancelledBy,
            saleId: id,
          });
          await queryRunner.manager.save(StockMovement, reversal);
        }
      }

      sale.status = 'cancelado' as any;
      sale.operationalStatus = 'cancelada';
      sale.billingStatus = 'cancelado';
      if (sale.fiscalStatus === 'autorizada') sale.fiscalStatus = 'cancelada';
      await queryRunner.manager.save(Sale, sale);

      await queryRunner.manager.update(
        Commission,
        { saleId: id, status: In([CommissionStatus.PENDENTE, CommissionStatus.APROVADA]) },
        { status: CommissionStatus.CANCELADA },
      );

      await queryRunner.manager.query(
        `UPDATE financial_tasks
         SET status = 'cancelado', completed_by = NULL, completed_at = NULL,
             observations = CONCAT_WS(E'\n', NULLIF(observations, ''), 'Cancelada automaticamente com a venda')
         WHERE sale_id = $1 AND status != 'cancelado'`,
        [id],
      );
      await queryRunner.manager.query(
        `UPDATE accounts_receivable
         SET status = 'cancelado', canceled_at = NOW(), cancel_reason = 'Venda cancelada'
         WHERE sale_id = $1 AND status != 'cancelado'`,
        [id],
      );
      await queryRunner.manager.query(
        `UPDATE installments SET status = 'cancelado'
         WHERE sale_id = $1 AND status != 'pago'`,
        [id],
      );

      await queryRunner.commitTransaction();
      await this.auditService.safeCreate({
        userId: cancelledBy,
        action: 'sale.cancelled',
        entity: 'sale',
        entityId: id,
        oldData: { status: oldStatus },
        newData: {
          status: 'cancelado',
          externalDocumentsCancelled,
          stockReverted: !previousReversal,
        },
      });
      await this.addEvent(id, 'sale.cancelled', 'cancelado', 'Venda cancelada', cancelledBy, {
        externalDocumentsCancelled,
        stockReverted: !previousReversal,
      });
      return this.findOne(id);
    } catch (error) {
      if (queryRunner.isTransactionActive && !queryRunner.isReleased) {
        try {
          await queryRunner.rollbackTransaction();
        } catch {}
      }
      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }
  /**
   * Busca as notas fiscais autorizadas e os boletos em aberto de uma venda, prontos
   * para anexar - reaproveitado pelo envio por email e pelo envio por WhatsApp.
   */
  private async gatherSaleDocuments(id: string): Promise<{ sale: any; customer: any; attachments: MailAttachment[]; attachmentNames: string[]; pendingInvoiceWarning?: string }> {
    const sale = await this.findOne(id);
    const customer = sale.customer as any;

    const attachments: MailAttachment[] = [];
    const attachmentNames: string[] = [];

    const invoices = await this.dataSource.query(
      `SELECT id, type, number, series, access_key, certificate_id, xml_authorized, xml_sent, total_value
       FROM invoices
       WHERE sale_id = $1 AND status = 'autorizada'
       ORDER BY issued_at DESC NULLS LAST, created_at DESC`,
      [id],
    );

    // Se existe nota fiscal para a venda mas nenhuma está autorizada ainda (ainda processando/rejeitada),
    // o loop abaixo não anexa nada e isso passava batido - o email saía só com o boleto, sem log nenhum.
    let pendingInvoiceWarning: string | undefined;
    if (invoices.length === 0) {
      const pending = await this.dataSource.query(
        `SELECT type, number, status FROM invoices WHERE sale_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [id],
      );
      if (pending[0]) {
        pendingInvoiceWarning = `Nota fiscal (${pending[0].type}) ainda não autorizada (status: ${pending[0].status}) - email seguirá sem XML/PDF da nota`;
        this.logger.warn(`Venda ${id}: ${pendingInvoiceWarning}`);
      }
    }

    for (const invoice of invoices) {
      const label = invoice.type === 'nfse' ? 'NFSe' : 'NFe';
      const number = invoice.number || 'nota';
      const xml = invoice.xml_authorized || invoice.xml_sent;

      if (xml) {
        const filename = `${label}_${number}_serie${invoice.series || 1}.xml`;
        attachments.push({
          filename,
          content: Buffer.from(xml, 'utf-8'),
          contentType: 'application/xml',
        });
        attachmentNames.push(filename);
      }

      if (invoice.type === 'nfe') {
        try {
          const pdf = await this.danfePdfService.generate(invoice.id);
          const filename = `DANFE_${number}_serie${invoice.series || 1}.pdf`;
          attachments.push({ filename, content: pdf, contentType: 'application/pdf' });
          attachmentNames.push(filename);
        } catch (error: any) {
          throw new BadRequestException('Não foi possível gerar o DANFE da NF-e ' + number + ': ' + (error?.message || 'erro desconhecido'));
        }
      }
      if (invoice.type === 'nfse' && invoice.access_key && invoice.certificate_id) {
        try {
          const pdf = await this.nfseService.downloadPdf(invoice.access_key, invoice.certificate_id);
          const filename = `NFSe_${number}_serie${invoice.series || 1}.pdf`;
          attachments.push({ filename, content: pdf, contentType: 'application/pdf' });
          attachmentNames.push(filename);
        } catch (error: any) {
          throw new BadRequestException('Não foi possível obter o PDF da NFS-e ' + number + ': ' + (error?.message || 'erro desconhecido'));
        }
      }
    }

    const payments = await this.dataSource.query(
      `SELECT codigo_solicitacao, value, due_date FROM payments
       WHERE sale_id=$1 AND type='boleto' AND status!='cancelado'
       ORDER BY due_date, created_at`, [id]);
    for (let index = 0; index < payments.length; index++) {
      const payment = payments[index];
      if (!payment.codigo_solicitacao) continue;
      try {
        const pdf = await this.interService.getBoletoPdf(payment.codigo_solicitacao);
        const label = payments.length > 1 ? `-parcela-${index + 1}-de-${payments.length}` : '';
        const filename = `boleto${label}-${payment.codigo_solicitacao.substring(0, 8)}.pdf`;
        attachments.push({ filename, content: pdf, contentType: 'application/pdf' });
        attachmentNames.push(filename);
      } catch (error: any) {
        throw new BadRequestException(`Não foi possível obter o PDF do boleto ${index + 1}/${payments.length}: ` + (error?.message || 'erro desconhecido'));
      }
    }

    return { sale, customer, attachments, attachmentNames, pendingInvoiceWarning };
  }

  async sendCustomerDocuments(id: string, customBody?: string): Promise<{ success: boolean; sent: boolean; attachments: string[]; warning?: string }> {
    const { sale, customer, attachments, attachmentNames, pendingInvoiceWarning } = await this.gatherSaleDocuments(id);

    const customerEmails = getCustomerEmailRecipients(customer);
    if (!customerEmails) {
      throw new BadRequestException('Cliente sem email cadastrado');
    }
    if (attachments.length === 0) {
      throw new BadRequestException('Nenhum boleto ou nota fiscal autorizada encontrada para envio');
    }

    const bodyHtml = customBody
      ? customBody.replace(/\n/g, '<br>')
      : `Segue em anexo a documentacao da venda #${sale.id.substring(0, 8)}.`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Documentos da Venda</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="color: #4b5563; white-space: pre-line; margin-bottom: 20px;">${bodyHtml}</div>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; color: #6b7280;">Valor:</td><td style="padding: 8px; font-weight: bold; color: #059669;">R$ ${Number(sale.totalAmount).toFixed(2)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Cliente:</td><td style="padding: 8px;">${customer.name || ''}</td></tr>
            ${sale.observations ? `<tr><td style="padding: 8px; color: #6b7280; vertical-align: top;">Descrição:</td><td style="padding: 8px; white-space: pre-line;">${sale.observations}</td></tr>` : ''}
          </table>
          ${sale.items?.length ? `
          <p style="color: #4b5563;">Itens da venda:</p>
          <ul style="color: #4b5563;">${sale.items.map((item: any) => `<li>${item.quantity}x ${item.name} — R$ ${Number(item.totalPrice).toFixed(2)}</li>`).join('')}</ul>
          ` : ''}
          <p style="color: #4b5563;">Arquivos enviados:</p>
          <ul style="color: #4b5563;">${attachmentNames.map(name => `<li>${name}</li>`).join('')}</ul>
          ${pendingInvoiceWarning ? '<p style="color:#b45309;font-size:13px;">A nota fiscal ainda está em processamento e será enviada assim que autorizada.</p>' : ''}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Solucoes em Informatica</p>
        </div>
      </div>
    `;

    const sent = await this.mailService.sendMailWithAttachment(
      customerEmails,
      `Documentos da venda #${sale.id.substring(0, 8)} - VGON`,
      html,
      attachments,
    );

    if (!sent) {
      throw new BadRequestException('Falha ao enviar email para o cliente');
    }

    return { success: true, sent, attachments: attachmentNames, warning: pendingInvoiceWarning };
  }

  async sendCustomerDocumentsWhatsapp(id: string, phone?: string): Promise<{ success: boolean; sent: boolean; attachments: string[]; warning?: string }> {
    const { sale, customer, attachments, attachmentNames, pendingInvoiceWarning } = await this.gatherSaleDocuments(id);

    const targetPhone = (phone || customer?.phone || '').trim();
    if (!targetPhone) {
      throw new BadRequestException('Informe um número de WhatsApp (o cliente não tem telefone cadastrado)');
    }
    if (attachments.length === 0) {
      throw new BadRequestException('Nenhum boleto ou nota fiscal autorizada encontrada para envio');
    }

    let sent = await this.whatsappService.sendText(
      targetPhone,
      `Olá! Segue a nota fiscal e o boleto referentes à venda #${sale.id.substring(0, 8)}.`,
      { relatedEntity: 'sale', relatedId: sale.id },
    );
    for (const attachment of attachments) {
      const ok = await this.whatsappService.sendMedia(
        targetPhone,
        attachment.content,
        attachment.contentType,
        attachment.filename,
        '',
        { relatedEntity: 'sale', relatedId: sale.id },
      );
      sent = sent && ok;
    }

    if (!sent) {
      throw new BadRequestException('Falha ao enviar pelo WhatsApp - verifique a conexão em Configurações > WhatsApp');
    }

    return { success: true, sent, attachments: attachmentNames, warning: pendingInvoiceWarning };
  }

  private async cancelExternalDocuments(saleId: string, userId?: string): Promise<void> {
    const reason = `Cancelamento da venda ${saleId.substring(0, 8)}`;

    await this.interService.cancelPaymentsForSale(saleId, 'ACERTOS');

    const invoices = await this.dataSource.query(
      `SELECT id, type, certificate_id
       FROM invoices
       WHERE sale_id = $1 AND status = 'autorizada'`,
      [saleId],
    );

    for (const invoice of invoices) {
      await this.cancelAuthorizedInvoice(invoice, reason, userId);
    }
  }

  async replaceIssuedSale(): Promise<never> {
    throw new BadRequestException('Atualize a página e salve a edição na mesma venda. A criação de venda substituta foi removida.');
  }

  private async cancelAuthorizedInvoice(invoice: { id: string; type: string; certificate_id: string | null }, reason: string, userId?: string) {
    if (!invoice.certificate_id) throw new BadRequestException('Nota fiscal sem certificado vinculado para cancelamento.');
    if (invoice.type === 'nfse') await this.nfseService.cancel(invoice.id, reason, invoice.certificate_id, userId);
    else await this.nfeService.cancel(invoice.id, reason, invoice.certificate_id, userId);
    await this.dataSource.getRepository(Invoice).update(invoice.id, { queueStatus: 'processado', nextRetryAt: null });
  }

  async update(id: string, changes: any, userId?: string, userRole?: string): Promise<Sale> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    let locked = false;
    let operation: SaleEvent | null = null;
    try {
      const [lock] = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`sale-edit:${id}`]);
      locked = Boolean(lock.locked);
      if (!locked) throw new BadRequestException('Esta venda já está sendo atualizada. Aguarde a conclusão.');
      const sale = await this.findOne(id, userId, userRole);
      if (['cancelado', 'finalizado'].includes(sale.status)) throw new BadRequestException('Venda cancelada ou finalizada não pode ser editada.');
      let input: ReturnType<typeof normalizeSaleEdit>;
      const effectiveDueDate = (sale as any).activeBoleto?.due_date
        ? String((sale as any).activeBoleto.due_date).slice(0, 10) : sale.dueDate;
      try { input = normalizeSaleEdit({ ...sale, dueDate: effectiveDueDate }, changes); }
      catch (error) { throw new BadRequestException(error.message); }
      if (input.technicianId !== sale.technicianId && userRole !== 'admin') {
        throw new ForbiddenException('Somente administradores podem alterar o vendedor.');
      }
      if (!Number.isInteger(input.installments) || input.installments < 1 || input.installments > 120 ||
          !['boleto', 'pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'transferencia'].includes(input.paymentMethod) ||
          ![input.multaPercentage, input.moraPercentage].every(value => Number.isFinite(value) && value >= 0)) {
        throw new BadRequestException('Forma de pagamento, parcelamento, multa ou juros inválidos.');
      }
      const hash = createHash('sha256').update(JSON.stringify({ input, alreadyPaid: Boolean(changes.alreadyPaid) })).digest('hex');
      operation = await this.saleEventRepository.findOne({
        where: { saleId: id, type: 'sale.documents_edit', status: 'pendente' }, order: { createdAt: 'DESC' },
      });
      if (operation && operation.metadata.hash !== hash) {
        throw new BadRequestException('Há uma troca de documentos incompleta nesta venda. Recarregue a edição para retomar os mesmos dados antes de fazer outra alteração.');
      }
      if (!operation && changes.editRequestId) {
        const completed = await this.saleEventRepository.createQueryBuilder('event')
          .where('event.saleId = :id', { id }).andWhere('event.type = :type', { type: 'sale.documents_edit' })
          .andWhere("event.metadata ->> 'requestId' = :requestId", { requestId: changes.editRequestId }).getOne();
        if (completed) {
          if (completed.metadata.hash !== hash) throw new BadRequestException('Recarregue a venda antes de fazer outra edição.');
          return this.findOne(id);
        }
      }
      const boletos = await runner.query(
        `SELECT id, codigo_solicitacao FROM payments WHERE sale_id=$1 AND type='boleto'
         AND status IN ('pendente','a_receber','vencido')`, [id],
      );
      const invoices = await runner.manager.find(Invoice, { where: { saleId: id, status: 'autorizada' } });
      const before = { ...sale, dueDate: changes.dueDate === undefined ? input.dueDate : sale.dueDate };
      // Vendas antigas podem ter o vencimento atualizado só no boleto.
      if ((sale as any).activeBoleto?.due_date) before.dueDate = String((sale as any).activeBoleto.due_date).slice(0, 10);
      const plan = operation?.metadata.plan ?? saleEditPlan(before, input, boletos.length > 0, invoices.length > 0);
      if (!operation && changes.expectedUpdatedAt && new Date(changes.expectedUpdatedAt).getTime() !== new Date(sale.updatedAt).getTime()) {
        throw new BadRequestException('A venda foi alterada por outra operação. Recarregue antes de salvar.');
      }
      const affectsFinance = plan.financialChanged || plan.dateChanged;
      if (affectsFinance || plan.action !== 'none') {
        const [received] = await runner.query(
          `SELECT EXISTS (SELECT 1 FROM installments WHERE sale_id::text=$1 AND (paid_value>0 OR status='pago'))
           OR EXISTS (SELECT 1 FROM payments WHERE sale_id::text=$1 AND status='pago') AS paid`, [id],
        );
        if (received.paid || sale.paymentStatus === 'pago' || changes.alreadyPaid) {
          throw new BadRequestException('Esta venda possui recebimento. Reverta o recebimento no financeiro antes de alterar os documentos.');
        }
        if (input.paymentMethod === 'boleto') {
          const parsed = typeof input.dueDate === 'string' ? new Date(input.dueDate + 'T00:00:00Z') : null;
          if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.dueDate || input.dueDate < todayInBrasilia()) {
            throw new BadRequestException('Escolha uma data de vencimento válida a partir de hoje.');
          }
        }
      }
      if (plan.fiscalChanged && await runner.manager.findOne(Commission, { where: { saleId: id, status: CommissionStatus.PAGA } })) {
        throw new BadRequestException('Reverta a comissão paga antes de alterar valor, itens ou parcelamento.');
      }
      if (plan.action !== 'none' && !operation) {
        if (changes.confirmDocumentAction !== plan.action) throw new BadRequestException({
          message: 'Confirme a troca dos documentos antes de salvar.', requiredAction: plan.action,
        });
        if (input.totalAmount <= 0) throw new BadRequestException('A nova cobrança deve ter valor positivo.');
        const customer = await runner.manager.getRepository('customers').findOne({ where: { id: input.customerId } });
        if (!customer) throw new BadRequestException('Cliente não encontrado.');
        if (boletos.length && input.paymentMethod === 'boleto') {
          const document = String(customer['cpfCnpj'] || '').replace(/\D/g, '');
          if (![11, 14].includes(document.length) || !customer['name'] || !customer['address'] ||
              !customer['city'] || !customer['uf'] || !/^\d{8}$/.test(String(customer['cep'] || '').replace(/\D/g, ''))) {
            throw new BadRequestException('Complete CPF/CNPJ, endereço, município, UF e CEP do cliente antes de reemitir.');
          }
        }
        const templates = [];
        if (plan.action === 'documents') {
          for (const invoice of invoices) templates.push({ invoiceId: invoice.id, input: await this.fiscalReissue.prepare(invoice) });
        }
        operation = await this.saleEventRepository.save(this.saleEventRepository.create({
          saleId: id, type: 'sale.documents_edit', status: 'pendente', createdBy: userId,
          description: 'Troca dos documentos na edição da mesma venda',
          metadata: { hash, requestId: changes.editRequestId, input, plan, applied: false,
            boletoCodes: boletos.map(row => row.codigo_solicitacao), templates, replacements: {} },
        }));
      }
      if (!operation) {
        await runner.startTransaction();
        await this.saveSaleEdit(runner, sale, input, plan, userId);
        if (changes.alreadyPaid && sale.paymentStatus !== 'pago') {
          await this.financialService.settleSale(id, input.paymentMethod, userId, `sale-edit-paid:${id}`, new Date(), undefined, runner.manager);
        }
        await runner.commitTransaction();
        await this.auditService.safeCreate({ userId, action: 'sale.updated', entity: 'sale', entityId: id, newData: input });
        return this.findOne(id);
      }

      const state = operation.metadata;
      if (!state.applied) {
        // Autorizações fiscais/bancárias são confirmadas antes de alterar a venda e suas parcelas.
        for (const template of state.templates) {
          const invoice = await runner.manager.findOneByOrFail(Invoice, { id: template.invoiceId });
          if (invoice.status === 'autorizada') {
            await this.cancelAuthorizedInvoice({ id: invoice.id, type: invoice.type, certificate_id: invoice.certificateId },
              'Alteração de valor ou parcelamento da venda', userId);
          } else if (invoice.status !== 'cancelada') {
            throw new BadRequestException('Confira o cancelamento da nota no módulo Fiscal antes de retomar.');
          }
        }
        for (const code of state.boletoCodes) {
          const [payment] = await runner.query('SELECT status FROM payments WHERE codigo_solicitacao=$1 AND sale_id=$2', [code, id]);
          if (payment?.status === 'pago') throw new BadRequestException('O boleto foi pago durante a edição. Confira o financeiro.');
          if (payment?.status !== 'cancelado') await this.interService.cancelBoleto(code, 'ACERTOS');
        }
        await runner.startTransaction();
        await this.saveSaleEdit(runner, sale, state.input, state.plan, userId);
        state.applied = true;
        await runner.manager.save(SaleEvent, operation);
        await runner.commitTransaction();
      }
      // Cada substituto tem identidade própria e está vinculado à mesma venda.
      for (const template of state.templates) {
        let replacement: Invoice;
        if (!state.replacements[template.invoiceId]) {
          const original = await runner.manager.findOneByOrFail(Invoice, { id: template.invoiceId });
          // Recupera o registro caso o processo tenha parado depois de criá-lo.
          replacement = await runner.manager.getRepository(Invoice).createQueryBuilder('invoice')
            .where('invoice.saleId = :id', { id })
            .andWhere("invoice.taxDetails ->> 'replacesInvoiceId' = :original", { original: original.id }).getOne();
          if (!replacement) replacement = await this.fiscalReissue.createReplacement(original, template.input);
          state.replacements[template.invoiceId] = replacement.id;
          await this.saleEventRepository.save(operation);
        } else {
          replacement = await runner.manager.findOneByOrFail(Invoice, { id: state.replacements[template.invoiceId] });
        }
        if (replacement.status !== 'autorizada') {
          if (replacement.status !== 'pendente' || replacement.queueStatus !== 'aguardando_envio') {
            throw new BadRequestException('Venda salva. A nova nota está pendente de autorização ou foi recusada. Confira o módulo Fiscal antes de retomar.');
          }
          replacement.queueStatus = 'enviando_edicao';
          await runner.manager.save(Invoice, replacement);
          await this.fiscalReissue.emitReplacement(replacement);
        }
      }
      if (state.boletoCodes.length && state.input.paymentMethod === 'boleto' && !state.boletoIssued) {
        const result = await this.interService.generateForSale(await this.findOne(id), 'boleto', undefined, operation.id);
        if (result?.puladas?.length) throw new BadRequestException('Venda salva. Confira as parcelas sem boleto e retome a emissão.');
        state.boletoIssued = true;
        await this.saleEventRepository.save(operation);
      }
      if (state.templates.length) {
        await runner.query("UPDATE sales SET fiscal_status='autorizada', updated_at=NOW() WHERE id=$1", [id]);
        await runner.query("UPDATE financial_tasks SET status='concluido', completed_at=NOW() WHERE sale_id=$1 AND type='emissao_nf' AND status='pendente'", [id]);
      }
      operation.status = 'concluido';
      await this.saleEventRepository.save(operation);
      return this.findOne(id);
    } catch (error) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
        if (operation) operation.metadata.applied = false;
      }
      if (operation?.status === 'pendente') {
        operation.metadata.lastError = error.message;
        await this.saleEventRepository.save(operation);
      }
      throw error;
    } finally {
      if (locked) await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [`sale-edit:${id}`]);
      await runner.release();
    }
  }

  private async saveSaleEdit(runner: QueryRunner, sale: Sale, input: ReturnType<typeof normalizeSaleEdit>, plan: ReturnType<typeof saleEditPlan>, userId?: string) {
    const manager = runner.manager;
    const { items, ...values } = input;
    if (plan.itemsChanged) {
      const quantities = (rows: any[]) => {
        const result = new Map<string, number>();
        for (const item of rows) if (item.productId) result.set(item.productId, (result.get(item.productId) || 0) + Number(item.quantity));
        return result;
      };
      const oldQuantities = quantities(sale.items);
      const newQuantities = quantities(items);
      for (const productId of [...new Set([...oldQuantities.keys(), ...newQuantities.keys()])].sort()) {
        const delta = (newQuantities.get(productId) || 0) - (oldQuantities.get(productId) || 0);
        if (!delta) continue;
        const product = await manager.findOne(Product, { where: { id: productId }, lock: { mode: 'pessimistic_write' } });
        if (!product || Number(product.quantity) < delta) throw new BadRequestException('Estoque insuficiente para os itens editados.');
        const previousQuantity = Number(product.quantity);
        await manager.update(Product, productId, { quantity: previousQuantity - delta });
        await manager.save(StockMovement, manager.create(StockMovement, {
          saleId: sale.id, productId, type: delta > 0 ? StockMovementType.VENDA : StockMovementType.ESTORNO,
          quantity: Math.abs(delta), previousQuantity, newQuantity: previousQuantity - delta,
          reason: 'Ajuste dos itens na edição da venda', userId,
        }));
      }
      await manager.delete(SaleItem, { saleId: sale.id });
      await manager.save(SaleItem, items.map(item => manager.create(SaleItem, { ...item, saleId: sale.id })));
    }
    await manager.update(Sale, sale.id, values);
    if (plan.action === 'documents') await manager.update(Sale, sale.id, { fiscalStatus: 'pendente' });
    if (sale.customerId !== input.customerId) {
      await manager.update(AccountReceivable, { saleId: sale.id }, { customerId: input.customerId });
    }
    if (plan.financialChanged || plan.dateChanged) {
      const account = await manager.findOne(AccountReceivable, { where: { saleId: sale.id }, lock: { mode: 'pessimistic_write' } });
      if (!account) throw new BadRequestException('Conta a receber da venda não encontrada.');
      const scheduledSale = Object.assign(new Sale(), sale, values);
      if (plan.financialChanged) {
        await manager.update(Installment, { saleId: sale.id }, { status: 'cancelado' });
        const count = input.installments;
        let distributed = 0;
        for (let number = 1; number <= count; number++) {
          const value = number === count ? money(input.totalAmount - distributed) : Math.floor(input.totalAmount * 100 / count) / 100;
          distributed = money(distributed + value);
          const date = this.financialService.getBoletoDueDate(scheduledSale, new Date(), number);
          await manager.save(Installment, manager.create(Installment, {
            saleId: sale.id, accountId: account.id, number, value, paidValue: 0,
            dueDate: date, status: 'pendente', paymentMethod: input.paymentMethod,
          }));
        }
      } else {
        const pending = await manager.find(Installment, { where: { saleId: sale.id, status: In(['pendente', 'vencido']) } });
        for (const installment of pending) {
          installment.dueDate = this.financialService.getBoletoDueDate(scheduledSale, new Date(), installment.number);
          installment.status = 'pendente';
          await manager.save(Installment, installment);
        }
      }
      const [next] = await manager.query("SELECT MIN(due_date) AS due FROM installments WHERE sale_id=$1 AND status IN ('pendente','vencido','parcial')", [sale.id]);
      await manager.update(AccountReceivable, account.id, {
        totalValue: input.totalAmount, pendingValue: money(input.totalAmount - Number(account.paidValue)),
        installments: input.installments, paymentMethod: input.paymentMethod, customerId: input.customerId,
        dueDate: next?.due || input.dueDate, status: Number(account.paidValue) > 0 ? 'parcial' : 'pendente',
      });
      await manager.update(Sale, sale.id, {
        paymentStatus: 'pendente', billingStatus: plan.action !== 'none' ? 'nao_emitido' : sale.billingStatus,
        fiscalStatus: plan.action === 'documents' ? 'pendente' : sale.fiscalStatus,
      });
    }
    if (Number(sale.commissionAmount) !== input.commissionAmount || sale.technicianId !== input.technicianId) {
      await this.syncSaleCommission(sale.id, { baseValue: input.totalAmount, percentage: input.commissionPercentage, amount: input.commissionAmount }, manager);
      await manager.update(Commission, { saleId: sale.id, status: In([CommissionStatus.PENDENTE, CommissionStatus.APROVADA]) }, { technicianId: input.technicianId });
    }
    await manager.save(SaleEvent, manager.create(SaleEvent, {
      saleId: sale.id, type: 'sale.updated', description: 'Venda editada sem alterar sua identificação',
      createdBy: userId, metadata: { action: plan.action, totalAmount: input.totalAmount, installments: input.installments },
    }));
  }

  async remove(id: string, userId?: string): Promise<void> {
    const sale = await this.findOne(id);
    if (sale.status !== 'cancelado' as any && sale.operationalStatus !== 'cancelada') throw new BadRequestException('Apenas vendas canceladas podem ser arquivadas');
    sale.archivedAt = new Date();
    await this.salesRepository.save(sale);
    await this.auditService.safeCreate({ userId, action: 'sale.archived', entity: 'sale', entityId: id, oldData: { archivedAt: null }, newData: { archivedAt: sale.archivedAt } });
  }
  async approveCommercial(id: string, userId: string) {
    const sale = await this.findOne(id);
    sale.commercialApprovedBy = userId;
    if (sale.status === 'rascunho' as any || sale.status === 'pendente' as any) {
      sale.status = 'aprovada' as any;
    }
    const saved = await this.salesRepository.save(sale);
    await this.addEvent(id, 'sale.commercial_approved', saved.status as any, 'Aprovação comercial registrada', userId);
    return saved;
  }

  async approveFinancial(id: string, userId: string) {
    const sale = await this.findOne(id);
    sale.financialApprovedBy = userId;
    if (sale.status === 'rascunho' as any || sale.status === 'pendente' as any) {
      sale.status = 'aprovada' as any;
    }
    const saved = await this.salesRepository.save(sale);
    await this.addEvent(id, 'sale.financial_approved', saved.status as any, 'Aprovação financeira registrada', userId);
    return saved;
  }

  async approveDiscount(id: string, discountAmount: number, userId: string, reason?: string) {
    const sale = await this.findOne(id);
    const newDiscountAmount = money(discountAmount || 0);
    if (newDiscountAmount < 0) throw new BadRequestException('Desconto não pode ser negativo');
    if (newDiscountAmount > Number(sale.subtotal)) throw new BadRequestException('Desconto não pode ser maior que o subtotal da venda');

    // Aprovar desconto precisa recalcular total/comissão/lucro líquido junto,
    // do contrário esses campos ficam desatualizados em relação ao novo desconto.
    const items = await this.saleItemsRepository.find({ where: { saleId: id } });
    const totalCost = moneySum(items.map((item) => moneyMultiply(Number(item.costPrice || 0), Number(item.quantity || 0))));
    const totalAmount = money(Number(sale.subtotal) - newDiscountAmount);
    const commissionAmount = moneyMultiply(totalAmount, Number(sale.commissionPercentage || 0) / 100);
    const netProfit = money(totalAmount - totalCost - Number(sale.taxAmount) - commissionAmount);

    sale.discountAmount = newDiscountAmount;
    sale.discountApprovedBy = userId;
    sale.totalAmount = totalAmount;
    sale.commissionAmount = commissionAmount;
    sale.netProfit = netProfit;
    const saved = await this.salesRepository.save(sale);
    await this.syncSaleCommission(id, { baseValue: totalAmount, percentage: Number(sale.commissionPercentage || 0), amount: commissionAmount });
    await this.addEvent(id, 'sale.discount_approved', saved.status as any, 'Desconto aprovado', userId, {
      discountAmount: newDiscountAmount,
      totalAmount,
      commissionAmount,
      reason,
    });
    return saved;
  }

  async addAttachment(id: string, data: any, userId: string) {
    await this.findOne(id);
    const attachment = await this.saleAttachmentRepository.save(this.saleAttachmentRepository.create({
      ...data,
      saleId: id,
      uploadedBy: userId,
    }));
    await this.addEvent(id, 'sale.attachment_added', null, 'Anexo adicionado', userId, attachment);
    return attachment;
  }

  // Mantém a comissão pendente/aprovada vinculada à venda em sincronia com o valor real da venda,
  // já que a comissão é o registro que efetivamente paga o técnico (não os campos denormalizados na venda).
  private async syncSaleCommission(
    saleId: string,
    params: { baseValue: number; percentage: number; amount: number },
    manager?: import('typeorm').EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Commission) : this.commissionsRepository;
    await repo
      .createQueryBuilder()
      .update(Commission)
      .set({ baseValue: params.baseValue, percentage: params.percentage, amount: params.amount })
      .where('sale_id = :saleId', { saleId })
      .andWhere('status IN (:...statuses)', { statuses: ['pendente', 'aprovada'] })
      .execute();
  }

  async getAttachment(saleId: string, attachmentId: string) {
    await this.findOne(saleId);
    const attachment = await this.saleAttachmentRepository.findOne({ where: { id: attachmentId, saleId } });
    if (!attachment) throw new NotFoundException('Anexo não encontrado');
    return attachment;
  }

  async getEvents(id: string, requesterId?: string, requesterRole?: string) {
    await this.findOne(id, requesterId, requesterRole);
    return this.saleEventRepository.find({ where: { saleId: id }, order: { createdAt: 'ASC' } });
  }

  async resendDocuments(id: string, body: string | undefined, userId: string) {
    const result = await this.sendCustomerDocuments(id, body);
    await this.addEvent(id, 'sale.documents_resent', null, 'Documentos reenviados ao cliente', userId, result);
    return result;
  }

  async resendDocumentsWhatsapp(id: string, phone: string | undefined, userId: string) {
    const result = await this.sendCustomerDocumentsWhatsapp(id, phone);
    await this.addEvent(id, 'sale.documents_sent_whatsapp', null, 'Documentos enviados ao cliente por WhatsApp', userId, result);
    return result;
  }

  private async addEvent(saleId: string, type: string, status?: string, description?: string, userId?: string, metadata?: any) {
    await this.saleEventRepository.save(this.saleEventRepository.create({
      saleId,
      type,
      status: status || null,
      description: description || null,
      createdBy: userId || null,
      metadata: metadata || null,
    }));
  }
}
