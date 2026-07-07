import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { FinancialTask } from '../financial-tasks/entities/financial-task.entity';
import { MailService } from '../mail/mail.service';
import { FinancialService } from '../financial/financial.service';
import { User } from '../users/entities/user.entity';

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
  ) {}

  async create(createSaleDto: any): Promise<Sale> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { items, ...saleData } = createSaleDto;

      // Criar venda
      const sale = queryRunner.manager.create(Sale, saleData);
      const savedSale = await queryRunner.manager.save(Sale, sale);

      // Criar itens e atualizar estoque
      for (const item of items) {
        const saleItem = queryRunner.manager.create(SaleItem, {
          ...item,
          saleId: savedSale.id,
        });
        await queryRunner.manager.save(SaleItem, saleItem);

        // Atualizar estoque se for produto
        if (item.productId) {
          const product = await queryRunner.manager.findOne(Product, { where: { id: item.productId } });
          if (product) {
            const previousQty = product.quantity;
            const newQty = previousQty - item.quantity;
            await queryRunner.manager.update(Product, product.id, { quantity: newQty });

            const movement = queryRunner.manager.create(StockMovement, {
              productId: product.id,
              type: 'venda' as any,
              quantity: item.quantity,
              previousQuantity: previousQty,
              newQuantity: newQty,
              reason: `Venda #${savedSale.id}`,
              userId: saleData.technicianId,
              saleId: savedSale.id,
            } as any);
            await queryRunner.manager.save(StockMovement, movement);
          }
        }
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

  async cancel(id: string): Promise<Sale> {
    const sale = await this.findOne(id);
    if (['finalizado', 'cancelado'].includes(sale.status as string)) {
      throw new BadRequestException('Esta venda nao pode ser cancelada');
    }
    sale.status = 'cancelado' as any;
    await this.salesRepository.save(sale);

    // Cancelar boleto no Banco Inter (se existir)
    try {
      const payments = await this.dataSource.query(
        `SELECT codigo_solicitacao, type FROM payments WHERE sale_id = $1 AND status != 'cancelado'`, [id]
      );
      for (const payment of payments) {
        await this.dataSource.query(
          `UPDATE payments SET status = 'cancelado', updated_at = NOW() WHERE sale_id = $1`, [id]
        );
      }
    } catch {}

    // Cancelar nota fiscal (se existir autorizada)
    try {
      const invoices = await this.dataSource.query(
        `SELECT id, type, access_key, certificate_id, status FROM invoices WHERE sale_id = $1 AND status = 'autorizada'`, [id]
      );
      for (const inv of invoices) {
        // Marcar como cancelada no banco (o cancelamento real na SEFAZ/Cidade360 precisa ser feito manualmente pelo prazo)
        await this.dataSource.query(
          `UPDATE invoices SET status = 'cancelada', cancel_reason = 'Cancelamento automatico por cancelamento da venda', canceled_at = NOW() WHERE id = $1`, [inv.id]
        );
      }
    } catch {}

    // Cancelar contas a receber
    try {
      await this.dataSource.query(
        `UPDATE accounts_receivable SET status = 'cancelado', canceled_at = NOW(), cancel_reason = 'Venda cancelada' WHERE sale_id = $1 AND status != 'cancelado'`, [id]
      );
      await this.dataSource.query(
        `UPDATE installments SET status = 'cancelado' WHERE sale_id = $1 AND status != 'pago'`, [id]
      );
    } catch {}

    return this.findOne(id);
  }

  async update(id: string, updateSaleDto: any): Promise<Sale> {
    const sale = await this.salesRepository.findOne({ where: { id } });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    
    // Remover campos de relação que não devem ser sobrescritos diretamente
    const { technician, customer, items, approver, ...safeDto } = updateSaleDto;
    
    Object.assign(sale, safeDto);
    await this.salesRepository.save(sale);
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
