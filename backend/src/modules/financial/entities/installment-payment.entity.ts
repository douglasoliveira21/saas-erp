import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Installment } from './installment.entity';

@Entity('installment_payments')
export class InstallmentPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'installment_id', type: 'uuid' })
  installmentId: string;

  @Column({ name: 'movement_id', type: 'uuid', nullable: true })
  movementId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({ name: 'bank_account_id', type: 'uuid', nullable: true })
  bankAccountId: string;

  @Column({ name: 'paid_at', type: 'timestamp' })
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Installment)
  @JoinColumn({ name: 'installment_id' })
  installment: Installment;
}
