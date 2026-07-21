import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { AccountReceivable } from './account-receivable.entity';
import { CostCenter } from './cost-center.entity';
import { ChartAccount } from './chart-account.entity';
import { BankAccount } from './bank-account.entity';

@Entity('financial_movements')
export class FinancialMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: string; // receita | despesa | estorno

  @Column({ type: 'varchar', length: 50 })
  category: string; // venda | comissao | taxa_cartao | estorno | devolucao | outros

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'sale_id', type: 'uuid', nullable: true })
  saleId: string;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string;

  @Column({ name: 'installment_id', type: 'uuid', nullable: true })
  installmentId: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod: string;

  @Column({ name: 'bank_account', type: 'varchar', length: 100, nullable: true })
  bankAccount: string;

  @Column({ name: 'bank_account_id', type: 'uuid', nullable: true })
  bankAccountId: string;

  @Column({ name: 'cost_center_id', type: 'uuid', nullable: true })
  costCenterId: string;

  @Column({ name: 'chart_account_id', type: 'uuid', nullable: true })
  chartAccountId: string;

  @Column({ name: 'competence_date', type: 'date', nullable: true })
  competenceDate: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType: string;

  @Column({ name: 'is_forecast', type: 'boolean', default: false })
  isForecast: boolean;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ name: 'recurring_group_id', type: 'varchar', length: 100, nullable: true })
  recurringGroupId: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => AccountReceivable, (account) => account.movements)
  @JoinColumn({ name: 'account_id' })
  account: AccountReceivable;

  @ManyToOne(() => CostCenter)
  @JoinColumn({ name: 'cost_center_id' })
  costCenter: CostCenter;

  @ManyToOne(() => ChartAccount)
  @JoinColumn({ name: 'chart_account_id' })
  chartAccount: ChartAccount;

  @ManyToOne(() => BankAccount)
  @JoinColumn({ name: 'bank_account_id' })
  bankAccountRef: BankAccount;
}
