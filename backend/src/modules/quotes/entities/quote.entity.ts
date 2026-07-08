import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  number: number;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ type: 'varchar', length: 30, default: 'pendente' })
  status: string; // pendente | aprovado | rejeitado | expirado | convertido

  @Column({ name: 'valid_until', type: 'date' })
  validUntil: string;

  @Column({ type: 'jsonb' })
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; description?: string }>;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'payment_conditions', type: 'text', nullable: true })
  paymentConditions: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'sale_id', type: 'uuid', nullable: true })
  saleId: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;
}
