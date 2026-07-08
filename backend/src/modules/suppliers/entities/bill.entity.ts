import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from './supplier.entity';

@Entity('bills')
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ name: 'paid_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidValue: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: string; // pendente | pago | parcial | vencido | cancelado

  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ name: 'payment_method', length: 50, nullable: true })
  paymentMethod: string;

  @Column({ type: 'int', default: 1 })
  installments: number;

  @Column({ name: 'installment_number', type: 'int', default: 1 })
  installmentNumber: number;

  @Column({ name: 'recurring_group_id', length: 100, nullable: true })
  recurringGroupId: string;

  @Column({ name: 'document_number', length: 100, nullable: true })
  documentNumber: string;

  @Column({ name: 'barcode', type: 'text', nullable: true })
  barcode: string;

  @Column({ name: 'attachment_path', type: 'text', nullable: true })
  attachmentPath: string;

  @Column({ name: 'attachment_name', length: 255, nullable: true })
  attachmentName: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
