import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CommissionStatus } from '../../../common/enums/commission-status.enum';
import { CommissionType } from '../../../common/enums/commission-type.enum';
import { User } from '../../users/entities/user.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'technician_id' })
  technicianId: string;

  @Column({
    type: 'varchar',
    enum: CommissionType,
  })
  type: CommissionType;

  @Column({ name: 'sale_id', nullable: true })
  saleId: string;

  @Column({ length: 255, nullable: true })
  description: string;

  @Column({ name: 'base_value', type: 'decimal', precision: 10, scale: 2 })
  baseValue: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'varchar',
    enum: CommissionStatus,
    default: CommissionStatus.PENDENTE,
  })
  status: CommissionStatus;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'paid_by', type: 'uuid', nullable: true })
  paidBy: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;

  @Column({ name: 'recurring_day', type: 'int', default: 1 })
  recurringDay: number;

  @Column({ name: 'reference_month', length: 7, nullable: true })
  referenceMonth: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.commissions)
  @JoinColumn({ name: 'technician_id' })
  technician: User;

  @ManyToOne(() => Sale, (sale) => sale.commissions)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'paid_by' })
  payer: User;
}
