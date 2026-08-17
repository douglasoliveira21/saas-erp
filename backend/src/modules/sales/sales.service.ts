import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
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

type MailAttachment = { filename: string; content: Buffer; contentType: string };

@Injectable()
export class SalesService {
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
  ) {}

  async create(createSaleDto: any, userId?: string): Promise<Sale> {
    const today = new Date(); const todayLocal = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    if (createSaleDto.dueDate && createSaleDto.dueDate < todayLocal) throw new BadRequestException('Vencimento da venda não pode estar no passado');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { items, alreadyPaid = false, ...saleData } = createSaleDto;
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
      await queryRunner.rollbackTransaction();
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

    // Get earliest pending due date per sale (from payments or installments)
    const dueDates = await this.dataSource.query(
      `SELECT sale_id, MIN(due_date) as earliest_due
       FROM payments
       WHERE sale_id = ANY($1::uuid[])
         AND type IN ('boleto', 'pix')
         AND status IN ('a_receber', 'vencido')
       GROUP BY sale_id`,
      [ids],
    );
    const dueDateMap = new Map(dueDates.map((r: any) => [r.sale_id, r.earliest_due]));

    // Also check installments for due dates when payments table doesn't have them
    const installDueDates = await this.dataSource.query(
      `SELECT sale_id, MIN(due_date) as earliest_due
       FROM installments
       WHERE sale_id::uuid = ANY($1::uuid[])
         AND status IN ('pendente', 'vencido')
       GROUP BY sale_id`,
      [ids],
    );
    for (const r of installDueDates) {
      if (!dueDateMap.has(r.sale_id)) dueDateMap.set(r.sale_id, r.earliest_due);
    }

    const today = new Date().toISOString().split('T')[0];

    for (const sale of sales) {
      if (withBoleto.has(sale.id) && !['pago', 'vencido'].includes(sale.billingStatus)) {
        sale.billingStatus = 'emitido';
      }

      // Set dueDate from payments/installments if not set on sale
      const earliestDue = dueDateMap.get(sale.id);
      if (earliestDue && !sale.dueDate) {
        sale.dueDate = String(earliestDue).split('T')[0];
      }

      // Set paymentStatus based on billing and due date
      if (!['pago', 'cancelado'].includes(sale.billingStatus) && !['pago', 'finalizado', 'cancelado'].includes(sale.status)) {
        const rawDue = earliestDue ? String(earliestDue) : null;
        const effectiveDue = sale.dueDate || (rawDue ? rawDue.split('T')[0] : null);
        if (effectiveDue && effectiveDue < today && (sale.billingStatus === 'emitido' || withBoleto.has(sale.id))) {
          (sale as any).paymentStatus = 'inadimplente';
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
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: ['technician', 'customer', 'items'],
    });

    if (!sale) throw new NotFoundException('Venda não encontrada');
    // Só é aplicado quando o chamador informa quem está pedindo (endpoints de leitura expostos ao técnico);
    // chamadas internas (approve/cancel/markPaid etc.) não passam requesterRole e continuam sem restrição.
    if (requesterRole === 'tecnico' && requesterId && sale.technicianId !== requesterId) {
      throw new ForbiddenException('Você não tem acesso a esta venda');
    }
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
        where: { saleId: id, type: StockMovementType.ESTORNO },
      });

      if (!previousReversal) {
        const saleMovements = await queryRunner.manager.find(StockMovement, {
          where: { saleId: id, type: StockMovementType.VENDA },
          order: { productId: 'ASC' },
        });

        for (const movement of saleMovements) {
          const product = await queryRunner.manager.findOne(Product, {
            where: { id: movement.productId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!product) {
            throw new BadRequestException(`Produto ${movement.productId} não encontrado para estorno do estoque`);
          }

          const previousQuantity = Number(product.quantity);
          const newQuantity = previousQuantity + Number(movement.quantity);
          await queryRunner.manager.update(Product, product.id, { quantity: newQuantity });

          const reversal = queryRunner.manager.create(StockMovement, {
            productId: product.id,
            type: StockMovementType.ESTORNO,
            quantity: Number(movement.quantity),
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
  async sendCustomerDocuments(id: string, customBody?: string): Promise<{ success: boolean; sent: boolean; attachments: string[] }> {
    const sale = await this.findOne(id);
    const customer = sale.customer as any;

    const customerEmails = getCustomerEmailRecipients(customer);
    if (!customerEmails) {
      throw new BadRequestException('Cliente sem email cadastrado');
    }

    const attachments: MailAttachment[] = [];
    const attachmentNames: string[] = [];

    const invoices = await this.dataSource.query(
      `SELECT id, type, number, series, access_key, certificate_id, xml_authorized, xml_sent, total_value
       FROM invoices
       WHERE sale_id = $1 AND status = 'autorizada'
       ORDER BY issued_at DESC NULLS LAST, created_at DESC`,
      [id],
    );

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
          </table>
          <p style="color: #4b5563;">Arquivos enviados:</p>
          <ul style="color: #4b5563;">${attachmentNames.map(name => `<li>${name}</li>`).join('')}</ul>
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

    return { success: true, sent, attachments: attachmentNames };
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
      if (!invoice.certificate_id) {
        throw new BadRequestException(`Nota fiscal ${invoice.id} sem certificado vinculado para cancelamento`);
      }

      if (invoice.type === 'nfse') {
        await this.nfseService.cancel(invoice.id, reason, invoice.certificate_id, userId);
      } else {
        await this.nfeService.cancel(invoice.id, reason, invoice.certificate_id, userId);
      }
    }
  }

  async update(id: string, updateSaleDto: any, userId?: string, userRole?: string): Promise<Sale> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let oldData: any;
    let safeDto: any;
    let reassignedTechnician: { fromId: string; toId: string } | null = null;
    try {
      const sale = await queryRunner.manager.getRepository(Sale).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!sale) throw new NotFoundException('Venda não encontrada');
      oldData = { ...sale };
      const { technician, customer, items, approver, alreadyPaid, technicianId, ...allowedDto } = updateSaleDto;
      safeDto = allowedDto;

      // Somente administradores podem reatribuir quem realizou a venda.
      // Sem isso, a venda mantém o vendedor original mesmo quando outro usuário a edita.
      if (technicianId && technicianId !== sale.technicianId) {
        if (userRole !== 'admin') {
          throw new BadRequestException('Apenas administradores podem alterar o técnico responsável pela venda');
        }
        reassignedTechnician = { fromId: sale.technicianId, toId: technicianId };
        safeDto.technicianId = technicianId;
      }

      const shouldMarkPaid = Boolean(alreadyPaid) && sale.paymentStatus !== 'pago';
      if (Array.isArray(items) && items.length) {
        const subtotal = moneySum(items.map((item: any) => moneyMultiply(Number(item.unitPrice || 0), Number(item.quantity || 0))));
        const discountAmount = money(safeDto.discountAmount ?? safeDto.discountValue ?? 0);
        const taxAmount = moneySum(items.map((item: any) => moneyMultiply(moneyMultiply(Number(item.unitPrice || 0), Number(item.quantity || 0)), Number(item.taxPercentage || 0) / 100)));
        const totalAmount = money(subtotal - discountAmount);
        const commissionAmount = moneyMultiply(totalAmount, Number(safeDto.commissionPercentage ?? sale.commissionPercentage ?? 0) / 100);
        const totalCost = moneySum(items.map((item: any) => moneyMultiply(Number(item.costPrice || 0), Number(item.quantity || 0))));
        Object.assign(safeDto, { subtotal, discountAmount, taxAmount, totalAmount, commissionAmount, netProfit: money(totalAmount - totalCost - taxAmount - commissionAmount) });
      }
      const billingScheduleProvided = (safeDto.paymentMethod || sale.paymentMethod) === 'boleto' && safeDto.dueDay !== undefined;
      Object.assign(sale, safeDto);
      if (billingScheduleProvided && safeDto.dueDay) {
        const newDueDay = Number(safeDto.dueDay);
        if (!Number.isInteger(newDueDay) || newDueDay < 1 || newDueDay > 31) throw new BadRequestException('Dia de vencimento inválido');
        const pending = await queryRunner.query(`SELECT id, number, due_date FROM installments WHERE sale_id = $1 AND status IN ('pendente','vencido') FOR UPDATE`, [id]);
        for (const installment of pending) {
          const scheduleSale = Object.assign(new Sale(), sale, { dueDay: newDueDay, dueDate: null });
          const date = this.financialService.getBoletoDueDate(scheduleSale, new Date(), Number(installment.number || 1));
          await queryRunner.query(`UPDATE installments SET due_date=$1, status='pendente' WHERE id=$2`, [date, installment.id]);
        }
        const firstPending = await queryRunner.query(`SELECT due_date FROM installments WHERE sale_id=$1 AND status IN ('pendente','vencido') ORDER BY number LIMIT 1`, [id]);
        if (firstPending[0]) await queryRunner.query(`UPDATE accounts_receivable SET due_date=$1 WHERE sale_id=$2 AND status IN ('pendente','parcial')`, [firstPending[0].due_date, id]);
      }
      await queryRunner.manager.getRepository(Sale).save(sale);
      if (Array.isArray(items) && items.length) {
        await this.syncSaleCommission(
          id,
          { baseValue: Number(sale.totalAmount), percentage: Number(sale.commissionPercentage || 0), amount: Number(sale.commissionAmount) },
          queryRunner.manager,
        );
      }
      if (shouldMarkPaid) {
        await this.financialService.settleSale(id, safeDto.paymentMethod || sale.paymentMethod, userId, `sale-edit-paid:${id}`, new Date(), undefined, queryRunner.manager);
        safeDto = { ...safeDto, markedPaid: true };
      }
      if (reassignedTechnician) {
        // Transfere a comissão pendente/aprovada da venda: retira do técnico anterior e credita ao novo.
        await queryRunner.manager
          .createQueryBuilder()
          .update(Commission)
          .set({ technicianId: reassignedTechnician.toId })
          .where('sale_id = :saleId', { saleId: id })
          .andWhere('status IN (:...statuses)', { statuses: ['pendente', 'aprovada'] })
          .execute();
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    const updated = await this.findOne(id);
    await this.auditService.safeCreate({ userId, action: 'sale.updated', entity: 'sale', entityId: id, oldData, newData: safeDto });
    if (reassignedTechnician) {
      await this.auditService.safeCreate({
        userId,
        action: 'sale.technician_reassigned',
        entity: 'sale',
        entityId: id,
        oldData: { technicianId: reassignedTechnician.fromId },
        newData: { technicianId: reassignedTechnician.toId },
      });
      await this.addEvent(id, 'sale.technician_reassigned', updated.status as any, 'Técnico responsável pela venda alterado pelo administrador', userId, reassignedTechnician);
    }
    return updated;
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
