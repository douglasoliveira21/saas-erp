import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Purchase } from './purchase.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('purchase_items')
export class PurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string;

  @Column({ length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ name: 'received_quantity', type: 'decimal', precision: 10, scale: 2, default: 0 })
  receivedQuantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ name: 'total_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalValue: number;

  @ManyToOne(() => Purchase, (purchase) => purchase.itemsList)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
