import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from '../../products/entities/product.entity';
import { Service } from '../../services/entities/service.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id' })
  saleId: string;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'service_id', nullable: true })
  serviceId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ name: 'tax_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxPercentage: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  costPrice: number;

  @Column({ name: 'net_profit', type: 'decimal', precision: 10, scale: 2, default: 0 })
  netProfit: number;

  // Relations
  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Product, (product) => product.saleItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Service, (service) => service.saleItems)
  @JoinColumn({ name: 'service_id' })
  service: Service;
}
