import { Injectable, NotFoundException, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, In } from 'typeorm';
import { AccountReceivable } from './entities/account-receivable.entity';
import { Installment } from './entities/installment.entity';
import { FinancialMovement } from './entities/financial-movement.entity';
import { CardFee } from './entities/card-fee.entity';
import { CustomerCredit } from './entities/customer-credit.entity';
import { Sale } from '../sales/entities/sale.entity';

@Injectable()
export class FinancialService implements OnModuleInit {
  private readonly logger = new Logger(FinancialService.name);

  async onModuleInit() {
    // Sync existing sales on startup
    // Aguarda um momento para garantir que as tabelas foram criadas pelo synchronize
    setTimeout(async () => {
      try {
        const result = await this.syncExistingSales('system');
        if (result.synced > 0) {
          this.logger.log(`Sincronizadas ${result.synced} vendas com o financeiro`);
        }
      } catch (e) {
        if (e.message?.includes('does not exist')) {
          this.logger.warn('Tabelas ainda não criadas. Sincronização será feita no próximo restart.');
        } else {
          this.logger.error('Erro ao sincronizar vendas: ' + e.message);
        }
      }
    }, 5000);
  }
  constructor(
    @InjectRepository(AccountReceivable)
    private readonly accountRepo: Repository<AccountReceivable>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(FinancialMovement)
    private readonly movementRepo: Repository<FinancialMovement>,
    @InjectRepository(CardFee)
    private readonly cardFeeRepo: Repository<CardFee>,
    @InjectRepository(CustomerCredit)
    private readonly creditRepo: Repository<CustomerCredit>,
  ) {}

  /**
   * Creates financial records when a sale is created.
   * Handles different payment methods with appropriate logic.
   */
  async createFromSale(sale: Sale, userId: string): Promise<AccountReceivable> {
    const now = new Date();
    const isImmediate = ['dinheiro', 'pix', 'cartao_debito', 'transferencia'].includes(sale.paymentMethod);
    const isCard = ['cartao_credito', 'cartao_debito'].includes(sale.paymentMethod);

    // Create account receivable
    const account = this.accountRepo.create({
      saleId: sale.id,
      customerId: sale.customerId,
      description: `Venda #${sale.id.substring(0, 8)}`,
      totalValue: sale.totalAmount,
      paidValue: isImmediate ? sale.totalAmount : 0,
      pendingValue: isImmediate ? 0 : sale.totalAmount,
      installments: sale.installments || 1,
      paymentMethod: sale.paymentMethod,
      status: isImmediate ? 'pago' : 'pendente',
      dueDate: this.calculateDueDate(sale, now),
      paidAt: isImmediate ? now : null,
      createdBy: userId,
    });

    const savedAccount = await this.accountRepo.save(account);

    // Get card fee info if applicable
    let cardFee: CardFee | null = null;
    if (isCard) {
      cardFee = await this.getCardFee(sale.paymentMethod, sale.installments || 1);
    }

    // Create installments
    const installments = this.generateInstallments(sale, savedAccount, now, cardFee);
    await this.installmentRepo.save(installments);

    // Create financial movements
    await this.createMovementsFromSale(sale, savedAccount, userId, now, cardFee);

    return savedAccount;
  }

  /**
   * Pay an installment (full or partial).
   */
  async payInstallment(
    installmentId: string,
    value: number,
    paymentMethod: string,
    userId: string,
  ): Promise<Installment> {
    const installment = await this.installmentRepo.findOne({
      where: { id: installmentId },
      relations: ['account'],
    });

    if (!installment) {
      throw new NotFoundException('Parcela não encontrada');
    }

    if (installment.status === 'pago' || installment.status === 'cancelado') {
      throw new BadRequestException('Parcela já está paga ou cancelada');
    }

    const remaining = Number(installment.value) - Number(installment.paidValue);
    if (value > remaining) {
      throw new BadRequestException(`Valor excede o saldo da parcela (R$ ${remaining.toFixed(2)})`);
    }

    const newPaidValue = Number(installment.paidValue) + value;
    const isPaid = newPaidValue >= Number(installment.value);

    installment.paidValue = newPaidValue;
    installment.status = isPaid ? 'pago' : 'parcial';
    installment.paidAt = isPaid ? new Date() : null;
    installment.paymentMethod = paymentMethod;

    await this.installmentRepo.save(installment);

    // Update account totals
    await this.updateAccountTotals(installment.accountId);

    // Create realized movement
    await this.movementRepo.save(
      this.movementRepo.create({
        type: 'receita',
        category: 'venda',
        description: `Pagamento parcela ${installment.number}`,
        value,
        date: new Date().toISOString().split('T')[0],
        saleId: installment.saleId,
        accountId: installment.accountId,
        installmentId: installment.id,
        paymentMethod,
        isForecast: false,
        createdBy: userId,
      }),
    );

    return installment;
  }

  /**
   * Cancel an account receivable and its pending installments.
   */
  async cancelAccount(accountId: string, reason: string, userId: string): Promise<AccountReceivable> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId },
      relations: ['installmentsList'],
    });

    if (!account) {
      throw new NotFoundException('Conta a receber não encontrada');
    }

    if (account.status === 'cancelado') {
      throw new BadRequestException('Conta já está cancelada');
    }

    // Cancel pending installments
    const pendingInstallments = account.installmentsList.filter(
      (i) => i.status === 'pendente' || i.status === 'vencido',
    );

    for (const installment of pendingInstallments) {
      installment.status = 'cancelado';
      await this.installmentRepo.save(installment);
    }

    // Update account
    account.status = 'cancelado';
    account.canceledAt = new Date();
    account.cancelReason = reason;
    account.pendingValue = 0;

    await this.accountRepo.save(account);

    // Create estorno movement if there was paid value
    if (Number(account.paidValue) > 0) {
      await this.movementRepo.save(
        this.movementRepo.create({
          type: 'estorno',
          category: 'estorno',
          description: `Cancelamento: ${reason}`,
          value: Number(account.paidValue),
          date: new Date().toISOString().split('T')[0],
          saleId: account.saleId,
          accountId: account.id,
          paymentMethod: account.paymentMethod,
          isForecast: false,
          createdBy: userId,
        }),
      );
    }

    return account;
  }

  /**
   * Create customer credit (for returns/devolutions).
   */
  async createCredit(
    customerId: string,
    saleId: string,
    value: number,
    reason: string,
    userId: string,
  ): Promise<CustomerCredit> {
    const credit = this.creditRepo.create({
      customerId,
      saleId,
      value,
      usedValue: 0,
      reason,
      status: 'ativo',
      createdBy: userId,
    });

    return this.creditRepo.save(credit);
  }

  /**
   * Get cash flow for a period (forecast vs realized).
   */
  async getFlowByPeriod(startDate: string, endDate: string) {
    const movements = await this.movementRepo.find({
      where: {
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    const forecast = movements.filter((m) => m.isForecast);
    const realized = movements.filter((m) => !m.isForecast);

    const totalForecastReceita = forecast
      .filter((m) => m.type === 'receita')
      .reduce((sum, m) => sum + Number(m.value), 0);

    const totalRealizedReceita = realized
      .filter((m) => m.type === 'receita')
      .reduce((sum, m) => sum + Number(m.value), 0);

    const totalDespesa = realized
      .filter((m) => m.type === 'despesa')
      .reduce((sum, m) => sum + Number(m.value), 0);

    const totalEstorno = realized
      .filter((m) => m.type === 'estorno')
      .reduce((sum, m) => sum + Number(m.value), 0);

    return {
      period: { startDate, endDate },
      forecast: {
        receitas: totalForecastReceita,
      },
      realized: {
        receitas: totalRealizedReceita,
        despesas: totalDespesa,
        estornos: totalEstorno,
        saldo: totalRealizedReceita - totalDespesa - totalEstorno,
      },
      movements,
    };
  }

  /**
   * Dashboard with financial totals.
   */
  async getDashboard() {
    const accounts = await this.accountRepo.find();

    const totalVendido = accounts.reduce((sum, a) => sum + Number(a.totalValue), 0);
    const totalRecebido = accounts.reduce((sum, a) => sum + Number(a.paidValue), 0);
    const totalPendente = accounts
      .filter((a) => a.status === 'pendente' || a.status === 'parcial')
      .reduce((sum, a) => sum + Number(a.pendingValue), 0);

    const overdueInstallments = await this.installmentRepo.find({
      where: {
        status: In(['pendente', 'vencido']),
        dueDate: LessThan(new Date().toISOString().split('T')[0]),
      },
    });

    const totalInadimplente = overdueInstallments.reduce(
      (sum, i) => sum + (Number(i.value) - Number(i.paidValue)),
      0,
    );

    const paidAccounts = accounts.filter((a) => a.status === 'pago');
    const ticketMedio = paidAccounts.length > 0
      ? totalRecebido / paidAccounts.length
      : 0;

    return {
      totalVendido,
      totalRecebido,
      totalPendente,
      totalInadimplente,
      ticketMedio,
      totalContas: accounts.length,
      contasPagas: paidAccounts.length,
      contasPendentes: accounts.filter((a) => a.status === 'pendente').length,
      contasVencidas: accounts.filter((a) => a.status === 'vencido').length,
    };
  }

  /**
   * Get overdue installments.
   */
  async getOverdue() {
    const today = new Date().toISOString().split('T')[0];

    const overdue = await this.installmentRepo.find({
      where: {
        status: In(['pendente', 'vencido']),
        dueDate: LessThan(today),
      },
      relations: ['account'],
      order: { dueDate: 'ASC' },
    });

    // Mark as vencido
    for (const installment of overdue) {
      if (installment.status === 'pendente') {
        installment.status = 'vencido';
        await this.installmentRepo.save(installment);
      }
    }

    return overdue;
  }

  /**
   * List accounts with filters.
   */
  async findAll(filters?: {
    status?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
  }) {
    const query = this.accountRepo.createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('account.installmentsList', 'installments')
      .orderBy('account.createdAt', 'DESC');

    if (filters?.status) {
      query.andWhere('account.status = :status', { status: filters.status });
    }
    if (filters?.customerId) {
      query.andWhere('account.customerId = :customerId', { customerId: filters.customerId });
    }
    if (filters?.startDate) {
      query.andWhere('account.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query.andWhere('account.createdAt <= :endDate', { endDate: filters.endDate + 'T23:59:59' });
    }
    if (filters?.paymentMethod) {
      query.andWhere('account.paymentMethod = :paymentMethod', { paymentMethod: filters.paymentMethod });
    }

    return query.getMany();
  }

  /**
   * List installments with filters.
   */
  async findInstallments(filters?: {
    status?: string;
    accountId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const query = this.installmentRepo.createQueryBuilder('installment')
      .leftJoinAndSelect('installment.account', 'account')
      .leftJoin('account.customer', 'customer')
      .addSelect(['customer.id', 'customer.name', 'customer.cpfCnpj'])
      .orderBy('installment.dueDate', 'ASC');

    if (filters?.status) {
      query.andWhere('installment.status = :status', { status: filters.status });
    }
    if (filters?.accountId) {
      query.andWhere('installment.accountId = :accountId', { accountId: filters.accountId });
    }
    if (filters?.startDate) {
      query.andWhere('installment.dueDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query.andWhere('installment.dueDate <= :endDate', { endDate: filters.endDate });
    }

    return query.getMany();
  }

  /**
   * List movements with filters.
   */
  async findMovements(filters?: {
    type?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    isForecast?: boolean;
  }) {
    const query = this.movementRepo.createQueryBuilder('movement')
      .orderBy('movement.date', 'DESC');

    if (filters?.type) {
      query.andWhere('movement.type = :type', { type: filters.type });
    }
    if (filters?.category) {
      query.andWhere('movement.category = :category', { category: filters.category });
    }
    if (filters?.startDate) {
      query.andWhere('movement.date >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query.andWhere('movement.date <= :endDate', { endDate: filters.endDate });
    }
    if (filters?.isForecast !== undefined) {
      query.andWhere('movement.isForecast = :isForecast', { isForecast: filters.isForecast });
    }

    return query.getMany();
  }

  // ==================== Card Fees ====================

  async findAllCardFees() {
    return this.cardFeeRepo.find({ order: { operator: 'ASC', paymentType: 'ASC' } });
  }

  async createCardFee(data: Partial<CardFee>) {
    const fee = this.cardFeeRepo.create(data);
    return this.cardFeeRepo.save(fee);
  }

  async createMovement(data: Partial<FinancialMovement>) {
    const movement = this.movementRepo.create(data);
    return this.movementRepo.save(movement);
  }

  async deleteCardFee(id: string) {
    const fee = await this.cardFeeRepo.findOne({ where: { id } });
    if (!fee) {
      throw new NotFoundException('Taxa não encontrada');
    }
    await this.cardFeeRepo.remove(fee);
    return { message: 'Taxa removida com sucesso' };
  }

  // ==================== Private Helpers ====================

  private calculateDueDate(sale: Sale, now: Date): string {
    // A data de vencimento da conta é a data da venda (primeira parcela)
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private generateInstallments(
    sale: Sale,
    account: AccountReceivable,
    now: Date,
    cardFee: CardFee | null,
  ): Partial<Installment>[] {
    const numInstallments = sale.installments || 1;
    const totalAmount = Number(sale.totalAmount);
    const baseValue = Math.floor((totalAmount / numInstallments) * 100) / 100; // Arredondar para baixo
    const isImmediate = ['dinheiro', 'pix', 'cartao_debito', 'transferencia'].includes(sale.paymentMethod);
    const installments: Partial<Installment>[] = [];

    let totalDistributed = 0;

    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = this.calculateInstallmentDueDate(sale, now, i, cardFee);
      // Última parcela recebe a diferença de centavos
      const value = i === numInstallments ? (totalAmount - totalDistributed) : baseValue;
      totalDistributed += value;

      installments.push({
        accountId: account.id,
        saleId: sale.id,
        number: i,
        value: Number(value.toFixed(2)),
        paidValue: isImmediate ? Number(value.toFixed(2)) : 0,
        dueDate,
        paidAt: isImmediate ? now : null,
        status: isImmediate ? 'pago' : 'pendente',
        paymentMethod: sale.paymentMethod,
      });
    }

    return installments;
  }

  private calculateInstallmentDueDate(
    sale: Sale,
    now: Date,
    installmentNumber: number,
    cardFee: CardFee | null,
  ): string {
    const dueDate = new Date(now);

    if (['dinheiro', 'pix', 'cartao_debito', 'transferencia'].includes(sale.paymentMethod)) {
      return dueDate.toISOString().split('T')[0];
    }

    if (sale.paymentMethod === 'cartao_credito') {
      const daysToReceive = cardFee?.daysToReceive || 30;
      dueDate.setDate(dueDate.getDate() + daysToReceive * installmentNumber);
      return dueDate.toISOString().split('T')[0];
    }

    // Boleto - primeira parcela no dia da venda, demais no mesmo dia dos meses seguintes
    // installmentNumber começa em 1: parcela 1 = mês atual, parcela 2 = próximo mês, etc.
    const saleDay = now.getDate();
    dueDate.setMonth(dueDate.getMonth() + (installmentNumber - 1));
    // Garantir que o dia não ultrapasse o último dia do mês
    const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
    dueDate.setDate(Math.min(saleDay, lastDayOfMonth));

    return dueDate.toISOString().split('T')[0];
  }

  private async createMovementsFromSale(
    sale: Sale,
    account: AccountReceivable,
    userId: string,
    now: Date,
    cardFee: CardFee | null,
  ): Promise<void> {
    const isImmediate = ['dinheiro', 'pix', 'cartao_debito', 'transferencia'].includes(sale.paymentMethod);
    const isCard = ['cartao_credito', 'cartao_debito'].includes(sale.paymentMethod);
    const today = now.toISOString().split('T')[0];

    if (isImmediate) {
      // Realized movement - full value received
      await this.movementRepo.save(
        this.movementRepo.create({
          type: 'receita',
          category: 'venda',
          description: `Venda #${sale.id.substring(0, 8)} - ${sale.paymentMethod}`,
          value: Number(sale.totalAmount),
          date: today,
          saleId: sale.id,
          accountId: account.id,
          paymentMethod: sale.paymentMethod,
          isForecast: false,
          createdBy: userId,
        }),
      );
    } else {
      // Forecast movement
      const forecastDate = sale.paymentMethod === 'cartao_credito'
        ? this.calculateInstallmentDueDate(sale, now, 1, cardFee)
        : account.dueDate;

      await this.movementRepo.save(
        this.movementRepo.create({
          type: 'receita',
          category: 'venda',
          description: `Venda #${sale.id.substring(0, 8)} - ${sale.paymentMethod} (previsão)`,
          value: Number(sale.totalAmount),
          date: forecastDate,
          saleId: sale.id,
          accountId: account.id,
          paymentMethod: sale.paymentMethod,
          isForecast: true,
          createdBy: userId,
        }),
      );
    }

    // Card fee movement (for both credit and debit cards)
    if (isCard && cardFee) {
      const feeValue = Number(sale.totalAmount) * (Number(cardFee.feePercentage) / 100);

      await this.movementRepo.save(
        this.movementRepo.create({
          type: 'despesa',
          category: 'taxa_cartao',
          description: `Taxa ${cardFee.operator} - ${cardFee.feePercentage}% sobre venda #${sale.id.substring(0, 8)}`,
          value: feeValue,
          date: today,
          saleId: sale.id,
          accountId: account.id,
          paymentMethod: sale.paymentMethod,
          isForecast: isImmediate ? false : true,
          createdBy: userId,
        }),
      );
    }
  }

  private async getCardFee(paymentMethod: string, installments: number): Promise<CardFee | null> {
    const paymentType = paymentMethod === 'cartao_credito' ? 'credito' : 'debito';

    const fee = await this.cardFeeRepo
      .createQueryBuilder('fee')
      .where('fee.paymentType = :paymentType', { paymentType })
      .andWhere('fee.installmentsFrom <= :installments', { installments })
      .andWhere('fee.installmentsTo >= :installments', { installments })
      .andWhere('fee.active = :active', { active: true })
      .getOne();

    return fee;
  }

  private async updateAccountTotals(accountId: string): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId },
      relations: ['installmentsList'],
    });

    if (!account) return;

    const totalPaid = account.installmentsList.reduce(
      (sum, i) => sum + Number(i.paidValue),
      0,
    );

    account.paidValue = totalPaid;
    account.pendingValue = Number(account.totalValue) - totalPaid;

    const allPaid = account.installmentsList.every((i) => i.status === 'pago');
    const somePaid = account.installmentsList.some((i) => i.status === 'pago' || i.status === 'parcial');

    if (allPaid) {
      account.status = 'pago';
      account.paidAt = new Date();
    } else if (somePaid) {
      account.status = 'parcial';
    }

    await this.accountRepo.save(account);
  }

  /**
   * Sync existing sales that don't have financial records yet.
   */
  async syncExistingSales(userId: string): Promise<{ synced: number; skipped: number }> {
    // Find sales without accounts_receivable
    const sales = await this.accountRepo.manager.query(`
      SELECT s.* FROM sales s 
      LEFT JOIN accounts_receivable ar ON ar.sale_id = s.id 
      WHERE ar.id IS NULL AND s.status != 'cancelado'
      ORDER BY s.created_at ASC
    `);

    let synced = 0;
    let skipped = 0;

    for (const sale of sales) {
      try {
        // Map raw query result to Sale-like object
        const saleObj = {
          id: sale.id,
          customerId: sale.customer_id,
          totalAmount: sale.total_amount,
          paymentMethod: sale.payment_method,
          installments: sale.installments || 1,
          dueDay: sale.due_day,
          status: sale.status,
        } as any;

        await this.createFromSale(saleObj, userId);
        synced++;
      } catch {
        skipped++;
      }
    }

    return { synced, skipped };
  }
}
