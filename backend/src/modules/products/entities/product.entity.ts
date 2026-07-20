import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { StockMovement } from '../../stock/entities/stock-movement.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';

@Entity('products')
@Check('CHK_products_quantity_nonnegative', '"quantity" >= 0')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true, length: 100 })
  code: string;

  @Column({ length: 100, default: 'Geral' })
  category: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ name: 'purchase_price', type: 'decimal', precision: 10, scale: 2 })
  purchasePrice: number;

  @Column({ name: 'sale_price', type: 'decimal', precision: 10, scale: 2 })
  salePrice: number;

  @Column({ name: 'tax_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxPercentage: number;

  @Column({ length: 255, nullable: true })
  supplier: string;

  @Column({ name: 'min_stock', type: 'int', default: 5 })
  minStock: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 10, nullable: true })
  ncm: string;

  @Column({ length: 10, nullable: true })
  cfop: string;

  @Column({ length: 10, nullable: true })
  cest: string;

  @Column({ length: 5, nullable: true })
  unit: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => StockMovement, (movement) => movement.product)
  stockMovements: StockMovement[];

  @OneToMany(() => SaleItem, (item) => item.product)
  saleItems: SaleItem[];

  // Computed properties
  get netProfit(): number {
    const taxAmount = (this.salePrice * this.taxPercentage) / 100;
    return this.salePrice - this.purchasePrice - taxAmount;
  }

  get isLowStock(): boolean {
    return this.quantity <= this.minStock;
  }
}
