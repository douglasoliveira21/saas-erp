import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Purchase } from './purchase.entity';

@Entity('purchase_quotes')
export class PurchaseQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string;

  @Column({ name: 'supplier_name', length: 255 })
  supplierName: string;

  @Column({ name: 'supplier_cnpj', length: 20, nullable: true })
  supplierCnpj: string;

  @Column({ name: 'total_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalValue: number;

  @Column({ name: 'delivery_days', type: 'int', nullable: true })
  deliveryDays: number;

  @Column({ name: 'payment_terms', length: 255, nullable: true })
  paymentTerms: string;

  @Column({ type: 'varchar', length: 20, default: 'recebida' })
  status: string; // recebida | escolhida | rejeitada

  @Column({ type: 'text', nullable: true })
  observations: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Purchase, (purchase) => purchase.quotes)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;
}
