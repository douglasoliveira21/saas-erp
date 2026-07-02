import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('card_fees')
export class CardFee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  operator: string;

  @Column({ name: 'payment_type', type: 'varchar', length: 20 })
  paymentType: string; // credito | debito

  @Column({ name: 'installments_from', type: 'int', default: 1 })
  installmentsFrom: number;

  @Column({ name: 'installments_to', type: 'int', default: 1 })
  installmentsTo: number;

  @Column({ name: 'fee_percentage', type: 'decimal', precision: 5, scale: 2 })
  feePercentage: number;

  @Column({ name: 'days_to_receive', type: 'int', default: 30 })
  daysToReceive: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
