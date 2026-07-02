import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SaleItem } from '../../sales/entities/sale-item.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'sale_price', type: 'decimal', precision: 10, scale: 2 })
  salePrice: number;

  @Column({ name: 'operational_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  operationalCost: number;

  @Column({ name: 'tax_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxPercentage: number;

  @Column({ name: 'estimated_time', type: 'int', nullable: true, comment: 'Tempo estimado em minutos' })
  estimatedTime: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => SaleItem, (item) => item.service)
  saleItems: SaleItem[];

  // Computed properties
  get netProfit(): number {
    const taxAmount = (this.salePrice * this.taxPercentage) / 100;
    return this.salePrice - this.operationalCost - taxAmount;
  }
}
