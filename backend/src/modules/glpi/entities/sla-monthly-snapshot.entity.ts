import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sla_monthly_snapshots')
export class SlaMonthlySnapshot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 7 }) month: string;
  @Column({ name: 'customer_id', type: 'uuid' }) customerId: string;
  @Column({ name: 'contract_id', type: 'uuid', nullable: true }) contractId: string;
  @Column({ name: 'included_hours', type: 'decimal', precision: 12, scale: 2, default: 0 }) includedHours: number;
  @Column({ name: 'consumed_hours', type: 'decimal', precision: 12, scale: 2, default: 0 }) consumedHours: number;
  @Column({ name: 'exceeded_hours', type: 'decimal', precision: 12, scale: 2, default: 0 }) exceededHours: number;
  @Column({ name: 'overage_rate', type: 'decimal', precision: 12, scale: 2, default: 0 }) overageRate: number;
  @Column({ name: 'total_charge', type: 'decimal', precision: 12, scale: 2, default: 0 }) totalCharge: number;
  @Column({ name: 'ticket_count', type: 'int', default: 0 }) ticketCount: number;
  @Column({ name: 'calculation_details', type: 'jsonb', default: () => "'[]'::jsonb" }) calculationDetails: any[];
  @Column({ name: 'is_frozen', type: 'boolean', default: false }) isFrozen: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
