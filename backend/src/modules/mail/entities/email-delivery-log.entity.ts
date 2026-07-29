import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_delivery_logs')
export class EmailDeliveryLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 500 }) recipient: string;
  @Column({ length: 500 }) subject: string;
  @Column({ length: 30, default: 'smtp' }) provider: string;
  @Column({ length: 20 }) status: 'sent' | 'failed';
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @Column({ name: 'attachment_count', type: 'integer', default: 0 }) attachmentCount: number;
  @Column({ name: 'is_test', default: false }) isTest: boolean;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
