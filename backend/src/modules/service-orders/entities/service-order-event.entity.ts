import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ServiceOrder } from './service-order.entity';

@Entity('service_order_events')
export class ServiceOrderEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_order_id', type: 'uuid' })
  serviceOrderId: string;

  @Column({ length: 50 })
  type: string;

  @Column({ name: 'status_key', length: 40, nullable: true })
  statusKey: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ServiceOrder, (order) => order.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_order_id' })
  serviceOrder: ServiceOrder;
}
