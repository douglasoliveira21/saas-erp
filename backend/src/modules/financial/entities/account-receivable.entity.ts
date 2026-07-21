import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Installment } from './installment.entity';
import { FinancialMovement } from './financial-movement.entity';

@Entity('accounts_receivable')
export class AccountReceivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id' })
  saleId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2 })
  totalValue: number;

  @Column({ name: 'paid_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidValue: number;

  @Column({ name: 'pending_value', type: 'decimal', precision: 10, scale: 2 })
  pendingValue: number;

  @Column({ type: 'int', default: 1 })
  installments: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: string; // pendente | parcial | pago | cancelado | vencido

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ name: 'competence_date', type: 'date', nullable: true })
  competenceDate: string;

  @Column({ name: 'cost_center_id', type: 'uuid', nullable: true })
  costCenterId: string;

  @Column({ name: 'chart_account_id', type: 'uuid', nullable: true })
  chartAccountId: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ name: 'canceled_at', type: 'timestamp', nullable: true })
  canceledAt: Date;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string;

  @Column({ name: 'reversed_at', type: 'timestamp', nullable: true })
  reversedAt: Date;

  @Column({ name: 'reversal_reason', type: 'text', nullable: true })
  reversalReason: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => Installment, (installment) => installment.account, { cascade: true })
  installmentsList: Installment[];

  @OneToMany(() => FinancialMovement, (movement) => movement.account)
  movements: FinancialMovement[];
}
