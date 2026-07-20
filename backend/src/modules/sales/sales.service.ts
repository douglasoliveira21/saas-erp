import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

type MailAttachment = { filename: string; content: Buffer; contentType: string };

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemsRepository: Repository<SaleItem>,
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
  ) {}

  async create(createSaleDto: any): Promise<Sale> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { items, ...saleData } = createSaleDto;

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

      // Criar venda e itens dentro da mesma transação do estoque.
      const sale = queryRunner.manager.create(Sale, saleData);
      const savedSale = await queryRunner.manager.save(Sale, sale);

      for (const item of items) {
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

      if (saleData.paymentMethod === 'boleto') {
        const boletoTask = queryRunner.manager.create(FinancialTask, {
          saleId: savedSale.id,
          type: 'emissao_boleto',
          dueDate: new Date().toISOString().split('T')[0],
        });
        await queryRunner.manager.save(FinancialTask, boletoTask);
      }

      await queryRunner.commitTransaction();

      // Gerar contas a receber e movimentações financeiras
      try {
        const fullSale = await this.findOne(savedSale.id);
        await this.financialService.createFromSale(fullSale, saleData.technicianId);
      } catch { /* nao bloquear venda se financeiro falhar */ }

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

      return this.findOne(savedSale.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Sale[]> {
    return this.salesRepository.find({
      relations: ['technician', 'customer', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.salesRepository.findOne({
      where: { id },
      relations: ['technician', 'customer', 'items'],
    });

    if (!sale) throw new NotFoundException('Venda não encontrada');
    return sale;
  }

  async approve(id: string, userId: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (sale.status !== 'pendente') {
      throw new BadRequestException('Apenas vendas pendentes podem ter NF emitida');
    }
    sale.status = 'nf_emitida' as any;
    sale.approvedBy = userId as any;
    sale.approvedAt = new Date();
    const saved = await this.salesRepository.save(sale);

    // Concluir pendencia de NF
    await this.dataSource.query(
      "UPDATE financial_tasks SET status = 'concluido', completed_by = $1, completed_at = NOW() WHERE sale_id = $2 AND type = 'emissao_nf' AND status = 'pendente'",
      [userId, id]
    );

    return saved;
  }

  async markBoletoEmitido(id: string, userId: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (!['pendente', 'nf_emitida'].includes(sale.status as string)) {
      throw new BadRequestException('Esta venda nao pode ter boleto emitido neste status');
    }
    sale.status = 'boleto_emitido' as any;
    const saved = await this.salesRepository.save(sale);

    // Concluir pendencia de boleto
    await this.dataSource.query(
      "UPDATE financial_tasks SET status = 'concluido', completed_by = $1, completed_at = NOW() WHERE sale_id = $2 AND type = 'emissao_boleto' AND status = 'pendente'",
      [userId, id]
    );

    return saved;
  }

  async markPaid(id: string, userId: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (!['pendente', 'nf_emitida', 'boleto_emitido'].includes(sale.status as string)) {
      throw new BadRequestException('Esta venda nao pode ser marcada como paga');
    }
    sale.status = 'pago' as any;
    return this.salesRepository.save(sale);
  }

  async finalize(id: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (sale.status !== 'pago') {
      throw new BadRequestException('Apenas vendas pagas podem ser finalizadas');
    }
    sale.status = 'finalizado' as any;
    return this.salesRepository.save(sale);
  }

  async cancel(id: string, cancelledBy: string): Promise<Sale> {
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

      const paidCommission = await queryRunner.manager.findOne(Commission, {
        where: { saleId: id, status: CommissionStatus.PAGA },
      });
      if (paidCommission) {
        throw new BadRequestException('A comissão desta venda já foi paga. Reverta o pagamento da comissão antes de cancelar a venda.');
      }

      const alreadyCancelled = sale.status === 'cancelado' as any;
      if (!alreadyCancelled) {
        await this.cancelExternalDocuments(id);
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
      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async sendCustomerDocuments(id: string, customBody?: string): Promise<{ success: boolean; sent: boolean; attachments: string[] }> {
    const sale = await this.findOne(id);
    const customer = sale.customer as any;

    if (!customer?.email) {
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

      if (invoice.type === 'nfse' && invoice.access_key && invoice.certificate_id) {
        try {
          const pdf = await this.nfseService.downloadPdf(invoice.access_key, invoice.certificate_id);
          const filename = `NFSe_${number}_serie${invoice.series || 1}.pdf`;
          attachments.push({ filename, content: pdf, contentType: 'application/pdf' });
          attachmentNames.push(filename);
        } catch {}
      }
    }

    const payments = await this.dataSource.query(
      `SELECT codigo_solicitacao
       FROM payments
       WHERE sale_id = $1 AND type = 'boleto' AND status != 'cancelado'
       ORDER BY created_at DESC
       LIMIT 1`,
      [id],
    );

    if (payments[0]?.codigo_solicitacao) {
      try {
        const pdf = await this.interService.getBoletoPdf(payments[0].codigo_solicitacao);
        const filename = `boleto-${payments[0].codigo_solicitacao.substring(0, 8)}.pdf`;
        attachments.push({ filename, content: pdf, contentType: 'application/pdf' });
        attachmentNames.push(filename);
      } catch {}
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
      customer.email,
      `Documentos da venda #${sale.id.substring(0, 8)} - VGON`,
      html,
      attachments,
    );

    if (!sent) {
      throw new BadRequestException('Falha ao enviar email para o cliente');
    }

    return { success: true, sent, attachments: attachmentNames };
  }

  private async cancelExternalDocuments(saleId: string): Promise<void> {
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
        await this.nfseService.cancel(invoice.id, reason, invoice.certificate_id);
      } else {
        await this.nfeService.cancel(invoice.id, reason, invoice.certificate_id);
      }
    }
  }

  async update(id: string, updateSaleDto: any): Promise<Sale> {
    const sale = await this.salesRepository.findOne({ where: { id } });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    
    // Remover campos de relação que não devem ser sobrescritos diretamente
    const { technician, customer, items, approver, ...safeDto } = updateSaleDto;
    
    // Verificar se dueDay mudou para atualizar parcelas
    const dueDayChanged = safeDto.dueDay !== undefined && safeDto.dueDay !== sale.dueDay;
    
    Object.assign(sale, safeDto);
    await this.salesRepository.save(sale);

    // Se o dia de vencimento mudou, atualizar parcelas pendentes
    if (dueDayChanged && safeDto.dueDay) {
      try {
        const newDueDay = Number(safeDto.dueDay);
        
        // Atualizar parcelas pendentes (installments)
        const pendingInstallments = await this.dataSource.query(
          `SELECT id, number, due_date FROM installments WHERE sale_id = $1 AND status IN ('pendente', 'vencido')`,
          [id]
        );

        for (const inst of pendingInstallments) {
          const oldDate = new Date(inst.due_date);
          const newDate = new Date(oldDate.getFullYear(), oldDate.getMonth(), newDueDay);
          // Se o novo dia é menor que hoje, pula para o próximo mês
          if (newDate < new Date()) {
            newDate.setMonth(newDate.getMonth() + 1);
          }
          const newDateStr = newDate.toISOString().split('T')[0];
          await this.dataSource.query(
            `UPDATE installments SET due_date = $1, status = 'pendente' WHERE id = $2`,
            [newDateStr, inst.id]
          );
        }

        // Atualizar conta a receber (due_date principal)
        const account = await this.dataSource.query(
          `SELECT id FROM accounts_receivable WHERE sale_id = $1 AND status IN ('pendente', 'parcial')`,
          [id]
        );
        if (account.length > 0) {
          const now = new Date();
          const newAccountDate = new Date(now.getFullYear(), now.getMonth(), newDueDay);
          if (newAccountDate < now) newAccountDate.setMonth(newAccountDate.getMonth() + 1);
          await this.dataSource.query(
            `UPDATE accounts_receivable SET due_date = $1 WHERE id = $2`,
            [newAccountDate.toISOString().split('T')[0], account[0].id]
          );
        }
      } catch (err) {
        // Não bloquear a edição se a atualização de parcelas falhar
        console.warn('Erro ao atualizar parcelas:', err.message);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const sale = await this.findOne(id);
    if (sale.status !== 'cancelado' as any) {
      throw new BadRequestException('Apenas vendas canceladas podem ser excluidas');
    }
    // Verificar se tem nota fiscal autorizada vinculada
    const hasAuthorizedInvoice = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM invoices WHERE sale_id = $1 AND status = 'autorizada'`, [id]
    );
    if (parseInt(hasAuthorizedInvoice[0]?.count) > 0) {
      throw new BadRequestException('Nao e possivel excluir venda com nota fiscal autorizada vinculada');
    }
    // Deletar registros relacionados primeiro
    await this.dataSource.query('DELETE FROM financial_movements WHERE sale_id = $1', [id]);
    await this.dataSource.query('DELETE FROM installments WHERE sale_id = $1', [id]);
    await this.dataSource.query('DELETE FROM accounts_receivable WHERE sale_id = $1', [id]);
    await this.dataSource.query('DELETE FROM invoices WHERE sale_id = $1', [id]);
    await this.dataSource.query('DELETE FROM financial_tasks WHERE sale_id = $1', [id]);
    await this.dataSource.query('DELETE FROM commissions WHERE sale_id = $1', [id]);
    await this.dataSource.query('DELETE FROM stock_movements WHERE sale_id = $1', [id]);
    await this.dataSource.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
    await this.salesRepository.remove(sale);
  }
}
