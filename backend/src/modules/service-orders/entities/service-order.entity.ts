import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { ServiceOrderAttachment } from './service-order-attachment.entity';
import { ServiceOrderEvent } from './service-order-event.entity';

@Entity('service_orders')
export class ServiceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment' })
  number: number;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'technician_id', type: 'uuid', nullable: true })
  technicianId: string;

  @Column({ name: 'service_type', length: 120 })
  serviceType: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'status_key', length: 40, default: 'iniciando' })
  statusKey: string;

  @Column({ name: 'opened_at', type: 'timestamp', default: () => 'now()' })
  openedAt: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'conclusion_description', type: 'text', nullable: true })
  conclusionDescription: string;

  @Column({ name: 'parts_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  partsCost: number;

  @Column({ name: 'labor_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  laborCost: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'technician_id' })
  technician: User;

  @OneToMany(() => ServiceOrderAttachment, (attachment) => attachment.serviceOrder)
  attachments: ServiceOrderAttachment[];

  @OneToMany(() => ServiceOrderEvent, (event) => event.serviceOrder)
  events: ServiceOrderEvent[];
}
