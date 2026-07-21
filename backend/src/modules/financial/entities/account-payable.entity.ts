import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('accounts_payable')
export class AccountPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'uuid', nullable: true })
  purchaseId: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string;

  @Column({ name: 'supplier_name', length: 255, nullable: true })
  supplierName: string;

  @Column({ length: 255 })
  description: string;

  @Column({ name: 'total_value', type: 'decimal', precision: 12, scale: 2 })
  totalValue: number;

  @Column({ name: 'paid_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidValue: number;

  @Column({ name: 'pending_value', type: 'decimal', precision: 12, scale: 2 })
  pendingValue: number;

  @Column({ name: 'competence_date', type: 'date', nullable: true })
  competenceDate: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: string; // pendente | parcial | pago | cancelado | estornado

  @Column({ name: 'cost_center_id', type: 'uuid', nullable: true })
  costCenterId: string;

  @Column({ name: 'chart_account_id', type: 'uuid', nullable: true })
  chartAccountId: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
