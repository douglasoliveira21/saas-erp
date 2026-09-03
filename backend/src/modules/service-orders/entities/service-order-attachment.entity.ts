import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ServiceOrder } from './service-order.entity';

@Entity('service_order_attachments')
export class ServiceOrderAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_order_id', type: 'uuid' })
  serviceOrderId: string;

  @Column({ type: 'varchar', length: 20, default: 'geral' })
  type: string;

  @Column({ length: 255 })
  filename: string;

  @Column({ name: 'mime_type', length: 120, nullable: true })
  mimeType: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ServiceOrder, (order) => order.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_order_id' })
  serviceOrder: ServiceOrder;
}
