import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('inter_webhook_events')
export class InterWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_hash', length: 64, unique: true })
  eventHash: string;

  @Column({ name: 'source_ip', length: 45, nullable: true })
  sourceIp: string;

  @Column({ type: 'varchar', length: 20, default: 'recebido' })
  status: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
