import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sale } from './sale.entity';

@Entity('sale_events')
export class SaleEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id', type: 'uuid' })
  saleId: string;

  @Column({ type: 'varchar', length: 80 })
  type: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  status: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Sale, (sale) => sale.events)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;
}
