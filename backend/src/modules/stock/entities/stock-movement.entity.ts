import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StockMovementType } from '../../../common/enums/stock-movement-type.enum';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({
    type: 'varchar',
    enum: StockMovementType,
  })
  type: StockMovementType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'previous_quantity', type: 'int' })
  previousQuantity: number;

  @Column({ name: 'new_quantity', type: 'int' })
  newQuantity: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitCost: number;

  @Column({ name: 'lot_number', length: 100, nullable: true })
  lotNumber: string;

  @Column({ name: 'serial_number', length: 100, nullable: true })
  serialNumber: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'sale_id', nullable: true })
  saleId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Product, (product) => product.stockMovements)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;
}
