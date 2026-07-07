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
import { SaleStatus } from '../../../common/enums/sale-status.enum';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';
import { User } from '../../users/entities/user.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { SaleItem } from './sale-item.entity';
import { Commission } from '../../commissions/entities/commission.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'technician_id' })
  technicianId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({
    type: 'varchar',
    default: SaleStatus.PENDENTE,
  })
  status: SaleStatus;

  @Column({
    name: 'payment_method',
    type: 'varchar',
  })
  paymentMethod: PaymentMethod;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'net_profit', type: 'decimal', precision: 10, scale: 2, default: 0 })
  netProfit: number;

  @Column({ name: 'commission_percentage', type: 'decimal', precision: 5, scale: 2, default: 5 })
  commissionPercentage: number;

  @Column({ name: 'commission_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  commissionAmount: number;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ type: 'int', default: 1 })
  installments: number;

  @Column({ name: 'due_day', type: 'int', nullable: true })
  dueDay: number;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ name: 'multa_percentage', type: 'decimal', precision: 5, scale: 2, default: 2.00 })
  multaPercentage: number;

  @Column({ name: 'mora_percentage', type: 'decimal', precision: 5, scale: 2, default: 0.03 })
  moraPercentage: number;

  @Column({ name: 'sale_type', type: 'varchar', default: 'eventual' })
  saleType: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.sales)
  @JoinColumn({ name: 'technician_id' })
  technician: User;

  @ManyToOne(() => Customer, (customer) => customer.sales)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];

  @OneToMany(() => Commission, (commission) => commission.sale)
  commissions: Commission[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;
}
