import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2 })
  totalValue: number;

  @Column({ name: 'monthly_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthlyValue: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string;

  @Column({ name: 'sla_internal', type: 'int', default: 4 })
  slaInternal: number;

  @Column({ name: 'sla_external', type: 'int', default: 24 })
  slaExternal: number;

  @Column({ name: 'sla_total_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  slaTotalHours: number;

  @Column({ name: 'sla_overage_rate', type: 'decimal', precision: 10, scale: 2, default: 80 })
  slaOverageRate: number;

  @Column({ name: 'file_name', length: 255, nullable: true })
  fileName: string;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath: string;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number;

  @Column({ type: 'varchar', length: 20, default: 'ativo' })
  status: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'adjustment_index', type: 'varchar', length: 20, nullable: true })
  adjustmentIndex: string;

  @Column({ name: 'adjustment_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  adjustmentPercentage: number;

  @Column({ name: 'auto_charge', type: 'boolean', default: false })
  autoCharge: boolean;

  @Column({ name: 'charge_day', type: 'int', nullable: true, default: 10 })
  chargeDay: number;

  @Column({ type: 'text', nullable: true })
  equipments: string;

  @Column({ name: 'renewal_history', type: 'text', nullable: true })
  renewalHistory: string;

  @Column({ name: 'last_renewal_date', type: 'date', nullable: true })
  lastRenewalDate: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
