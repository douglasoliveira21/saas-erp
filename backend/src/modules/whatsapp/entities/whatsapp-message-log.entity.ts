import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('whatsapp_message_logs')
export class WhatsappMessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ length: 30 })
  type: string; // 'text' | 'document'

  @Column({ name: 'related_entity', length: 40, nullable: true })
  relatedEntity: string; // 'service_order' | 'contract'

  @Column({ name: 'related_id', type: 'uuid', nullable: true })
  relatedId: string;

  @Column({ type: 'text', nullable: true })
  preview: string;

  @Column({ length: 20 })
  status: string; // 'enviado' | 'erro'

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
