import { Injectable, NotFoundException, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, Between, LessThan, In, DataSource } from 'typeorm';
import { AccountReceivable } from './entities/account-receivable.entity';
import { Installment } from './entities/installment.entity';
import { FinancialMovement } from './entities/financial-movement.entity';
import { CardFee } from './entities/card-fee.entity';
import { CustomerCredit } from './entities/customer-credit.entity';
import { Sale } from '../sales/entities/sale.entity';
import { AuditService } from '../audit/audit.service';
import { CostCenter } from './entities/cost-center.entity';
import { ChartAccount } from './entities/chart-account.entity';
import { BankAccount } from './entities/bank-account.entity';
import { MonthlyClosing } from './entities/monthly-closing.entity';
import { InstallmentPayment } from './entities/installment-payment.entity';
import { AccountPayable } from './entities/account-payable.entity';

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

    if (process.env.FINANCIAL_JOBS_ENABLED !== 'false') {
      const minutes = Math.max(Number(process.env.FINANCIAL_JOBS_INTERVAL_MINUTES || 60), 15);
      setTimeout(() => this.runFinancialJobs('startup'), 25000);
      setInterval(() => this.runFinancialJobs('interval'), minutes * 60 * 1000);
    }
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
    @InjectRepository(CostCenter)
    private readonly costCenterRepo: Repository<CostCenter>,
    @InjectRepository(ChartAccount)
    private readonly chartAccountRepo: Repository<ChartAccount>,
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    @InjectRepository(MonthlyClosing)
    private readonly monthlyClosingRepo: Repository<MonthlyClosing>,
    @InjectRepository(InstallmentPayment)
    private readonly installmentPaymentRepo: Repository<InstallmentPayment>,
    @InjectRepository(AccountPayable)
    private readonly payableRepo: Repository<AccountPayable>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates financial records when a sale is created.
   * Handles different payment methods with appropriate logic.
   */
  async createFromSale(sale: Sale, userId: string, manager?: EntityManager): Promise<AccountReceivable> {
    const accountRepo = manager?.getRepository(AccountReceivable) || this.accountRepo;
    const installmentRepo = manager?.getRepository(Installment) || this.installmentRepo;
    const movementRepo = manager?.getRepository(FinancialMovement) || this.movementRepo;
    const cardFeeRepo = manager?.getRepository(CardFee) || this.cardFeeRepo;
    const paymentRepo = manager?.getRepository(InstallmentPayment) || this.installmentPaymentRepo;
    const existing = await accountRepo.findOne({ where: { saleId: sale.id } });
    if (existing) return existing;
    const now = new Date();
    const isImmediate = sale.paymentStatus === 'pago' || ['dinheiro', 'cartao_debito'].includes(sale.paymentMethod);
    const isCard = ['cartao_credito', 'cartao_debito'].includes(sale.paymentMethod);

    // Create account receivable
    const account = accountRepo.create({
      saleId: sale.id,
      customerId: sale.customerId,
      description: `Venda #${sale.id.substring(0, 8)}`,
      totalValue: sale.totalAmount,
      paidValue: isImmediate ? sale.totalAmount : 0,
      pendingValue: isImmediate ? 0 : sale.totalAmount,
      installments: sale.installments || 1,
      paymentMethod: sale.paymentMethod,
      status: isImmediate ? 'pago' : 'pendente',
      dueDate: isImmediate ? this.formatLocalDate(now) : this.calculateDueDate(sale, now),
      paidAt: isImmediate ? now : null,
      createdBy: userId,
    });

    const savedAccount = await accountRepo.save(account);

    // Get card fee info if applicable
    let cardFee: CardFee | null = null;
    if (isCard) {
      cardFee = await this.getCardFee(sale.paymentMethod, sale.installments || 1, cardFeeRepo);
    }

    // Create installments
    const installments = this.generateInstallments(sale, savedAccount, now, cardFee);
    const savedInstallments = await installmentRepo.save(installments);

    // Create financial movements
    await this.createMovementsFromSale(sale, savedAccount, userId, now, cardFee, movementRepo);
    if (isImmediate) {
      const movement = await movementRepo.findOne({ where: { saleId: sale.id, accountId: savedAccount.id, category: 'venda', isForecast: false } });
      if (movement) await paymentRepo.save(savedInstallments.map((installment) => paymentRepo.create({ installmentId: installment.id, movementId: movement.id, idempotencyKey: 'sale-create:' + sale.id + ':' + installment.id, value: Number(installment.value), paymentMethod: sale.paymentMethod, paidAt: now, createdBy: userId })));
    }
    if (isImmediate) await (manager?.getRepository(Sale) || this.dataSource.getRepository(Sale)).update(sale.id, { status: 'pago' as any, paymentStatus: 'pago', billingStatus: 'pago' });

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
    options?: { bankAccountId?: string; paidAt?: string; observations?: string; idempotencyKey?: string },
    transactionManager?: EntityManager,
  ): Promise<Installment> {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) throw new BadRequestException('Valor do pagamento deve ser positivo');
    const paidAt = options?.paidAt ? new Date(options.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Data de pagamento inválida');
    const period = paidAt.toISOString().slice(0, 7);

    const execute = async (manager: EntityManager) => {
      const closed = await manager.getRepository(MonthlyClosing).findOne({ where: { period } });
      if (closed) throw new BadRequestException(`Período ${period} já está fechado para edição`);
      const paymentRepo = manager.getRepository(InstallmentPayment);
      if (options?.idempotencyKey) {
        const duplicate = await paymentRepo.findOne({ where: { idempotencyKey: options.idempotencyKey }, relations: ['installment'] });
        if (duplicate) return { installment: duplicate.installment, oldData: null, duplicate: true };
      }
      const installmentRepo = manager.getRepository(Installment);
      const installment = await installmentRepo.findOne({ where: { id: installmentId }, relations: ['account'], lock: { mode: 'pessimistic_write' } });
      if (!installment) throw new NotFoundException('Parcela não encontrada');
      if (['pago', 'cancelado'].includes(installment.status)) throw new BadRequestException('Parcela já está paga ou cancelada');
      const oldData = { ...installment };
      const remaining = Number(installment.value) - Number(installment.paidValue);
      if (Number(value) > remaining + 0.001) throw new BadRequestException(`Valor excede o saldo da parcela (R$ ${remaining.toFixed(2)})`);
      const newPaidValue = Number(installment.paidValue) + Number(value);
      installment.paidValue = newPaidValue;
      installment.status = newPaidValue + 0.001 >= Number(installment.value) ? 'pago' : 'parcial';
      installment.paidAt = installment.status === 'pago' ? paidAt : null;
      installment.paymentMethod = paymentMethod;
      await installmentRepo.save(installment);
      const movementRepo = manager.getRepository(FinancialMovement);
      const movement = await movementRepo.save(movementRepo.create({ type: 'receita', category: 'venda', description: `Pagamento parcela ${installment.number}`, value: Number(value), date: paidAt.toISOString().split('T')[0], competenceDate: installment.competenceDate || installment.dueDate, dueDate: installment.dueDate, paidAt, saleId: installment.saleId, accountId: installment.accountId, installmentId: installment.id, paymentMethod, bankAccountId: options?.bankAccountId || null, isForecast: false, createdBy: userId }));
      await paymentRepo.save(paymentRepo.create({ installmentId: installment.id, movementId: movement.id, idempotencyKey: options?.idempotencyKey || null, value: Number(value), paymentMethod, bankAccountId: options?.bankAccountId || null, paidAt, observations: options?.observations || null, createdBy: userId }));
      const totals = await installmentRepo.createQueryBuilder('i').select('COALESCE(SUM(i.paidValue),0)', 'paid').addSelect('COALESCE(SUM(i.value),0)', 'total').where('i.accountId = :accountId', { accountId: installment.accountId }).getRawOne();
      const paid = Number(totals.paid); const total = Number(totals.total); const fullyPaid = paid + 0.001 >= total;
      const forecasts = await movementRepo.find({ where: { saleId: installment.saleId, category: 'venda', isForecast: true } });
      for (const forecast of forecasts) { if (fullyPaid) await movementRepo.remove(forecast); else { forecast.value = Math.max(0, total-paid); await movementRepo.save(forecast); } }
      await manager.getRepository(AccountReceivable).update(installment.accountId, { paidValue: paid, pendingValue: Math.max(0, total-paid), status: fullyPaid ? 'pago' : paid > 0 ? 'parcial' : 'pendente', paidAt: fullyPaid ? paidAt : null });
      if (fullyPaid) {
        await manager.getRepository(Sale).update(installment.saleId, { status: 'pago' as any, paymentStatus: 'pago', billingStatus: 'pago' });
        await manager.query(`UPDATE payments SET status='pago', paid_at=COALESCE(paid_at,$2), account_id=COALESCE(account_id,$3), updated_at=NOW() WHERE sale_id=$1 AND status<>'cancelado'`, [installment.saleId, paidAt, installment.accountId]);
      }
      else if (paid > 0) await manager.getRepository(Sale).update(installment.saleId, { paymentStatus: 'parcial' });
      return { installment, oldData, duplicate: false };
    };
    const result = transactionManager ? await execute(transactionManager) : await this.dataSource.transaction(execute);
    if (!result.duplicate) await this.auditService.safeCreate({ userId, action: 'financial.installment_paid', entity: 'installment', entityId: result.installment.id, oldData: result.oldData, newData: { paidValue: result.installment.paidValue, status: result.installment.status, paymentMethod, value, idempotencyKey: options?.idempotencyKey } });
    return result.installment;
  }
  async settleSale(saleId: string, paymentMethod: string, userId: string, idempotencyKey: string, paidAt = new Date(), bankAccountId?: string, transactionManager?: EntityManager): Promise<void> {
    if (!idempotencyKey) throw new BadRequestException('Chave de idempotência obrigatória');
    const execute = async (manager: EntityManager) => {
      const sale = await manager.getRepository(Sale).findOne({ where: { id: saleId }, lock: { mode: 'pessimistic_write' } });
      if (!sale) throw new NotFoundException('Venda não encontrada');
      if (sale.operationalStatus === 'cancelada' || sale.status === 'cancelado' as any) throw new BadRequestException('Venda cancelada não pode receber pagamento');
      let account = await manager.getRepository(AccountReceivable).findOne({ where: { saleId }, lock: { mode: 'pessimistic_write' } });
      if (!account) account = await this.createFromSale(sale, userId || null, manager);
      const installments = await manager.getRepository(Installment).find({ where: { accountId: account.id }, order: { number: 'ASC' } });
      const movementRepo = manager.getRepository(FinancialMovement); const paymentRepo = manager.getRepository(InstallmentPayment);
      const saleForecasts = await movementRepo.find({ where: { saleId, category: 'venda', isForecast: true } });
      if (saleForecasts.length) await movementRepo.remove(saleForecasts);
      for (const installment of installments) {
        const key = `${idempotencyKey}:${installment.id}`.slice(0, 100);
        if (await paymentRepo.findOne({ where: { idempotencyKey: key } })) continue;
        const remaining = Math.max(0, Number(installment.value) - Number(installment.paidValue)); if (remaining <= 0) continue;
        let movement = await movementRepo.findOne({ where: { installmentId: installment.id, isForecast: true } });
        if (movement) { movement.isForecast = false; movement.date = paidAt.toISOString().split('T')[0]; movement.paidAt = paidAt; movement.paymentMethod = paymentMethod; movement.value = remaining; movement = await movementRepo.save(movement); }
        else movement = await movementRepo.save(movementRepo.create({ type: 'receita', category: 'venda', description: `Recebimento venda ${saleId}`, value: remaining, date: paidAt.toISOString().split('T')[0], paidAt, saleId, accountId: account.id, installmentId: installment.id, paymentMethod, bankAccountId: bankAccountId || null, isForecast: false, createdBy: userId || null }));
        installment.paidValue = Number(installment.value); installment.status = 'pago'; installment.paidAt = paidAt; installment.paymentMethod = paymentMethod;
        await manager.getRepository(Installment).save(installment);
        await paymentRepo.save(paymentRepo.create({ installmentId: installment.id, movementId: movement.id, idempotencyKey: key, value: remaining, paymentMethod, bankAccountId: bankAccountId || null, paidAt, createdBy: userId || null }));
      }
      account.paidValue = Number(account.totalValue); account.pendingValue = 0; account.status = 'pago'; account.paidAt = paidAt; await manager.getRepository(AccountReceivable).save(account);
      sale.status = 'pago' as any; sale.paymentStatus = 'pago'; sale.billingStatus = 'pago';
      await manager.getRepository(Sale).save(sale);
      await manager.query(`UPDATE payments SET status='pago', paid_at=COALESCE(paid_at,$2), account_id=COALESCE(account_id,$3), updated_at=NOW() WHERE sale_id=$1 AND status<>'cancelado'`, [saleId, paidAt, account.id]);
    };
    if (transactionManager) await execute(transactionManager); else await this.dataSource.transaction(execute);
    await this.auditService.safeCreate({ userId: userId || null, action: 'financial.sale_settled', entity: 'sale', entityId: saleId, newData: { paymentMethod, idempotencyKey, paidAt } });
  }
  /**
   * Cancel an account receivable and its pending installments.
   */
  async cancelAccount(accountId: string, reason: string, userId: string): Promise<AccountReceivable> {
    if (!reason?.trim()) throw new BadRequestException('Motivo do cancelamento obrigatório');
    const result = await this.dataSource.transaction(async (manager) => {
      const accountRepo=manager.getRepository(AccountReceivable), installmentRepo=manager.getRepository(Installment), movementRepo=manager.getRepository(FinancialMovement);
      const account=await accountRepo.findOne({where:{id:accountId},relations:['installmentsList'],lock:{mode:'pessimistic_write'}});
      if (!account) throw new NotFoundException('Conta a receber não encontrada');
      if (account.status==='cancelado') throw new BadRequestException('Conta já está cancelada');
      const oldData={...account};
      for (const installment of account.installmentsList.filter(i=>['pendente','parcial','vencido'].includes(i.status))) { installment.status='cancelado'; await installmentRepo.save(installment); }
      account.status='cancelado'; account.canceledAt=new Date(); account.cancelReason=reason.trim(); account.pendingValue=0; await accountRepo.save(account);
      if (Number(account.paidValue)>0) await movementRepo.save(movementRepo.create({type:'estorno',category:'estorno',description:`Cancelamento: ${reason.trim()}`,value:Number(account.paidValue),date:new Date().toISOString().split('T')[0],saleId:account.saleId,accountId:account.id,paymentMethod:account.paymentMethod,isForecast:false,createdBy:userId,referenceId:account.id,referenceType:'account_receivable_cancellation'}));
      await manager.query(`UPDATE payments SET status='cancelado',updated_at=NOW() WHERE sale_id=$1 AND status<>'cancelado'`,[account.saleId]);
      const sale=await manager.getRepository(Sale).findOne({where:{id:account.saleId},lock:{mode:'pessimistic_write'}});
      if (sale) { sale.paymentStatus='cancelado'; sale.billingStatus='cancelado'; if (sale.status==='pago' as any) sale.status='pendente' as any; await manager.getRepository(Sale).save(sale); }
      return {account,oldData};
    });
    await this.auditService.safeCreate({userId,action:'financial.account_cancelled',entity:'account_receivable',entityId:result.account.id,oldData:result.oldData,newData:{status:result.account.status,cancelReason:reason.trim(),pendingValue:0}});
    return result.account;
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

    const saved = await this.creditRepo.save(credit);
    await this.auditService.safeCreate({
      userId,
      action: 'financial.customer_credit_created',
      entity: 'customer_credit',
      entityId: saved.id,
      newData: saved,
    });
    return saved;
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

  async repairPaidPaymentIntegrity(source = 'manual'): Promise<{ checked: number; repaired: number; failed: number; details: any[] }> {
    const rows = await this.dataSource.query(`
      SELECT p.id, p.sale_id, p.type, p.codigo_solicitacao, p.paid_at, p.installment_id, p.value,
             s.payment_status, s.billing_status, a.status AS account_status
      FROM payments p
      JOIN sales s ON s.id=p.sale_id
      LEFT JOIN accounts_receivable a ON a.sale_id=p.sale_id
      WHERE p.status='pago'
        AND (
          -- Pagamento de parcela isolada: só reparar se a própria parcela ainda não reflete o pagamento
          (p.installment_id IS NOT NULL AND EXISTS (SELECT 1 FROM installments i WHERE i.id=p.installment_id AND (i.status<>'pago' OR i.paid_value<i.value)))
          OR
          -- Pagamento de venda inteira (sem parcela isolada): reparar se a venda/conta não refletem o pagamento
          (p.installment_id IS NULL AND (s.payment_status<>'pago' OR s.billing_status<>'pago' OR a.id IS NULL OR a.status<>'pago' OR EXISTS (SELECT 1 FROM installments i WHERE i.account_id=a.id AND (i.status<>'pago' OR i.paid_value<i.value)) OR EXISTS (SELECT 1 FROM financial_movements fm WHERE fm.sale_id=s.id AND fm.category='venda' AND fm.is_forecast=true)))
        )
        AND COALESCE(s.operational_status,'')<>'cancelada' AND s.status<>'cancelado'
      ORDER BY p.paid_at DESC NULLS LAST, p.updated_at DESC
      LIMIT 500
    `);
    let repaired=0, failed=0; const details:any[]=[];
    for (const row of rows) {
      try {
        const paidAt=row.paid_at ? new Date(row.paid_at) : new Date();
        const resolvedPaidAt = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;
        if (row.installment_id) {
          await this.payInstallment(row.installment_id, Number(row.value), row.type||'boleto', null as any, { paidAt: resolvedPaidAt.toISOString(), idempotencyKey: `repair:${row.id}` });
        } else {
          await this.settleSale(row.sale_id,row.type||'boleto',null as any,`repair:${row.id}`,resolvedPaidAt);
        }
        repaired++; details.push({saleId:row.sale_id,paymentId:row.id,status:'reparado'});
      } catch (error) { failed++; details.push({saleId:row.sale_id,paymentId:row.id,status:'erro',error:error instanceof Error?error.message:String(error)}); }
    }
    if (rows.length) await this.auditService.safeCreate({userId:null,action:'financial.paid_integrity_repaired',entity:'payment',entityId:null,newData:{source,checked:rows.length,repaired,failed,details}});
    return {checked:rows.length,repaired,failed,details};
  }

  async runFinancialJobs(source = 'manual') {
    const paidIntegrity = await this.repairPaidPaymentIntegrity(source);
    const overdue = await this.getOverdue();
    if (overdue.length > 0) {
      await this.auditService.safeCreate({
        userId: null,
        action: 'financial.overdue_detected',
        entity: 'installment',
        entityId: null,
        newData: {
          source,
          count: overdue.length,
          total: overdue.reduce((sum, item) => sum + (Number(item.value) - Number(item.paidValue)), 0),
        },
      });
    }
    return { overdue: overdue.length, paidIntegrity };
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
    page?: number;
    limit?: number;
  }) {
    const query = this.accountRepo.createQueryBuilder('account')
      .leftJoinAndSelect('account.customer', 'customer')
      .leftJoinAndSelect('account.installmentsList', 'installments')
      .leftJoinAndSelect('account.sale', 'sale')
      .orderBy('account.createdAt', 'DESC');

    if (filters?.status) {
      query.andWhere('account.status = :status', { status: filters.status });
    }
    if (filters?.customerId) {
      query.andWhere('account.customerId = :customerId', { customerId: filters.customerId });
    }
    // Filtra pela data de vencimento (dueDate), nao pela data de criacao — a coluna "Vencimento"
    // exibida na tela e o dueDate, entao filtrar por createdAt fazia contas com vencimento no mes
    // selecionado ficarem de fora (e mostrava contas de outros meses) sempre que a conta tivesse
    // sido criada num mes diferente do seu proprio vencimento (ex.: parcelamento de venda antiga).
    if (filters?.startDate) {
      query.andWhere('account.dueDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query.andWhere('account.dueDate <= :endDate', { endDate: filters.endDate });
    }
    if (filters?.paymentMethod) {
      query.andWhere('account.paymentMethod = :paymentMethod', { paymentMethod: filters.paymentMethod });
    }

    if (filters?.page || filters?.limit) { const page = Math.max(filters.page || 1, 1); const limit = Math.min(Math.max(filters.limit || 50, 1), 100); return query.skip((page-1)*limit).take(limit).getManyAndCount().then(async ([data,total]) => ({ data: await this.attachInvoiceNumbers(data), total, page, limit })); }
    return this.attachInvoiceNumbers(await query.take(500).getMany());
  }

  private async attachInvoiceNumbers(accounts: AccountReceivable[]): Promise<AccountReceivable[]> {
    const saleIds = accounts.map(a => a.saleId).filter(Boolean);
    if (!saleIds.length) return accounts;
    const invoices = await this.dataSource.query(
      `SELECT DISTINCT ON (sale_id) sale_id, number, series, type FROM invoices WHERE sale_id = ANY($1) AND status='autorizada' ORDER BY sale_id, issued_at DESC NULLS LAST, created_at DESC`,
      [saleIds],
    );
    const invoiceBySale = new Map(invoices.map((i: any) => [i.sale_id, i]));
    return accounts.map(account => {
      const invoice: any = invoiceBySale.get(account.saleId);
      return { ...account, invoiceNumber: invoice?.number ?? null, invoiceType: invoice?.type ?? null } as AccountReceivable & { invoiceNumber: number | null; invoiceType: string | null };
    });
  }

  async findAccountBySale(saleId: string) {
    return this.accountRepo.findOne({ where: { saleId }, relations: ['customer', 'installmentsList'] });
  }
  /**
   * List installments with filters.
   */
  async findInstallments(filters?: {
    status?: string;
    accountId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
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

    if (filters?.page || filters?.limit) { const page = Math.max(filters.page || 1, 1); const limit = Math.min(Math.max(filters.limit || 50, 1), 100); return query.skip((page-1)*limit).take(limit).getManyAndCount().then(([data,total]) => ({ data,total,page,limit })); }
    return query.take(500).getMany();
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
    const saved = await this.movementRepo.save(movement);
    await this.auditService.safeCreate({
      userId: data.createdBy,
      action: 'financial.movement_created',
      entity: 'financial_movement',
      entityId: saved.id,
      newData: saved,
    });
    return saved;
  }

  async createManualMovement(data: any, userId: string) {
    await this.ensurePeriodOpen(data.competenceDate || data.date);
    const movement = this.movementRepo.create({
      ...data,
      createdBy: userId,
      isForecast: data.isForecast || false,
      isRecurring: data.isRecurring || false,
    });
    const saved = await this.movementRepo.save(movement);
    const savedMovement = Array.isArray(saved) ? saved[0] : saved;
    await this.auditService.safeCreate({
      userId,
      action: 'financial.manual_movement_created',
      entity: 'financial_movement',
      entityId: savedMovement.id,
      newData: savedMovement,
    });
    return savedMovement;
  }

  /**
   * Cria despesa recorrente (mensal).
   * Gera lançamentos individuais para cada mês no período especificado.
   * Cada mês tem seu próprio registro e pode ser editado independentemente.
   */
  async createRecurringMovement(data: any, userId: string): Promise<{ created: number; groupId: string }> {
    const months = data.months || 12; // Quantos meses gerar (padrão 12)
    const groupId = 'REC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const baseDate = new Date(data.date + 'T12:00:00');
    let created = 0;

    for (let i = 0; i < months; i++) {
      const movDate = new Date(baseDate);
      movDate.setMonth(movDate.getMonth() + i);
      const dateStr = movDate.toISOString().split('T')[0];

      const movement = this.movementRepo.create({
        type: data.type || 'despesa',
        category: data.category || 'outros',
        description: data.description || 'Despesa recorrente',
        value: Number(data.value),
        date: dateStr,
        paymentMethod: data.paymentMethod || 'transferencia',
        isForecast: i > 0, // Primeiro mês é real, demais são previsão
        isRecurring: true,
        recurringGroupId: groupId,
        observations: data.observations || null,
        createdBy: userId,
      });

      await this.movementRepo.save(movement);
      created++;
    }

    await this.auditService.safeCreate({
      userId,
      action: 'financial.recurring_movements_created',
      entity: 'financial_movement',
      entityId: groupId,
      newData: { groupId, created, data },
    });
    return { created, groupId };
  }

  async updateMovement(id: string, data: any, userId?: string) {
    const movement = await this.movementRepo.findOne({ where: { id } });
    if (!movement) throw new NotFoundException('Lançamento não encontrado');
    await this.ensurePeriodOpen(movement.competenceDate || movement.date);
    if (data.date || data.competenceDate) {
      await this.ensurePeriodOpen(data.competenceDate || data.date);
    }
    if (!movement.isForecast) throw new BadRequestException('Lançamento realizado é imutável; faça um estorno');
    // Atualiza apenas o lançamento específico (não afeta outros meses do grupo)
    const oldData = { ...movement };
    Object.assign(movement, data);
    const saved = await this.movementRepo.save(movement);
    await this.auditService.safeCreate({
      userId,
      action: 'financial.movement_updated',
      entity: 'financial_movement',
      entityId: id,
      oldData,
      newData: data,
    });
    return saved;
  }

  async deleteMovement(id: string, userId?: string) {
    const movement = await this.movementRepo.findOne({ where: { id } });
    if (!movement) throw new NotFoundException('Lançamento não encontrado');
    await this.ensurePeriodOpen(movement.competenceDate || movement.date);
    await this.movementRepo.remove(movement);
    await this.auditService.safeCreate({
      userId,
      action: 'financial.movement_deleted',
      entity: 'financial_movement',
      entityId: id,
      oldData: movement,
      newData: { deleted: true },
    });
    return { message: 'Lançamento removido' };
  }

  async deleteCardFee(id: string) {
    const fee = await this.cardFeeRepo.findOne({ where: { id } });
    if (!fee) {
      throw new NotFoundException('Taxa não encontrada');
    }
    await this.cardFeeRepo.remove(fee);
    return { message: 'Taxa removida com sucesso' };
  }

  async listCostCenters() {
    return this.costCenterRepo.find({ order: { code: 'ASC' } });
  }

  async saveCostCenter(data: Partial<CostCenter>, userId?: string) {
    const entity = data.id
      ? Object.assign(await this.costCenterRepo.findOne({ where: { id: data.id } }), data)
      : this.costCenterRepo.create(data);
    if (!entity) throw new NotFoundException('Centro de custo não encontrado');
    const saved = await this.costCenterRepo.save(entity);
    await this.auditService.safeCreate({
      userId,
      action: data.id ? 'financial.cost_center_updated' : 'financial.cost_center_created',
      entity: 'cost_center',
      entityId: saved.id,
      newData: saved,
    });
    return saved;
  }

  async listChartAccounts() {
    return this.chartAccountRepo.find({ order: { code: 'ASC' } });
  }

  async saveChartAccount(data: Partial<ChartAccount>, userId?: string) {
    const entity = data.id
      ? Object.assign(await this.chartAccountRepo.findOne({ where: { id: data.id } }), data)
      : this.chartAccountRepo.create(data);
    if (!entity) throw new NotFoundException('Conta contábil não encontrada');
    const saved = await this.chartAccountRepo.save(entity);
    await this.auditService.safeCreate({
      userId,
      action: data.id ? 'financial.chart_account_updated' : 'financial.chart_account_created',
      entity: 'chart_account',
      entityId: saved.id,
      newData: saved,
    });
    return saved;
  }

  async listBankAccounts() {
    return this.bankAccountRepo.find({ order: { name: 'ASC' } });
  }

  async saveBankAccount(data: Partial<BankAccount>, userId?: string) {
    const entity = data.id
      ? Object.assign(await this.bankAccountRepo.findOne({ where: { id: data.id } }), data)
      : this.bankAccountRepo.create(data);
    if (!entity) throw new NotFoundException('Conta bancária/caixa não encontrada');
    const saved = await this.bankAccountRepo.save(entity);
    await this.auditService.safeCreate({
      userId,
      action: data.id ? 'financial.bank_account_updated' : 'financial.bank_account_created',
      entity: 'bank_account',
      entityId: saved.id,
      newData: saved,
    });
    return saved;
  }

  async listInstallmentPayments(installmentId: string) {
    return this.installmentPaymentRepo.find({
      where: { installmentId },
      order: { paidAt: 'ASC' },
    });
  }

  async listPayables(filters?: { status?: string; startDate?: string; endDate?: string }) {
    const query = this.payableRepo.createQueryBuilder('payable').orderBy('payable.dueDate', 'ASC');
    if (filters?.status) query.andWhere('payable.status = :status', { status: filters.status });
    if (filters?.startDate) query.andWhere('payable.dueDate >= :startDate', { startDate: filters.startDate });
    if (filters?.endDate) query.andWhere('payable.dueDate <= :endDate', { endDate: filters.endDate });
    return query.getMany();
  }

  async createPayable(data: Partial<AccountPayable>, userId?: string) {
    await this.ensurePeriodOpen(data.competenceDate || data.dueDate || new Date().toISOString().split('T')[0]);
    const value = Number(data.totalValue || 0);
    const payable = this.payableRepo.create({
      ...data,
      totalValue: value,
      paidValue: Number(data.paidValue || 0),
      pendingValue: value - Number(data.paidValue || 0),
      createdBy: userId || data.createdBy,
    });
    const saved = await this.payableRepo.save(payable);
    await this.auditService.safeCreate({
      userId,
      action: 'financial.payable_created',
      entity: 'account_payable',
      entityId: saved.id,
      newData: saved,
    });
    return saved;
  }

  async payPayable(id: string, body: any, userId: string, idempotencyKey?: string) {
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Data de pagamento inválida');
    await this.ensurePeriodOpen(paidAt.toISOString().split('T')[0]);
    const result = await this.dataSource.transaction(async (manager) => {
      const payableRepo = manager.getRepository(AccountPayable);
      const movementRepo = manager.getRepository(FinancialMovement);
      if (idempotencyKey) {
        const existing = await movementRepo.findOne({ where: { idempotencyKey } });
        if (existing) return payableRepo.findOne({ where: { id } });
      }
      const payable = await payableRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!payable) throw new NotFoundException('Conta a pagar não encontrada');
      if (['pago', 'cancelado', 'estornado'].includes(payable.status)) throw new BadRequestException('Conta a pagar não aceita nova baixa');
      const requested = body.value == null ? Number(payable.pendingValue) : Number(body.value);
      const value = Math.round(requested * 100) / 100;
      const pending = Math.round(Number(payable.pendingValue) * 100) / 100;
      if (!Number.isFinite(value) || value <= 0 || value > pending) throw new BadRequestException('Valor de baixa inválido');
      payable.paidValue = Math.round((Number(payable.paidValue) + value) * 100) / 100;
      payable.pendingValue = Math.round((Number(payable.totalValue) - Number(payable.paidValue)) * 100) / 100;
      payable.status = payable.pendingValue <= 0 ? 'pago' : 'parcial';
      payable.paidAt = payable.status === 'pago' ? paidAt : null;
      const saved = await payableRepo.save(payable);
      await movementRepo.save(movementRepo.create({ type: 'despesa', category: 'conta_pagar', description: `Baixa conta a pagar: ${payable.description}`, value, date: paidAt.toISOString().split('T')[0], competenceDate: payable.competenceDate, dueDate: payable.dueDate, paidAt, referenceId: payable.id, referenceType: 'account_payable', idempotencyKey: idempotencyKey || null, paymentMethod: body.paymentMethod, bankAccountId: body.bankAccountId || null, costCenterId: payable.costCenterId, chartAccountId: payable.chartAccountId, isForecast: false, createdBy: userId }));
      return saved;
    });
    await this.auditService.safeCreate({ userId, action: 'financial.payable_paid', entity: 'account_payable', entityId: id, newData: { value: body.value, status: result?.status, idempotencyKey: idempotencyKey || null } });
    return result;
  }

  async reverseMovement(id: string, reason: string, userId: string) {
    if (!reason?.trim()) throw new BadRequestException('Motivo do estorno obrigatório');
    const today = new Date().toISOString().split('T')[0]; await this.ensurePeriodOpen(today);
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FinancialMovement);
      const movement = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!movement) throw new NotFoundException('Lançamento não encontrado');
      if (movement.type === 'estorno') throw new BadRequestException('Um estorno não pode ser estornado diretamente');
      const existing = await repo.findOne({ where: { referenceId: id, referenceType: 'financial_movement_reversal' } });
      if (existing) return { reversal: existing, duplicate: true };
      const reversal = await repo.save(repo.create({ type: 'estorno', category: movement.category || 'estorno', description: `Estorno de ${movement.description || movement.id}: ${reason.trim()}`, value: Number(movement.value), date: today, competenceDate: movement.competenceDate, dueDate: movement.dueDate, referenceId: movement.id, referenceType: 'financial_movement_reversal', paymentMethod: movement.paymentMethod, bankAccountId: movement.bankAccountId, costCenterId: movement.costCenterId, chartAccountId: movement.chartAccountId, isForecast: false, createdBy: userId }));
      if (movement.accountId && movement.saleId) {
        const installmentRepo = manager.getRepository(Installment);
        const linked = await manager.query(`SELECT DISTINCT installment_id FROM installment_payments WHERE movement_id=$1`,[movement.id]);
        const affectedIds = Array.from(new Set([movement.installmentId,...linked.map((x:any)=>x.installment_id)].filter(Boolean))) as string[];
        for (const installmentId of affectedIds) {
          const installment = await installmentRepo.findOne({ where: { id: installmentId }, lock: { mode: 'pessimistic_write' } });
          if (!installment) continue;
          const net = await manager.query(`SELECT COALESCE(SUM(ip.value),0)::numeric paid FROM installment_payments ip WHERE ip.installment_id=$1 AND NOT EXISTS (SELECT 1 FROM financial_movements r WHERE r.reference_type='financial_movement_reversal' AND r.reference_id=ip.movement_id)`, [installment.id]);
          installment.paidValue = Number(net[0]?.paid || 0);
          installment.status = installment.paidValue <= 0 ? 'pendente' : installment.paidValue + 0.001 >= Number(installment.value) ? 'pago' : 'parcial';
          installment.paidAt = installment.status === 'pago' ? installment.paidAt : null;
          await installmentRepo.save(installment);
        }
        const totals = await installmentRepo.createQueryBuilder('i').select('COALESCE(SUM(i.paidValue),0)','paid').addSelect('COALESCE(SUM(i.value),0)','total').where('i.accountId=:accountId',{accountId:movement.accountId}).getRawOne();
        const paid=Number(totals.paid), total=Number(totals.total), fullyPaid=paid+0.001>=total;
        await manager.getRepository(AccountReceivable).update(movement.accountId,{paidValue:paid,pendingValue:Math.max(0,total-paid),status:fullyPaid?'pago':paid>0?'parcial':'pendente',paidAt:fullyPaid?movement.paidAt:null});
        const sale = await manager.getRepository(Sale).findOne({where:{id:movement.saleId},lock:{mode:'pessimistic_write'}});
        if (sale) { sale.paymentStatus=fullyPaid?'pago':paid>0?'parcial':'pendente'; if (!fullyPaid && sale.status === 'pago' as any) sale.status=(sale.billingStatus==='emitido'||sale.billingStatus==='pago'?'boleto_emitido':'pendente') as any; if (!fullyPaid && sale.billingStatus==='pago') sale.billingStatus='emitido'; await manager.getRepository(Sale).save(sale); }
      }
      return { reversal, duplicate: false };
    });
    if (!result.duplicate) await this.auditService.safeCreate({ userId, action: 'financial.movement_reversed', entity: 'financial_movement', entityId: id, newData: { reversalId: result.reversal.id, reason } });
    return result.reversal;
  }
  async closeMonth(period: string, userId: string, notes?: string) {
    if (!/^\\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Período inválido; use AAAA-MM');
    const existing = await this.monthlyClosingRepo.findOne({ where: { period } });
    if (existing?.status === 'fechado') return existing;
    if (existing) { existing.status = 'fechado'; existing.closedBy = userId; existing.closedAt = new Date(); existing.notes = notes || existing.notes; existing.reopenedBy = null; existing.reopenedAt = null; existing.reopenReason = null; return this.monthlyClosingRepo.save(existing); }
    const closing = await this.monthlyClosingRepo.save(this.monthlyClosingRepo.create({
      period,
      closedBy: userId,
      closedAt: new Date(),
      notes: notes || null,
    }));
    await this.auditService.safeCreate({
      userId,
      action: 'financial.month_closed',
      entity: 'monthly_closing',
      entityId: closing.id,
      newData: closing,
    });
    return closing;
  }

  async reopenMonth(period: string, userId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Justificativa de reabertura obrigatória');
    const closing = await this.monthlyClosingRepo.findOne({ where: { period } });
    if (!closing) throw new NotFoundException('Fechamento mensal não encontrado');
    const oldData = { ...closing };
    closing.status = 'reaberto';
    closing.reopenedBy = userId;
    closing.reopenedAt = new Date();
    closing.reopenReason = reason.trim();
    await this.monthlyClosingRepo.save(closing);
    await this.auditService.safeCreate({ userId, action: 'financial.month_reopened', entity: 'monthly_closing', entityId: closing.id, oldData, newData: closing });
    return { period, reopened: true };
  }
  async getIntegrityReport() {
    const rows = await this.dataSource.query(`
      SELECT s.id AS sale_id, s.status AS legacy_status, s.payment_status, s.fiscal_status, s.billing_status,
             a.status AS account_status, a.total_value, a.paid_value, a.pending_value,
             COALESCE(i.total,0) AS installments_total, COALESCE(i.paid,0) AS installments_paid,
             EXISTS(SELECT 1 FROM payments p WHERE p.sale_id=s.id AND p.status='pago') AS bank_paid,
             EXISTS(SELECT 1 FROM invoices n WHERE n.sale_id=s.id AND n.status='autorizada') AS invoice_authorized
      FROM sales s LEFT JOIN accounts_receivable a ON a.sale_id=s.id
      LEFT JOIN LATERAL (SELECT SUM(value) total, SUM(paid_value) paid FROM installments WHERE sale_id=s.id) i ON true
      WHERE s.archived_at IS NULL AND (
        (a.id IS NULL) OR ABS(COALESCE(a.total_value,0)-COALESCE(i.total,0)) > 0.01 OR ABS(COALESCE(a.paid_value,0)-COALESCE(i.paid,0)) > 0.01 OR
        (s.payment_status='pago') <> (a.status='pago') OR
        (EXISTS(SELECT 1 FROM payments p WHERE p.sale_id=s.id AND p.status='pago') AND a.status<>'pago') OR
        (EXISTS(SELECT 1 FROM invoices n WHERE n.sale_id=s.id AND n.status='autorizada') AND s.fiscal_status<>'autorizada')
      ) ORDER BY s.created_at DESC LIMIT 500`);
    return { consistent: rows.length === 0, divergences: rows.length, items: rows };
  }
  async listClosings() {
    return this.monthlyClosingRepo.find({ order: { period: 'DESC' } });
  }

  async getCashFlowSeparated(startDate: string, endDate: string) {
    const movements = await this.findMovements({ startDate, endDate });
    const totals = (items: FinancialMovement[]) => ({
      receitas: items.filter((m) => m.type === 'receita').reduce((sum, m) => sum + Number(m.value), 0),
      despesas: items.filter((m) => m.type === 'despesa').reduce((sum, m) => sum + Number(m.value), 0),
      estornos: items.filter((m) => m.type === 'estorno').reduce((sum, m) => sum + Number(m.value), 0),
    });
    const projected = movements.filter((m) => m.isForecast);
    const realized = movements.filter((m) => !m.isForecast);
    return {
      period: { startDate, endDate },
      projected: { totals: totals(projected), movements: projected },
      realized: { totals: totals(realized), movements: realized },
    };
  }

  async getProjectedCashFlow(startDate: string, endDate: string, granularity: 'day' | 'week' | 'month' = 'day') {
    if (!startDate || !endDate) throw new BadRequestException('Informe startDate e endDate');
    const trunc = granularity === 'month' ? 'month' : granularity === 'week' ? 'week' : 'day';
    const sql = `WITH projected_in AS (SELECT date_trunc($3, due_date::timestamp) bucket, SUM(pending_value)::numeric value FROM accounts_receivable WHERE due_date BETWEEN $1 AND $2 AND status IN ('pendente','parcial','vencido') GROUP BY 1), projected_out AS (SELECT date_trunc($3, due_date::timestamp) bucket, SUM(pending_value)::numeric value FROM accounts_payable WHERE due_date BETWEEN $1 AND $2 AND status IN ('pendente','parcial','vencido') GROUP BY 1), realized AS (SELECT date_trunc($3, date::timestamp) bucket, SUM(CASE WHEN type='receita' AND is_forecast=false THEN value ELSE 0 END)::numeric income, SUM(CASE WHEN type IN ('despesa','estorno') AND is_forecast=false THEN value ELSE 0 END)::numeric expense FROM financial_movements WHERE date BETWEEN $1 AND $2 GROUP BY 1), buckets AS (SELECT generate_series(date_trunc($3,$1::timestamp),date_trunc($3,$2::timestamp),CASE WHEN $3='month' THEN interval '1 month' WHEN $3='week' THEN interval '1 week' ELSE interval '1 day' END) bucket) SELECT b.bucket::date date, COALESCE(i.value,0)::numeric projected_income, COALESCE(o.value,0)::numeric projected_expense, COALESCE(r.income,0)::numeric realized_income, COALESCE(r.expense,0)::numeric realized_expense FROM buckets b LEFT JOIN projected_in i ON i.bucket=b.bucket LEFT JOIN projected_out o ON o.bucket=b.bucket LEFT JOIN realized r ON r.bucket=b.bucket ORDER BY b.bucket`;
    const rows = await this.dataSource.query(sql, [startDate, endDate, trunc]);
    let accumulated = 0;
    const series = rows.map((r: any) => {
      const projectedIncome=Number(r.projected_income), projectedExpense=Number(r.projected_expense), realizedIncome=Number(r.realized_income), realizedExpense=Number(r.realized_expense);
      accumulated += realizedIncome-realizedExpense;
      return { date:r.date, projectedIncome, projectedExpense, realizedIncome, realizedExpense, projectedBalance:projectedIncome-projectedExpense, realizedBalance:realizedIncome-realizedExpense, accumulatedRealized:accumulated, scenarios:{ optimistic:Number((projectedIncome-projectedExpense*0.95).toFixed(2)), realistic:Number((projectedIncome*0.85-projectedExpense).toFixed(2)), pessimistic:Number((projectedIncome*0.6-projectedExpense*1.1).toFixed(2)) } };
    });
    const overdue = await this.dataSource.query("SELECT COUNT(*)::int count, COALESCE(SUM(pending_value),0)::numeric total FROM accounts_receivable WHERE due_date < CURRENT_DATE AND status IN ('pendente','parcial','vencido')");
    const totals = series.reduce((a: any,x: any)=>{ for(const k of ['projectedIncome','projectedExpense','realizedIncome','realizedExpense','projectedBalance','realizedBalance']) a[k]+=x[k]; return a; },{projectedIncome:0,projectedExpense:0,realizedIncome:0,realizedExpense:0,projectedBalance:0,realizedBalance:0});
    return { period:{startDate,endDate,granularity}, totals, overdue:{count:Number(overdue[0]?.count||0),total:Number(overdue[0]?.total||0)}, series };
  }

  private async ensurePeriodOpen(date?: string): Promise<void> {
    if (!date) return;
    const period = date.substring(0, 7);
    const closing = await this.monthlyClosingRepo.findOne({ where: { period } });
    if (closing?.status === 'fechado') {
      throw new BadRequestException(`Período ${period} já está fechado para edição`);
    }
  }

  // ==================== Private Helpers ====================

  private calculateDueDate(sale: Sale, now: Date): string {
    if (sale.paymentMethod === 'boleto') return this.getBoletoDueDate(sale, now, 1);
    return this.formatLocalDate(now);
  }

  getBoletoDueDate(sale: Sale, now: Date, installmentNumber = 1): string {
    if (sale.dueDate) {
      const [year, month, day] = String(sale.dueDate).split('-').map(Number);
      const explicit = new Date(year, month - 1, day, 12);
      explicit.setMonth(explicit.getMonth() + installmentNumber - 1, 1);
      const lastDay = new Date(explicit.getFullYear(), explicit.getMonth() + 1, 0).getDate();
      explicit.setDate(Math.min(day, lastDay));
      return this.formatLocalDate(explicit);
    }
    const dueDay = Math.min(31, Math.max(1, Number(sale.dueDay || now.getDate())));
    const first = new Date(now.getFullYear(), now.getMonth(), 1, 12);
    const currentMonthLastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    first.setDate(Math.min(dueDay, currentMonthLastDay));
    const minimumDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 12);
    if (first < minimumDate) first.setMonth(first.getMonth() + 1, 1);
    first.setMonth(first.getMonth() + installmentNumber - 1, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    first.setDate(Math.min(dueDay, lastDay));
    return this.formatLocalDate(first);
  }

  private formatLocalDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
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
    const isImmediate = sale.paymentStatus === 'pago' || ['dinheiro', 'cartao_debito'].includes(sale.paymentMethod);
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

    if (sale.paymentStatus === 'pago' || ['dinheiro', 'cartao_debito'].includes(sale.paymentMethod)) {
      return dueDate.toISOString().split('T')[0];
    }

    if (sale.paymentMethod === 'cartao_credito') {
      const daysToReceive = cardFee?.daysToReceive || 30;
      dueDate.setDate(dueDate.getDate() + daysToReceive * installmentNumber);
      return dueDate.toISOString().split('T')[0];
    }

    return this.getBoletoDueDate(sale, now, installmentNumber);
  }

  private async createMovementsFromSale(
    sale: Sale,
    account: AccountReceivable,
    userId: string,
    now: Date,
    cardFee: CardFee | null,
    movementRepo: Repository<FinancialMovement> = this.movementRepo,
  ): Promise<void> {
    const isImmediate = sale.paymentStatus === 'pago' || ['dinheiro', 'cartao_debito'].includes(sale.paymentMethod);
    const isCard = ['cartao_credito', 'cartao_debito'].includes(sale.paymentMethod);
    const today = now.toISOString().split('T')[0];

    if (isImmediate) {
      // Realized movement - full value received
      await movementRepo.save(
        movementRepo.create({
          type: 'receita',
          category: 'venda',
          description: `Venda #${sale.id.substring(0, 8)} - ${sale.paymentMethod}`,
          value: Number(sale.totalAmount),
          date: today,
          paidAt: now,
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

      await movementRepo.save(
        movementRepo.create({
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

      await movementRepo.save(
        movementRepo.create({
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

  private async getCardFee(paymentMethod: string, installments: number, repository: Repository<CardFee> = this.cardFeeRepo): Promise<CardFee | null> {
    const paymentType = paymentMethod === 'cartao_credito' ? 'credito' : 'debito';

    const fee = await repository
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
