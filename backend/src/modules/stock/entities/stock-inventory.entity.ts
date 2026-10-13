import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stock_inventories')
export class StockInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Preenchido/filtrado automaticamente por common/tenant/tenant-scope.ts
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'counted_quantity', type: 'int' })
  countedQuantity: number;

  @Column({ name: 'system_quantity', type: 'int' })
  systemQuantity: number;

  @Column({ type: 'int' })
  difference: number;

  @Column({ type: 'text' })
  justification: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
